from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_listar_categorias_base():
    """O sistema deve sempre inicializar as categorias base com sucesso."""
    response = client.get("/gestao-categorias")
    assert response.status_code == 200
    dados = response.json()
    assert "categorias" in dados
    
    # Verifica se as categorias obrigatórias existem
    nomes = [c["nome"] for c in dados["categorias"]]
    assert "Receita/Bolsa" in nomes
    assert "Indefinida" in nomes

def test_listar_heuristicas():
    """A rota do dicionário da IA deve responder corretamente."""
    response = client.get("/heuristicas")
    assert response.status_code == 200
    dados = response.json()
    assert "regras" in dados
    assert type(dados["regras"]) == list

def test_resumo_calcula_dashboard():
    """Garante que a rota que alimenta os gráficos do Chart.js não quebre."""
    response = client.get("/resumo")
    assert response.status_code == 200
    dados = response.json()
    assert "receita_total" in dados
    assert "gasto_total" in dados
    assert "top_5_gastos" in dados