import os
import io
import sys
import csv
import sqlite3
import pandas as pd
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from processador_csv import processar_fatura_universal
from classificador_ia import motor_ia 
from setup_db import criar_banco

DB_FILE = "financitas_database.db"

app = FastAPI(title="Financitas API", description="Backend de IA para Gestão Financeira")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_db_check():
    # Centraliza toda a lógica de criação de tabelas e atualização no setup_db.py
    criar_banco()


# ==========================================
# MODELOS DE DADOS (PYDANTIC)
# ==========================================

class NovaHeuristica(BaseModel):
    palavra_chave: str
    categoria: str

class TransacaoConfirmada(BaseModel):
    data_compra: str
    descricao: str
    descricao_limpa: str
    valor: float
    origem: str
    eh_parcelado: bool
    parcela_atual: int
    total_parcelas: int
    categoria_sugerida: str
    certeza_algoritmo: float
    categoria_revisada: Optional[str] = None
    usar_para_treino: Optional[bool] = False

class FaturaConfirmada(BaseModel):
    transacoes: List[TransacaoConfirmada]

class TransacaoAtualizada(BaseModel):
    id_transacao: int
    categoria_nova: str
    usar_para_treino: bool

class AtualizacaoLote(BaseModel):
    transacoes: List[TransacaoAtualizada]

class OrcamentoUpdate(BaseModel):
    categoria: str
    limite: float

class LoteOrcamentos(BaseModel):
    orcamentos: List[OrcamentoUpdate]

class NovaMeta(BaseModel):
    nome: str
    valor_alvo: float
    icone: str
    cor: str

class AdicionarSaldo(BaseModel):
    valor: float

class CategoriaBase(BaseModel):
    nome: str
    icone: str
    cor: str


# ==========================================
# ROTAS GERAIS E DASHBOARD
# ==========================================

@app.post("/upload")
async def upload_fatura(arquivo: UploadFile = File(...)):
    if not arquivo.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="O arquivo enviado deve ser um formato .csv")
    try:
        conteudo = await arquivo.read()
        df = processar_fatura_universal(io.BytesIO(conteudo))
        df['data_compra'] = df['data_compra'].astype(str)
        
        # --- TRAVA DE SEGURANÇA: REMOVER LIXO BANCÁRIO ---
        # Ignora linhas que o banco insere automaticamente no extrato e que bagunçam a IA e a matemática
        palavras_ignoradas = [
            'valor pendente', 'pagamento de fatura', 'pagamento recebido', 
            'fatura paga', 'juros atraso', 'multa atraso', 'iof atraso', 
            'iof por fatura', 'juros por fatura', 'multa por fatura'
        ]
        
        # Remove a linha se a descrição original contiver alguma das palavras ignoradas
        if 'descricao' in df.columns:
            df = df[~df['descricao'].str.contains('|'.join(palavras_ignoradas), case=False, na=False)]
        
        categorias, certezas = [], []
        for desc in df['descricao_limpa']:
            cat, cert = motor_ia.prever(desc)
            categorias.append(cat)
            certezas.append(cert)
            
        df['categoria_sugerida'] = categorias
        df['certeza_algoritmo'] = certezas

        dados = df.where(pd.notnull(df), None).to_dict(orient="records")
        return {"status": "sucesso", "nome_arquivo": arquivo.filename, "total_registros_processados": len(dados), "transacoes": dados}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno ao processar arquivo: {str(e)}")

