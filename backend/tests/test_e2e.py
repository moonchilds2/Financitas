import io
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_upload_csv_e_treino_ia_fluxo_completo():
    """Simula um usuário fazendo upload, a IA classificando, e o usuário salvando no BD."""
    
    # 1. Simula o arquivo CSV enviado pelo input HTML
    conteudo_csv = "data,descrição,valor\n2026-08-01,UBER DO BRASIL,-20.00\n2026-08-02,MERCADINHO LULA,-50.00\n2026-08-03,COMPRA NOVA DESCONHECIDA,-150.00"
    # Usando BytesIO e .encode('utf-8') para simular um arquivo binário real da internet
    arquivo = {"arquivo": ("extrato.csv", io.BytesIO(conteudo_csv.encode('utf-8')), "text/csv")}
    
    # 2. Chama a rota de Processamento (O que o botão "Processar com IA" faz)
    response = client.post("/upload", files=arquivo)
    assert response.status_code == 200
    dados = response.json()
    
    transacoes_processadas = dados["transacoes"]
    assert len(transacoes_processadas) == 3
    
    # 3. Verifica se a Heurística interceptou o Uber e o Mercadinho
    t_uber = next(t for t in transacoes_processadas if "UBER" in t["descricao_limpa"])
    assert t_uber["categoria_sugerida"] == "Transporte"
    assert t_uber["certeza_algoritmo"] == 1.0  # 100% de confiança
    
    # 4. Simula o usuário aprovando e clicando em "Confirmar e Salvar Fatura"
    for t in transacoes_processadas:
        t["categoria_revisada"] = t["categoria_sugerida"]
        t["usar_para_treino"] = True
        
    resp_salvar = client.post("/confirm", json={"transacoes": transacoes_processadas})
    assert resp_salvar.status_code == 200
    assert resp_salvar.json()["status"] == "sucesso"