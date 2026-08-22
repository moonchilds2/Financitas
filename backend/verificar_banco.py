import psycopg2
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://financitas_user:financitas_senha123@db:5432/financitas")

def checar_dados():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()

        # Conta quantas transações existem no total
        cursor.execute("SELECT count(*) FROM transacoes;")
        total = cursor.fetchone()[0]
        print(f"\n✅ SUCESSO! O banco de dados possui {total} transações salvas.")

        if total > 0:
            print("\nÚltimas 5 transações registradas:")
            print("-" * 60)
            # Busca as 5 últimas, unindo com a tabela de categorias para mostrar o nome da categoria
            cursor.execute("""
                SELECT t.data_compra, c.nome, t.descricao, t.valor 
                FROM transacoes t 
                JOIN categorias c ON t.id_categoria = c.id 
                ORDER BY t.id DESC LIMIT 5;
            """)
            for linha in cursor.fetchall():
                data, categoria, desc, valor = linha
                # Formata a saída no terminal
                print(f"[{data}] {categoria.upper()}: {desc} (R$ {valor})")
            print("-" * 60)

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Erro ao acessar o banco: {e}")

if __name__ == "__main__":
    checar_dados()