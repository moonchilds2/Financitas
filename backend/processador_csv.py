import pandas as pd
import re
import warnings

warnings.filterwarnings("ignore")

def limpar_descricao_nuconta(texto):
    if "Valor adicionado na conta por cartão de crédito" in texto: return "Adição de Limite - Pix no Crédito"
    
    match_pix_completo = re.search(r'Pix - (.*?) - (?:•••|\d{2}\.)', texto)
    if match_pix_completo: return match_pix_completo.group(1).strip()
    
    match_pix_curto = re.search(r'Transferência (?:enviada|recebida) pelo Pix - (.*?) \(', texto)
    if match_pix_curto: return match_pix_curto.group(1).strip()
    
    # --- NOVA REGRA PARA LIMPAR TRANSFERÊNCIAS COMUNS (NÃO-PIX) ---
    match_transf = re.search(r'Transferência Recebida - (.*?) - (?:•••|\d{2}\.)', texto, re.IGNORECASE)
    if match_transf: return match_transf.group(1).strip()
    
    if "Compra no débito - " in texto: return texto.replace("Compra no débito - ", "").strip()
    return texto.strip()

def limpar_descricao_cartao(texto):
    """Limpa descrições ruidosas e consolida taxas exclusivas do Cartão de Crédito."""
    # 1. Extrai quem é o recebedor e o tipo de taxa (Multa, IOF ou Juros) de Pix no Crédito
    match_taxas = re.search(r'(Multa|IOF|Juros) de atraso do Pix no crédito para (.*)', texto)
    if match_taxas:
        tipo_taxa = match_taxas.group(1).strip()
        recebedor = match_taxas.group(2).strip()
        return f"{tipo_taxa} Atraso - {recebedor}"
        
    # 2. REMOÇÃO DE PREFIXOS INÚTEIS (O Segredo para a IA acertar mais)
    # Remove textos como "Pix no Crédito - ", "Compra no débito - ", "Pagamento - " do início da frase
    texto = re.sub(r'(?i)^(pix no cr[eé]dito - |compra [a-z\s]* - |pagamento - )', '', texto)
    
    return texto.strip()

def processar_fatura_universal(caminho_ou_buffer):
    df = pd.read_csv(caminho_ou_buffer)
    df.columns = [col.lower() for col in df.columns]
    
    if 'title' in df.columns and 'amount' in df.columns:
        df = df.rename(columns={'date': 'data_compra', 'title': 'descricao', 'amount': 'valor'})
        df['origem'] = 'Cartao'
        if df['valor'].dtype == 'O':  # 'O' significa Object (Texto) no Pandas
            df['valor'] = df['valor'].str.replace(' ', '', regex=False).str.replace('.', '', regex=False).str.replace(',', '.').astype(float)
        else:
            df['valor'] = df['valor'].astype(float)
        
        df = df[df['valor'] > 0].copy()
        df['valor'] = df['valor'] * -1
        
        padrao_parcela = r'(?:\s*-\s*Parcela\s*|\s+)(\d+)/(\d+)$'
        df['eh_parcelado'] = df['descricao'].str.contains(r'(?:\s*-\s*Parcela\s*|\s+)\d+/\d+$', regex=True)
        
        extraidos = df['descricao'].str.extract(padrao_parcela)
        df['parcela_atual'] = extraidos[0].fillna(0).astype(int)
        df['total_parcelas'] = extraidos[1].fillna(0).astype(int)
        
        df['descricao_limpa'] = df['descricao'].str.replace(padrao_parcela, '', regex=True).apply(limpar_descricao_cartao)

    elif 'descrição' in df.columns and 'valor' in df.columns:
        df = df.rename(columns={'data': 'data_compra', 'descrição': 'descricao'})
        df['origem'] = 'ContaCorrente'
        df['valor'] = df['valor'].astype(float)
        df['descricao_limpa'] = df['descricao'].apply(limpar_descricao_nuconta)

        # Ignorar o pagamento da fatura e saldos pendentes para não duplicar/inflar dados
        df = df[~df['descricao'].str.contains('Pagamento de fatura', case=False, na=False)].copy()
        df = df[~df['descricao'].str.contains('Valor pendente do mês anterior', case=False, na=False)].copy()
        
        df = df[df['descricao'] != 'Pagamento de fatura'].copy()
        
        # --- SOLUÇÃO PIX NO CRÉDITO ---
        # Ignorar a entrada de dinheiro falsa para não inflar a Receita Base!
        df = df[~df['descricao_limpa'].str.contains('Adição de Limite - Pix no Crédito', na=False, case=False)].copy()
        
        df['eh_parcelado'] = False
        df['parcela_atual'] = 0
        df['total_parcelas'] = 0
    else:
        raise ValueError("Formato de CSV não reconhecido. Certifique-se de que é do Nubank.")

    return df