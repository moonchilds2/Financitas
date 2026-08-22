# 🚀 Financitas: Inteligência Financeira

O **Financitas** é um sistema de gestão financeira pessoal *local-first*, focado em privacidade absoluta e automação via Inteligência Artificial. Projetado para rodar de forma offline e independente, ele processa extratos bancários, aprende com os seus hábitos de consumo e categoriza gastos automaticamente.

---

## 📥 Como Baixar e Usar (Instalação Rápida)
Para utilizar o Financitas, você não precisa saber programação nem instalar o Python. Basta seguir os passos:

1. Clique no botão verde **"<> Code"** no topo desta página e selecione **"Download ZIP"**.
2. Extraia a pasta completa no seu computador (por exemplo, nos seus Documentos).
3. ⚠️ **Importante:** Mantenha a estrutura das pastas intacta. O executável precisa da pasta `frontend` ao lado dele para carregar o visual do sistema.
4. Navegue até a pasta onde o executável foi gerado (normalmente em `backend/dist/`) e dê um duplo clique no arquivo **`Financitas.exe`**.
5. O sistema abrirá automaticamente no seu navegador padrão e já estará pronto para uso.

---

## ⚙️ Como Usar (Guia de Recursos)
O fluxo de trabalho foi otimizado para exigir o mínimo de esforço manual:

*   **Upload Inteligente:** Exporte o arquivo `.csv` (extrato ou fatura) do seu banco e envie na tela inicial. O motor do sistema possui filtros automáticos para expurgar ruídos bancários (como pagamentos de faturas, juros e estornos).
*   **Revisão e Aprendizado Contínuo:** Transações com grau de confiança abaixo do limite exigido entram na esteira de "Revisão". Ao corrigir o palpite e confirmar, o algoritmo matemático é retreinado em tempo real com os seus dados.
*   **Dicionário da IA (Heurísticas):** Cadastre atalhos absolutos (ex: a palavra "Uber" sempre será "Transporte"). Essa regra será priorizada antes do cálculo estatístico da IA, poupando processamento.
*   **Radar de Sobrevivência:** Defina Metas de Orçamento nas configurações. Gráficos dinâmicos dividirão sua renda entre Custos Fixos, Estilo de Vida (Gastos Voláteis) e Receita Livre.
*   **Visão de Futuro (Metas):** Crie "cofrinhos" personalizados para objetivos de longo prazo e acompanhe a projeção estatística dos seus próximos meses com base no seu padrão de gastos.

---

## 🛠️ Tecnologias e Arquitetura
A ferramenta foi construída com uma separação clara de responsabilidades, garantindo alta performance:

*   **Motor de Inteligência Artificial:** `Scikit-Learn` (LinearSVC e TF-IDF Vectorizer processando N-Grams em linguagem natural).
*   **Backend & Processamento:** `Python`, `FastAPI` (API RESTful), `Pandas` (Limpeza e Regex) e `SQLite` (Banco de dados relacional embutido).
*   **Interface (Frontend):** Vanilla `JavaScript`, `HTML5`, `CSS3` puro e `Chart.js` para renderização fluida dos gráficos.
*   **Distribuição:** Empacotamento via `PyInstaller`.

---

## 🔒 Privacidade e Segurança
*   **Local-First:** O histórico de transações, senhas e o "cérebro" treinado da Inteligência Artificial residem **unicamente** no arquivo local da máquina do usuário. Nada vai para a nuvem.
*   **Modo Privacidade:** Interface adaptada com "Modo Oculto" nativo, ideal para mascarar valores financeiros ao acessar o aplicativo em ambientes públicos ou ao gravar a tela.
*   **Auditoria Zero:** O sistema opera de maneira offline, sem rastreadores, telemetria ou chamadas externas para servidores de terceiros.