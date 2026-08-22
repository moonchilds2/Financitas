import pytest
import io
from processador_csv import processar_fatura_universal

def test_processar_fatura_cartao_inverte_valor():
    """Garante que gastos no crédito (+ positivo no Nubank) virem saídas (- negativo)."""
    csv_falso = "date,title,amount\n2026-08-10,Uber,15.50\n2026-08-11,iFood,45.90"
    df = processar_fatura_universal(io.StringIO(csv_falso))
    
    assert len(df) == 2
    assert df.iloc[0]['valor'] == -15.50  # O 15.50 deve virar -15.50
    assert df.iloc[0]['origem'] == 'Cartao'

def test_processar_fatura_ignora_estornos():
    """Garante que estornos ou pagamentos da fatura (negativos no CSV do Nubank) sejam descartados."""
    csv_falso = "date,title,amount\n2026-08-10,Uber,15.00\n2026-08-11,Estorno de Compra,-15.00"
    df = processar_fatura_universal(io.StringIO(csv_falso))
    
    assert len(df) == 1
    assert df.iloc[0]['valor'] == -15.00

def test_processar_nuconta_remove_pix_credito_falso():
    """Garante que a entrada artificial do Pix no Crédito seja morta na raiz."""
    csv_falso = "data,descrição,valor\n2026-08-01,Transferência recebida,900.00\n2026-08-02,Adição de Limite - Pix no Crédito,50.00\n2026-08-03,Compra no débito,-20.00"
    df = processar_fatura_universal(io.StringIO(csv_falso))
    
    assert len(df) == 2  # A linha do meio deve sumir
    # Verifica se os valores reais foram mantidos intactos
    assert df[df['descricao'] == 'Transferência recebida'].iloc[0]['valor'] == 900.00
    assert df[df['descricao'] == 'Compra no débito'].iloc[0]['valor'] == -20.00

def test_formato_invalido_gera_erro():
    """Garante que tentar upar um CSV do Banco do Brasil ou planilha errada gere erro."""
    csv_falso = "coluna1,coluna2,coluna3\n1,2,3"
    with pytest.raises(ValueError, match="Formato de CSV não reconhecido"):
        processar_fatura_universal(io.StringIO(csv_falso))