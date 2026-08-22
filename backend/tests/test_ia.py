import pytest
from classificador_ia import motor_ia

def test_camada_heuristica_tem_prioridade_absoluta():
    """Injeta palavras no dicionário e verifica se a IA retorna 100% (1.0)."""
    # Força uma regra na memória para o teste
    motor_ia.regras_heuristicas = {"uber": "Transporte", "ifood": "Alimentação"}
    
    categoria, certeza = motor_ia.prever("COMPRA DEBITO UBER DO BRASIL")
    assert categoria == "Transporte"
    assert certeza == 1.0

    categoria2, certeza2 = motor_ia.prever("IFOOD *DELIVERY SAO PAULO")
    assert categoria2 == "Alimentação"
    assert certeza2 == 1.0

def test_ia_fallback_sem_dados():
    """Garante que, ao zerar o banco, uma loja desconhecida retorne Indefinida."""
    motor_ia.regras_heuristicas = {} # Limpa heurísticas
    motor_ia.pipeline = None         # Simula amnésia (Zerar Histórico)
    
    categoria, certeza = motor_ia.prever("LOJAS RENNER")
    assert categoria == "Indefinida"
    assert certeza == 0.0