import sqlite3
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

print("="*50)
print("🧠 DIAGNÓSTICO DO MOTOR DE INTELIGÊNCIA ARTIFICIAL")
print("="*50)

# 1. Extração de Dados Reais com JOIN (Cruzamento de Tabelas)
try:
    conn = sqlite3.connect('financitas.db')
    # O segredo está aqui: cruzamos as transacoes com as categorias usando o id_categoria
    query = """
        SELECT t.descricao, c.nome as categoria 
        FROM transacoes t
        JOIN categorias c ON t.id_categoria = c.id
        WHERE t.usar_para_treino = 1 
        AND c.nome != 'Indefinida'
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
except Exception as e:
    print(f"Erro ao acessar o banco de dados: {e}")
    exit()

if len(df) < 30:
    print(f"⚠️ Atenção: Apenas {len(df)} transações encontradas. A IA precisa de mais dados históricos para uma avaliação estatística robusta.")
    exit()

print(f"Base de conhecimento carregada: {len(df)} transações classificadas.\n")

# 2. Divisão Cega (Train/Test Split)
X_train, X_test, y_train, y_test = train_test_split(
    df['descricao'], 
    df['categoria'], 
    test_size=0.2, 
    random_state=42
)

# 3. Pipeline (Vetorização em N-Grams + Classificador Linear)
pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(ngram_range=(1, 2))),
    ('clf', LinearSVC(random_state=42))
])

# 4. Treinamento e Predição
print("Treinando o modelo de avaliação e realizando testes cegos...")
pipeline.fit(X_train, y_train)
y_pred = pipeline.predict(X_test)

# 5. O Veredito Matemático
print("\n" + "="*50)
print("📊 RELATÓRIO DE CLASSIFICAÇÃO (Métricas Exatas)")
print("="*50)
print(classification_report(y_test, y_pred, zero_division=0))