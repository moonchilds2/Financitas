import sqlite3
import os

DB_FILE = "financitas_database.db"

def criar_banco():
    print("Conectando ao banco de dados e verificando tabelas...")
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()

        # 1. Tabela Categorias
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL,
            cor TEXT,
            icone TEXT,
            limite_orcamento REAL DEFAULT 0
        );
        """)

        # 2. Tabela Receitas (Histórico)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS receitas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mes INTEGER NOT NULL,
            ano INTEGER NOT NULL,
            valor_total REAL NOT NULL,
            UNIQUE(mes, ano)
        );
        """)

        # 3. Tabela Faturas
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS faturas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mes INTEGER NOT NULL,
            ano INTEGER NOT NULL,
            data_upload TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 4. Tabela Transações
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS transacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_fatura INTEGER REFERENCES faturas(id),
            id_categoria INTEGER REFERENCES categorias(id),
            data_compra TEXT NOT NULL,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            certeza_algoritmo REAL, 
            classificado_manualmente BOOLEAN DEFAULT 0,
            eh_parcelado BOOLEAN DEFAULT 0,
            usar_para_treino BOOLEAN DEFAULT 0
        );
        """)

        # 5. Tabela Parcelamentos
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS parcelamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_transacao INTEGER REFERENCES transacoes(id),
            parcela_atual INTEGER NOT NULL,
            total_parcelas INTEGER NOT NULL,
            saldo_devedor REAL NOT NULL
        );
        """)
        
        # 6. Tabela de Metas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS metas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                valor_alvo REAL NOT NULL,
                valor_atual REAL DEFAULT 0,
                data_criacao TEXT DEFAULT CURRENT_DATE,
                icone TEXT,
                cor TEXT
            );
        """)

        # 7. Tabela de Regras Heurísticas (Atalhos da IA)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS regras_heuristicas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                palavra_chave TEXT UNIQUE NOT NULL,
                id_categoria INTEGER REFERENCES categorias(id) ON DELETE CASCADE
            );
        """)

        print("Tabelas verificadas/criadas com sucesso!")

        # 8. Inserindo as Categorias Base de Fábrica PRIMEIRO
        categorias_base = [
            ('Aluguel', "#722F20", 'fa-house'),
            ('Internet', '#3357FF', 'fa-wifi'),
            ('Água', '#33C1FF', 'fa-droplet'),
            ('Transporte', '#F1C40F', 'fa-car'),
            ('Energia', '#F39C12', 'fa-bolt'), 
            ('Feira', '#27AE60', 'fa-shopping-cart'),
            ('Entretenimento', '#9B59B6', 'fa-film'),
            ('Zahy', '#FF69B4', 'fa-baby'),
            ('Parcelamentos', '#95A5A6', 'fa-credit-card'),
            ('Taxas/Juros', '#E74C3C', 'fa-triangle-exclamation'), 
            ('Alimentação', "#0BD300", 'fa-utensils'),
            ('Receita/Bolsa', '#2ECC71', 'fa-dollar-sign'),
            ('Indefinida', '#8D99AE', 'fa-circle-question'),
            ('Reserva/Investimento', '#3C096C', 'fa-piggy-bank')
        ]

        cursor.executemany("""
            INSERT INTO categorias (nome, cor, icone) 
            VALUES (?, ?, ?) 
            ON CONFLICT (nome) 
            DO UPDATE SET cor = EXCLUDED.cor, icone = EXCLUDED.icone;
        """, categorias_base)
        print("Categorias base inseridas/atualizadas com sucesso!")

        # 9. Injetar o Dicionário Automático DEPOIS das categorias existirem
        heuristicas_base = {}

        for palavra, cat_nome in heuristicas_base.items():
            cursor.execute("SELECT id FROM categorias WHERE nome = ?", (cat_nome,))
            res = cursor.fetchone()
            if res:
                cursor.execute("""
                    INSERT INTO regras_heuristicas (palavra_chave, id_categoria) 
                    VALUES (?, ?) ON CONFLICT DO NOTHING
                """, (palavra, res[0]))

        conn.commit()
        cursor.close()
        conn.close()
        print("✅ Banco de dados SQLite pronto para uso.")

    except Exception as e:
        print(f"❌ Erro ao configurar banco de dados: {e}")

if __name__ == "__main__":
    criar_banco()