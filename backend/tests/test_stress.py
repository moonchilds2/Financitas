import os
import time
import pandas as pd
import random
import requests
import uuid

# 1. Configurações do Teste
NUM_TRANSACOES = 5000
ARQUIVO_TESTE = "fatura_estresse.csv"
URL_API = "http://localhost:8000/upload"

print("="*50)
print(f"🚀 BATERIA DE TESTES: FINANCITAS ENGINE")
print("="*50)
print(f"Gerando arquivo de carga com {NUM_TRANSACOES} transações falsas (Padrão Nubank)...")

# 2. Gerador de Dados Mockados (Clone exato da estrutura do Nubank)
descricoes_mock = [
    "UBER *TRIP", "IFOOD *DELIVERY", "AMAZON PRIME", "NETFLIX", 
    "SUPERMERCADO SAO LUIZ", "POSTO IPIRANGA", "FARMACIA PAGUE MENOS",
    "PAGAMENTO MENSALIDADE", "MERCADO LIVRE", "COMPRA *STEAM GAME"
]

dados = []
for _ in range(NUM_TRANSACOES):
    dados.append({
        "Data": f"{random.randint(1,28):02d}/{random.randint(1,12):02d}/2026",
        "Valor": round(random.uniform(-500.0, 100.0), 2),
        "Identificador": str(uuid.uuid4()), # O Nubank gera um código único para cada compra
        "Descrição": random.choice(descricoes_mock) + f" {random.randint(100,999)}"
    })

# Salva o arquivo CSV físico temporário com separador em vírgula
df = pd.DataFrame(dados)
# As colunas precisam estar na ordem exata: Data, Valor, Identificador, Descrição
df = df[["Data", "Valor", "Identificador", "Descrição"]] 
df.to_csv(ARQUIVO_TESTE, index=False, sep=",")
print(f"Arquivo '{ARQUIVO_TESTE}' criado na memória.\n")

# 3. Disparando contra a API
print("Enviando pacote para a Inteligência Artificial classificar...")
print("Monitorando tempo de resposta do servidor...\n")
inicio = time.time()

with open(ARQUIVO_TESTE, 'rb') as f:
    files = {'arquivo': (ARQUIVO_TESTE, f, 'text/csv')}
    try:
        resposta = requests.post(URL_API, files=files)
        fim = time.time()
        
        tempo_total = fim - inicio
        
        if resposta.status_code == 200:
            print(f"✅ SUCESSO ABSOLUTO!")
            print(f"O Backend limpou os dados e a IA classificou {NUM_TRANSACOES} linhas em incríveis {tempo_total:.2f} segundos!")
            if tempo_total < 3.0:
                print("Desempenho aprovado com louvor (Algoritmo altamente otimizado).")
            else:
                print("Processamento concluído, mas o tempo foi um pouco elevado.")
        else:
            print(f"❌ ERRO: O servidor retornou o status {resposta.status_code}")
            print(resposta.text)
            
    except Exception as e:
        print("❌ ERRO DE CONEXÃO: Certifique-se de que o Financitas está aberto/rodando.")
        print(e)

# 4. Limpeza
if os.path.exists(ARQUIVO_TESTE):
    os.remove(ARQUIVO_TESTE)
    print("\nLixo temporário removido. Teste finalizado.")