import os
import pandas as pd
import numpy as np
import sqlite3
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

DB_FILE = "financitas_database.db"
MODELO_PATH = "modelo_classificador.joblib"

class MotorClassificacao:
    def __init__(self):
        self.pipeline = None
        self.regras_heuristicas = {}
        self.carregar_modelo()
        self.recarregar_heuristicas()

    def recarregar_heuristicas(self):
        """Puxa as palavras-chave do banco de dados para a memória."""
        try:
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("SELECT h.palavra_chave, c.nome FROM regras_heuristicas h JOIN categorias c ON h.id_categoria = c.id")
            self.regras_heuristicas = {row[0].lower(): row[1] for row in cursor.fetchall()}
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"Erro ao carregar heurísticas: {e}")

    def carregar_modelo(self):
        if os.path.exists(MODELO_PATH):
            self.pipeline = joblib.load(MODELO_PATH)
        else:
            self.treinar()

    def treinar(self):
        try:
            conn = sqlite3.connect(DB_FILE)
            # No SQLite, booleanos TRUE são armazenados nativamente como 1
            query = "SELECT t.descricao, c.nome as categoria FROM transacoes t JOIN categorias c ON t.id_categoria = c.id WHERE t.usar_para_treino = 1 AND c.nome != 'Indefinida'"
            df = pd.read_sql(query, conn)
            conn.close()

            if df.shape[0] < 2 or len(df['categoria'].unique()) < 2:
                self.pipeline = None
                return False

            self.pipeline = Pipeline([
                ('tfidf', TfidfVectorizer(ngram_range=(1, 2), stop_words=['ltda', 's', 'a', 'sa', 'com', 'br'])),
                ('clf', LogisticRegression(class_weight='balanced', random_state=42))
            ])
            self.pipeline.fit(df['descricao'], df['categoria'])
            joblib.dump(self.pipeline, MODELO_PATH)
            return True
        except Exception:
            return False

    def prever(self, descricao: str):
        desc_lower = str(descricao).lower()
        
        # 1. Checa as regras do usuário (Banco de Dados)
        for palavra_chave, categoria_mapeada in self.regras_heuristicas.items():
            if palavra_chave in desc_lower:
                return categoria_mapeada, 1.0

        # 2. Se não achar, usa Machine Learning
        if not self.pipeline: return "Indefinida", 0.0
        try:
            probs = self.pipeline.predict_proba([descricao])[0]
            max_idx = np.argmax(probs)
            return self.pipeline.classes_[max_idx], float(probs[max_idx])
        except Exception:
            return "Indefinida", 0.0

motor_ia = MotorClassificacao()