@app.post("/confirm")
async def confirmar_fatura(fatura: FaturaConfirmada):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        for t in fatura.transacoes:
            categoria_final = t.categoria_revisada if t.categoria_revisada else t.categoria_sugerida
            
            # Tratamento de formato de data
            data_sql = t.data_compra
            if "/" in data_sql:
                partes = data_sql.split("/")
                if len(partes) == 3: data_sql = f"{partes[2]}-{partes[1]}-{partes[0]}"
            
            # 1. Pega o ID da categoria
            cursor.execute("SELECT id FROM categorias WHERE nome = ?", (categoria_final,))
            resultado_cat = cursor.fetchone()
            
            if resultado_cat:
                id_categoria = resultado_cat[0]
                
                # 2. VERIFICAÇÃO DE DUPLICIDADE
                cursor.execute("""
                    SELECT id FROM transacoes 
                    WHERE data_compra = ? AND valor = ? AND descricao = ?
                """, (data_sql, t.valor, t.descricao_limpa))
                
                if cursor.fetchone():
                    continue
                
                # 3. Se passou pela trava, insere a transação de forma segura
                cursor.execute("""
                    INSERT INTO transacoes (id_categoria, data_compra, descricao, valor, certeza_algoritmo, classificado_manualmente, eh_parcelado, usar_para_treino)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (id_categoria, data_sql, t.descricao_limpa, t.valor, t.certeza_algoritmo, t.categoria_revisada is not None, t.eh_parcelado, t.usar_para_treino))
                
        conn.commit()
        cursor.close()
        conn.close()
        
        motor_ia.treinar() 
        
        return {"status": "sucesso", "mensagem": "Transações salvas e duplicatas ignoradas."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/transacoes")
async def listar_todas_transacoes():
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT t.id, t.data_compra, t.descricao, t.valor, c.nome, t.eh_parcelado, t.usar_para_treino, t.certeza_algoritmo, t.classificado_manualmente
            FROM transacoes t JOIN categorias c ON t.id_categoria = c.id ORDER BY t.data_compra DESC, t.id DESC
        """)
        colunas = ["id", "data_compra", "descricao_limpa", "valor", "categoria_atual", "eh_parcelado", "usar_para_treino", "certeza_algoritmo", "classificado_manualmente"]
        transacoes = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
        cursor.close()
        conn.close()
        return {"status": "sucesso", "transacoes": transacoes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/transacoes/atualizar")
async def atualizar_transacoes(lote: AtualizacaoLote):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        for t in lote.transacoes:
            cursor.execute("SELECT id FROM categorias WHERE nome = ?", (t.categoria_nova,))
            resultado = cursor.fetchone()
            if resultado:
                cursor.execute("UPDATE transacoes SET id_categoria = ?, classificado_manualmente = 1, usar_para_treino = ? WHERE id = ?", (resultado[0], t.usar_para_treino, t.id_transacao))
        conn.commit()
        cursor.close()
        conn.close()
        
        motor_ia.treinar()
        
        return {"status": "sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/resumo")
async def obter_resumo(mes_filtro: Optional[str] = None):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()

        cursor.execute("SELECT c.nome, t.valor, t.data_compra, t.descricao FROM transacoes t JOIN categorias c ON t.id_categoria = c.id")
        transacoes = cursor.fetchall()

        meses_set = set()
        for _, _, dt, _ in transacoes:
            dt_str = str(dt)
            if len(dt_str) >= 7: meses_set.add(dt_str[:7])
                
        meses_disponiveis = sorted(list(meses_set), reverse=True)
        if not mes_filtro and meses_disponiveis: mes_filtro = meses_disponiveis[0] 
        ano_filtro = mes_filtro[:4] if mes_filtro else None

        receita_total, gasto_total = 0.0, 0.0
        gastos_por_categoria, gastos_mensais, todos_gastos_mes = {}, {}, [] 

        cursor.execute("SELECT nome, limite_orcamento FROM categorias")
        orcamentos_gerais = {nome: float(limite) if limite else 0.0 for nome, limite in cursor.fetchall()}

        for categoria, valor, data_compra, descricao in transacoes:
            valor_float = float(valor)
            dt_str = str(data_compra)
            if len(dt_str) < 10: continue
                
            mes_ano_key = dt_str[:7]
            ano_transacao, mes_transacao = dt_str[:4], dt_str[5:7]
            mes_ano_display = f"{mes_transacao}/{ano_transacao}"
            
            if ano_transacao == ano_filtro:
                if mes_ano_key not in gastos_mensais: 
                    gastos_mensais[mes_ano_key] = {"mes_display": mes_ano_display, "receita": 0.0, "gasto": 0.0, "categorias": {}}
                
                if categoria == 'Receita/Bolsa': 
                    gastos_mensais[mes_ano_key]["receita"] += abs(valor_float)
                elif categoria not in ['Reserva/Investimento', 'Indefinida']: 
                    gasto_abs = abs(valor_float)
                    gastos_mensais[mes_ano_key]["gasto"] += gasto_abs
                    gastos_mensais[mes_ano_key]["categorias"][categoria] = gastos_mensais[mes_ano_key]["categorias"].get(categoria, 0) + gasto_abs

            if mes_ano_key == mes_filtro:
                if categoria == 'Receita/Bolsa': 
                    receita_total += abs(valor_float)
                elif categoria not in ['Reserva/Investimento', 'Indefinida']:
                    gasto_abs = abs(valor_float)
                    gasto_total += gasto_abs
                    gastos_por_categoria[categoria] = gastos_por_categoria.get(categoria, 0) + gasto_abs
                    
                    todos_gastos_mes.append({
                        "descricao": descricao, 
                        "categoria": categoria, 
                        "valor": gasto_abs, 
                        "data": f"{dt_str[8:10]}/{mes_transacao}/{ano_transacao}"
                    })

        grafico_dados = sorted([{"categoria": cat, "total": round(val, 2)} for cat, val in gastos_por_categoria.items()], key=lambda x: x['total'], reverse=True)
        
        evolucao_mensal = []
        for k in sorted(gastos_mensais.keys()):
            cats_do_mes = gastos_mensais[k]["categorias"]
            top_cats_mes = sorted(cats_do_mes.items(), key=lambda x: x[1], reverse=True)[:2]
            evolucao_mensal.append({
                "mes": gastos_mensais[k]["mes_display"],
                "receita": round(gastos_mensais[k]["receita"], 2),
                "gasto": round(gastos_mensais[k]["gasto"], 2),
                "top1_nome": top_cats_mes[0][0] if len(top_cats_mes) > 0 else None,
                "top1_valor": round(top_cats_mes[0][1], 2) if len(top_cats_mes) > 0 else 0,
                "top2_nome": top_cats_mes[1][0] if len(top_cats_mes) > 1 else None,
                "top2_valor": round(top_cats_mes[1][1], 2) if len(top_cats_mes) > 1 else 0
            })

        top_5_gastos = sorted(todos_gastos_mes, key=lambda x: x['valor'], reverse=True)[:5]

        progresso_orcamento = []
        for cat, limite in orcamentos_gerais.items():
            if limite > 0:
                gasto_atual = gastos_por_categoria.get(cat, 0.0)
                progresso_orcamento.append({"categoria": cat, "gasto": round(gasto_atual, 2), "limite": round(limite, 2), "porcentagem": round((gasto_atual / limite) * 100, 1) if limite else 0})
        progresso_orcamento = sorted(progresso_orcamento, key=lambda x: x['porcentagem'], reverse=True)
        
        meses_opcoes = []
        nomes_m = {"01":"Janeiro", "02":"Fevereiro", "03":"Março", "04":"Abril", "05":"Maio", "06":"Junho", "07":"Julho", "08":"Agosto", "09":"Setembro", "10":"Outubro", "11":"Novembro", "12":"Dezembro"}
        for m in meses_disponiveis:
            ano_s, mes_s = m[:4], m[5:7]
            meses_opcoes.append({"value": m, "label": f"{nomes_m.get(mes_s, mes_s)} {ano_s}"})

        cursor.close()
        conn.close()

        return {
            "status": "sucesso", "mes_atual": mes_filtro, "meses_disponiveis": meses_opcoes,
            "receita_total": round(receita_total, 2), "gasto_total": round(gasto_total, 2), "saldo_previsto": round(receita_total - gasto_total, 2),
            "grafico_dados": grafico_dados, "evolucao_mensal": evolucao_mensal, "top_5_gastos": top_5_gastos,
            "progresso_orcamento": progresso_orcamento, "todas_metas": [{"categoria": k, "limite": v} for k, v in orcamentos_gerais.items()]
        }

    except Exception as e:
        print(f"Erro ao buscar resumo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/reset-database")
async def resetar_banco_dados():
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM parcelamentos;")
        cursor.execute("DELETE FROM transacoes;")
        cursor.execute("DELETE FROM faturas;")
        
        # Opcional: Reseta a contagem dos IDs nativamente no SQLite
        cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('parcelamentos', 'transacoes', 'faturas');")
        
        conn.commit()
        cursor.close()
        conn.close()

        if os.path.exists("modelo_classificador.joblib"):
            os.remove("modelo_classificador.joblib")
        motor_ia.pipeline = None
        
        return {"status": "sucesso", "mensagem": "Histórico limpo com sucesso."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/exportar-dados")
async def exportar_dados():
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT t.data_compra, t.descricao, t.valor, c.nome, t.eh_parcelado 
            FROM transacoes t 
            JOIN categorias c ON t.id_categoria = c.id 
            ORDER BY t.data_compra DESC
        """)
        linhas = cursor.fetchall()
        cursor.close()
        conn.close()

        output = io.StringIO()
        writer = csv.writer(output, delimiter=';')
        writer.writerow(['Data', 'Descrição', 'Valor', 'Categoria', 'Parcelado'])
        for linha in linhas:
            writer.writerow(linha)
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]), 
            media_type="text/csv", 
            headers={"Content-Disposition": "attachment; filename=financitas_historico_tratado.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# ROTAS DE GESTÃO DE CATEGORIAS E ORÇAMENTO
# ==========================================

@app.get("/gestao-categorias")
async def listar_categorias_detalhadas():
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.id, c.nome, c.icone, c.cor, c.limite_orcamento,
                   (SELECT COUNT(id) FROM transacoes WHERE id_categoria = c.id) as qtd_transacoes
            FROM categorias c
            ORDER BY c.nome ASC
        """)
        colunas = ["id", "nome", "icone", "cor", "limite_orcamento", "qtd_transacoes"]
        categorias = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
        cursor.close()
        conn.close()
        
        inquebraveis = ['Receita/Bolsa', 'Indefinida', 'Reserva/Investimento']
        for c in categorias:
            c['is_default'] = c['nome'] in inquebraveis

        return {"status": "sucesso", "categorias": categorias}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/gestao-categorias")
async def criar_categoria(cat: CategoriaBase):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO categorias (nome, icone, cor) VALUES (?, ?, ?)", (cat.nome, cat.icone, cat.cor))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Já existe uma categoria com este nome.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/gestao-categorias/{cat_id}")
async def editar_categoria(cat_id: int, cat: CategoriaBase):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("UPDATE categorias SET nome = ?, icone = ?, cor = ? WHERE id = ?", (cat.nome, cat.icone, cat.cor, cat_id))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Já existe outra categoria com este nome.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/gestao-categorias/{cat_id}")
async def deletar_categoria(cat_id: int):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM categorias WHERE nome = 'Indefinida'")
        indefinida_row = cursor.fetchone()
        if not indefinida_row:
            raise Exception("Categoria 'Indefinida' não encontrada no banco.")
        id_indef = indefinida_row[0]

        cursor.execute("UPDATE transacoes SET id_categoria = ? WHERE id_categoria = ?", (id_indef, cat_id))
        cursor.execute("DELETE FROM categorias WHERE id = ?", (cat_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso", "mensagem": "Categoria deletada e histórico protegido."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/orcamentos")
async def atualizar_orcamentos(lote: LoteOrcamentos):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        for o in lote.orcamentos:
            cursor.execute("UPDATE categorias SET limite_orcamento = ? WHERE nome = ?", (o.limite, o.categoria))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# ROTAS DE METAS E PREVISÃO
# ==========================================

@app.get("/metas")
async def listar_metas():
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        # O SQLite calcula diferença de datas diferente do Postgres
        cursor.execute("""
            SELECT id, nome, valor_alvo, valor_atual, data_criacao, icone, cor, 
                   CAST((julianday(CURRENT_DATE) - julianday(data_criacao)) AS INTEGER) AS dias_passados 
            FROM metas ORDER BY id ASC
        """)
        colunas = ["id", "nome", "valor_alvo", "valor_atual", "data_criacao", "icone", "cor", "dias_passados"]
        metas = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
        cursor.close()
        conn.close()
        return {"status": "sucesso", "metas": metas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/metas")
async def criar_meta(meta: NovaMeta):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO metas (nome, valor_alvo, icone, cor) 
            VALUES (?, ?, ?, ?)
        """, (meta.nome, meta.valor_alvo, meta.icone, meta.cor))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/metas/{meta_id}/saldo")
async def adicionar_saldo_meta(meta_id: int, saldo: AdicionarSaldo):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("UPDATE metas SET valor_atual = valor_atual + ? WHERE id = ?", (saldo.valor, meta_id))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/metas/{meta_id}")
async def deletar_meta(meta_id: int):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM metas WHERE id = ?", (meta_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso", "mensagem": "Meta excluída"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/radar-gastos")
async def obter_radar(mes_filtro: Optional[str] = None):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        categorias_fixas = ['Aluguel', 'Internet', 'Água', 'Energia', 'Parcelamentos']
        
        cursor.execute("SELECT c.nome, t.valor, t.data_compra FROM transacoes t JOIN categorias c ON t.id_categoria = c.id")
        transacoes = cursor.fetchall()
        
        if not mes_filtro:
            mes_filtro = pd.Timestamp.now().strftime("%Y-%m")

        receita_total = 0.0
        gasto_fixo = 0.0
        gasto_volatil = 0.0

        for cat, valor, dt in transacoes:
            if str(dt)[:7] == mes_filtro:
                v = float(valor)
                if cat == 'Receita/Bolsa':
                    receita_total += abs(v)
                elif v < 0 and cat not in ['Reserva/Investimento', 'Indefinida']:
                    if cat in categorias_fixas:
                        gasto_fixo += abs(v)
                    else:
                        gasto_volatil += abs(v)

        cursor.close()
        conn.close()

        receita_livre_fixos = max(0, receita_total - gasto_fixo)
        receita_livre_volateis = max(0, receita_total - gasto_volatil)
        receita_livre_total = max(0, receita_total - (gasto_fixo + gasto_volatil))

        return {
            "status": "sucesso",
            "receita_base": receita_total,
            "fixos": {"gasto": gasto_fixo, "livre": receita_livre_fixos},
            "volateis": {"gasto": gasto_volatil, "livre": receita_livre_volateis},
            "ambos": {"fixo": gasto_fixo, "volatil": gasto_volatil, "livre": receita_livre_total}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/projecao-gastos")
async def projecao_gastos():
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT c.nome, t.valor, t.data_compra 
            FROM transacoes t 
            JOIN categorias c ON t.id_categoria = c.id
        """)
        transacoes = cursor.fetchall()
        cursor.close()
        conn.close()

        if not transacoes:
            return {"status": "sucesso", "projecao_total": 0, "receita_media": 0, "categorias": []}

        gastos_por_cat = {}
        meses_ativos = set()
        receita_total = 0.0

        for cat, valor, dt in transacoes:
            dt_str = str(dt)
            if len(dt_str) < 10: continue
            
            mes_ano = dt_str[:7]
            meses_ativos.add(mes_ano)
            v = float(valor)
            
            if cat == 'Receita/Bolsa':
                receita_total += abs(v)
            elif v < 0 and cat not in ['Reserva/Investimento', 'Indefinida']:
                gastos_por_cat[cat] = gastos_por_cat.get(cat, 0) + abs(v)

        num_meses = len(meses_ativos) if len(meses_ativos) > 0 else 1
        receita_media = receita_total / num_meses
        
        projetado_total = 0.0
        categorias_proj = []

        for cat, total_gasto in gastos_por_cat.items():
            media = total_gasto / num_meses
            projetado_total += media
            categorias_proj.append({"categoria": cat, "projetado": round(media, 2)})

        categorias_proj = sorted(categorias_proj, key=lambda x: x["projetado"], reverse=True)

        return {
            "status": "sucesso", 
            "projecao_total": round(projetado_total, 2), 
            "receita_media": round(receita_media, 2), 
            "categorias": categorias_proj
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# ROTAS DE HEURÍSTICAS (ATALHOS DA IA)
# ==========================================
@app.get("/heuristicas")
async def listar_heuristicas():
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT h.id, h.palavra_chave, c.nome FROM regras_heuristicas h JOIN categorias c ON h.id_categoria = c.id ORDER BY h.id DESC")
        regras = [{"id": linha[0], "palavra_chave": linha[1], "categoria": linha[2]} for linha in cursor.fetchall()]
        cursor.close()
        conn.close()
        return {"status": "sucesso", "regras": regras}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/heuristicas")
async def criar_heuristica(regra: NovaHeuristica):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM categorias WHERE nome = ?", (regra.categoria,))
        res = cursor.fetchone()
        if not res: raise Exception("Categoria não encontrada")
        
        cursor.execute("INSERT INTO regras_heuristicas (palavra_chave, id_categoria) VALUES (?, ?)", (regra.palavra_chave.lower(), res[0]))
        conn.commit()
        cursor.close()
        conn.close()
        motor_ia.recarregar_heuristicas() 
        return {"status": "sucesso"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Esta palavra-chave já existe.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/heuristicas/{id_regra}")
async def deletar_heuristica(id_regra: int):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM regras_heuristicas WHERE id = ?", (id_regra,))
        conn.commit()
        cursor.close()
        conn.close()
        motor_ia.recarregar_heuristicas() 
        return {"status": "sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/reset-heuristicas")
async def zerar_heuristicas():
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # O SQLite não suporta o TRUNCATE, então usamos o DELETE total
        cursor.execute("DELETE FROM regras_heuristicas;")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='regras_heuristicas';")
        
        conn.commit()
        cursor.close()
        conn.close()
        motor_ia.recarregar_heuristicas()
        return {"status": "sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# UNIFICAÇÃO: SERVINDO O FRONTEND
# ==========================================
if getattr(sys, 'frozen', False):
    # Modo Produção (Rodando pelo Financitas.exe)
    BASE_DIR = os.path.dirname(sys.executable)
    FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
else:
    # Modo Desenvolvimento (Rodando pelo VS Code)
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")