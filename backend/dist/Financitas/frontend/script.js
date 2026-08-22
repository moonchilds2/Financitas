// APLICA CONFIGURAÇÕES GLOBAIS INSTANTANEAMENTE
if (localStorage.getItem('financitas_tema') === 'light') {
    document.documentElement.classList.add('light-mode');
}
if (localStorage.getItem('financitas_privacidade') === 'ativo') {
    document.documentElement.classList.add('modo-privado');
}

/* =========================================
   SISTEMA GLOBAL DE ALERTAS E CONFIRMAÇÃO
========================================= */
window.mostrarAlerta = function(mensagem, tipo = 'aviso', titulo = null) {
    const modal = document.getElementById('custom-alert');
    if (!modal) {
        console.warn(mensagem);
        return;
    }

    const msgEl = document.getElementById('alert-message');
    const iconEl = document.getElementById('alert-icon');
    const titleEl = document.getElementById('alert-title');

    msgEl.textContent = mensagem;

    if (tipo === 'sucesso') {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        iconEl.className = 'alerta-icone sucesso';
        titleEl.textContent = titulo || 'Sucesso!';
    } else if (tipo === 'erro') {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
        iconEl.className = 'alerta-icone erro';
        titleEl.textContent = titulo || 'Ops, algo deu errado!';
    } else {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
        iconEl.className = 'alerta-icone aviso';
        titleEl.textContent = titulo || 'Atenção';
    }

    modal.classList.add('show');
};

window.fecharAlerta = function() {
    const modal = document.getElementById('custom-alert');
    if (modal) modal.classList.remove('show');
};

// Interceptador Global de Alertas
window.alert = function(mensagem) {
    let tipo = 'aviso';
    const msgLower = mensagem.toLowerCase();
    
    // Identifica sucesso e erro pelas palavras da frase
    if (msgLower.includes('erro') || msgLower.includes('falha') || msgLower.includes('já existe')) {
        tipo = 'erro';
    } else if (msgLower.includes('sucesso') || msgLower.includes('salv') || msgLower.includes('pronto') || msgLower.includes('apagad') || msgLower.includes('limpo')) {
        tipo = 'sucesso';
    }
    window.mostrarAlerta(mensagem, tipo);
};

// Variável para guardar o que o sistema deve fazer se o usuário disser "Sim"
let acaoConfirmacaoGlobal = null;

window.mostrarConfirm = function(mensagem, callbackAcao) {
    const modal = document.getElementById('custom-confirm');
    
    // Fallback: se a página não tiver o HTML do modal, usa o confirm nativo
    if (!modal) {
        if (window.confirm(mensagem)) callbackAcao();
        return;
    }

    document.getElementById('confirm-message').textContent = mensagem;
    acaoConfirmacaoGlobal = callbackAcao;
    modal.classList.add('show');
};

window.fecharConfirm = function(confirmado) {
    const modal = document.getElementById('custom-confirm');
    if (modal) modal.classList.remove('show');
    
    // 1. Salva a ação pendente em uma variável temporária
    const acaoPendente = acaoConfirmacaoGlobal;
    
    // 2. Limpa a memória global IMEDIATAMENTE (antes de executar)
    acaoConfirmacaoGlobal = null; 
    
    // 3. Executa a ação (se isso abrir um 2º modal, ele gravará na global limpa com segurança)
    if (confirmado && acaoPendente) {
        acaoPendente();
    }
};


/* =========================================
   LÓGICA EXCLUSIVA DA DASHBOARD (INDEX)
========================================= */
document.addEventListener("DOMContentLoaded", () => {
    
    // TRAVA DE SEGURANÇA CORRIGIDA: 
    // Se a página não tiver os gráficos, interrompe a leitura do arquivo aqui!
    if (!document.getElementById('graficoCategorias')) return;

    // ==========================================
    // 1. CONFIGURAÇÕES INICIAIS E VARIÁVEIS
    // ==========================================
    Chart.defaults.font.family = "'Poppins', sans-serif";
    const formatBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    // Variáveis de Estado Global
    let dadosAtuais = [];
    let categoriaMeta = {};
    let categoriasNomes = [];
    let metasAtuaisGlobais = [];
    let transacoesGlobais = [];
    
    // Instâncias de Gráficos
    let graficoInstancia = null; 
    let graficoEvolucaoInstancia = null;
    let chartFixos = null;
    let chartVolateis = null;
    let chartAmbos = null;

    // Elementos DOM 
    const fileInput = document.getElementById('arquivo-csv');
    const fileNameDisplay = document.getElementById('file-name-display');
    const btnProcessar = document.getElementById('btn-processar');
    const btnSalvar = document.getElementById('btn-salvar');
    const btnCancelarRevisao = document.getElementById('btn-cancelar-revisao');
    const spinner = document.getElementById('loading-spinner');
    const modalRevisao = document.getElementById('modal-revisao');
    const listaIncertos = document.getElementById('lista-incertos');
    const selectMesGlobal = document.getElementById('dropdown-mes-container');
    const listaClassificados = document.getElementById('lista-classificados');
    const mediaConfianca = document.getElementById('media-confianca');
    const resultadosSection = document.getElementById('resultados-section');

    // ==========================================
    // 2. INICIALIZAÇÃO DO SISTEMA
    // ==========================================
    async function inicializarSistema() {
        try {
            const res = await fetch("http://localhost:8000/gestao-categorias");
            const data = await res.json();
            
            data.categorias.forEach(c => {
                categoriaMeta[c.nome] = { icone: c.icone || 'fa-tag', cor: c.cor || '#8D99AE' };
                categoriasNomes.push(c.nome);
            });
            
            carregarResumo();
            carregarHistorico();
        } catch(e) {
            console.error("Erro ao carregar categorias dinâmicas", e);
        }
    }

    function criarBadgeCategoria(catName, isOption = false) {
        const meta = categoriaMeta[catName] || { icone: 'fa-tag', cor: '#8D99AE' };
        const bgColor = meta.cor + '25'; 
        const textColor = meta.cor;
        const setaHTML = !isOption ? `<i class="fa-solid fa-chevron-down custom-chevron"></i>` : '';
        
        return `
            <div class="cat-badge ${isOption ? 'cat-option' : ''}" data-value="${catName}" style="background-color: ${bgColor}; color: ${textColor}; border: 1px solid ${textColor};">
                <div><i class="fa-solid ${meta.icone}"></i> <span>${catName}</span></div>${setaHTML}
            </div>
        `;
    }

    // ==========================================
    // 3. EVENTOS DE INTERFACE E DROPDOWNS
    // ==========================================
    document.addEventListener('click', (e) => {
        // Controle de Fechamento de Dropdowns
        if (!e.target.closest('.custom-select')) {
            document.querySelectorAll('.select-dropdown').forEach(d => d.classList.add('hidden'));
        } else {
            const trigger = e.target.closest('.select-trigger');
            if (trigger) {
                const dropdown = trigger.nextElementSibling;
                const isHidden = dropdown.classList.contains('hidden');
                document.querySelectorAll('.select-dropdown').forEach(d => d.classList.add('hidden')); 
                if (isHidden) dropdown.classList.remove('hidden'); 
            }
            
            // Seleção de Categoria na Revisão
            const optionCat = e.target.closest('.cat-option');
            if (optionCat) {
                const customSelect = optionCat.closest('.custom-select');
                const catName = optionCat.getAttribute('data-value');
                customSelect.setAttribute('data-selected', catName);
                customSelect.querySelector('.select-trigger').innerHTML = criarBadgeCategoria(catName, false);
                customSelect.querySelector('.select-dropdown').classList.add('hidden');
            }

            // Seleção de Mês no Dashboard
            const optionMonth = e.target.closest('.month-option');
            if (optionMonth) {
                const customSelect = optionMonth.closest('.custom-select');
                const valMes = optionMonth.getAttribute('data-value');
                const labelMes = optionMonth.innerText;
                
                customSelect.setAttribute('data-selected', valMes);
                document.getElementById('mes-selecionado-texto').innerText = labelMes;
                customSelect.querySelector('.select-dropdown').classList.add('hidden');
                
                carregarResumo(valMes);
            }
        }

        // Botão Rápido: Marcar como Indefinida (Upload)
        const btnIgnorar = e.target.closest('.btn-ignorar');
        if (btnIgnorar) {
            const idx = btnIgnorar.getAttribute('data-index');
            const customSelect = document.querySelector(`.custom-select[data-index="${idx}"]`);
            if (customSelect) {
                customSelect.setAttribute('data-selected', 'Indefinida');
                customSelect.querySelector('.select-trigger').innerHTML = criarBadgeCategoria('Indefinida', false);
                const checkTreino = document.querySelector(`.check-treino[data-index="${idx}"]`);
                if (checkTreino) checkTreino.checked = false;
            }
        }

        // Botão Rápido: Marcar como Indefinida (Histórico)
        const btnIgnorarHist = e.target.closest('.btn-ignorar-hist');
        if (btnIgnorarHist) {
            const id = btnIgnorarHist.getAttribute('data-id');
            const customSelect = document.querySelector(`.select-historico[data-id="${id}"]`);
            if (customSelect) {
                customSelect.setAttribute('data-selected', 'Indefinida');
                customSelect.querySelector('.select-trigger').innerHTML = criarBadgeCategoria('Indefinida', false);
                const checkTreino = document.querySelector(`.check-treino-hist[data-id="${id}"]`);
                if (checkTreino) checkTreino.checked = false;
            }
        }
    });

    // ==========================================
    // 4. UPLOAD E PROCESSAMENTO (IA)
    // ==========================================
    fileInput.addEventListener('change', (e) => {
        if(e.target.files.length > 0) {
            fileNameDisplay.textContent = e.target.files[0].name;
        }
    });

    btnProcessar.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) { 
            alert("Selecione um arquivo CSV primeiro."); 
            return; 
        }
        
        spinner.classList.remove('hidden'); 
        if (resultadosSection) resultadosSection.classList.add('hidden'); 
        btnProcessar.disabled = true;

        const formData = new FormData(); 
        formData.append("arquivo", file);
        
        try {
            const response = await fetch("http://localhost:8000/upload", { method: "POST", body: formData });
            if (!response.ok) throw new Error("Erro no servidor.");
            
            const data = await response.json();
            dadosAtuais = data.transacoes.map(t => { t.usar_para_treino = true; return t; });
            renderizarResultados(dadosAtuais);
        } catch (error) { 
            alert("Erro: " + error.message); 
        } finally { 
            spinner.classList.add('hidden'); 
            btnProcessar.disabled = false; 
        }
    });

    async function renderizarResultados(transacoes) {
        if (listaClassificados) listaClassificados.innerHTML = ''; 
        if (listaIncertos) listaIncertos.innerHTML = '';
        
        let classificados = [];
        let incertos = [];
        let somaConfianca = 0;

        transacoes.forEach((t, index) => {
            const certeza = t.certeza_algoritmo || 0;
            const confiancaMinima = (localStorage.getItem('financitas_ia_confianca') || 75) / 100;
            const precisaRevisao = (certeza < confiancaMinima || t.categoria_sugerida === 'Indefinida');
            
            if (!precisaRevisao) {
                classificados.push(t); 
                somaConfianca += certeza;
                if (listaClassificados) listaClassificados.appendChild(criarCardTransacao(t, false, index));
            } else {
                incertos.push(t);
                if (listaIncertos) listaIncertos.appendChild(criarCardTransacao(t, true, index));
            }
        });

        if (classificados.length > 0 && mediaConfianca) {
            mediaConfianca.textContent = `${((somaConfianca / classificados.length) * 100).toFixed(1)}% precisão média`;
        } else if (mediaConfianca && listaClassificados) {
            mediaConfianca.textContent = '';
            listaClassificados.innerHTML = '<p class="empty-ai-msg">Nenhum gasto automático. A IA aprenderá com as suas confirmações.</p>';
        }

        if (incertos.length > 0) {
            modalRevisao.classList.remove('hidden');
        } else {
            try {
                const response = await fetch("http://localhost:8000/confirm", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ transacoes: dadosAtuais })
                });
                if (!response.ok) throw new Error("Erro no servidor.");
                alert("Fatura totalmente processada e salva com sucesso pela Inteligência Artificial!");
                
                document.getElementById('dropdown-mes-container').removeAttribute('data-loaded'); 
                carregarResumo(); 
                carregarHistorico();
                fileInput.value = ''; 
                fileNameDisplay.textContent = 'Escolher Arquivo CSV';
                dadosAtuais = [];
            } catch (error) {
                alert("Erro ao salvar dados processados automaticamente: " + error.message);
            }
        }
    }

    function criarCardTransacao(t, precisaRevisao, index) {
        const div = document.createElement('div'); 
        div.className = 'transacao-card';
        
        const meta = categoriaMeta[t.categoria_sugerida] || categoriaMeta['Indefinida'];
        const valorFormatado = formatBRL.format(t.valor);
        const classeCorValor = t.valor > 0 ? 'text-green' : (t.valor < 0 ? 'text-red' : '');

        let htmlBase = `
            <div class="transacao-info">
                <i class="fa-solid ${meta.icone}" style="color: ${meta.cor}; font-size: 1.5rem; text-shadow: 0 0 8px ${meta.cor}40;"></i>
                <div class="transacao-detalhes">
                    <strong>${t.descricao_limpa}</strong>
                    <span>${t.data_compra} ${t.eh_parcelado ? `<br><i>(Parcela ${t.parcela_atual}/${t.total_parcelas})</i>` : ''}</span>
                    <strong class="valor-transacao ${classeCorValor}">${valorFormatado}</strong>
                </div>
            </div>`;

        let htmlControles = '';
        const porcentagem = (t.certeza_algoritmo * 100).toFixed(1);

        if (precisaRevisao) {
            const options = categoriasNomes.map(cat => criarBadgeCategoria(cat, true)).join('');
            
            let palpiteHtml = '';
            if (t.categoria_sugerida !== 'Indefinida' && t.certeza_algoritmo > 0) {
                palpiteHtml = `<div style="margin-bottom: 10px;"><span class="badge-ia" style="border-color: #F1C40F; color: #F1C40F;"><i class="fa-solid fa-robot"></i> Palpite da IA: ${t.categoria_sugerida} (${porcentagem}%)</span></div>`;
            } else {
                palpiteHtml = `<div style="margin-bottom: 10px;"><span class="badge-ia" style="border-color: var(--danger); color: var(--danger);"><i class="fa-solid fa-robot"></i> IA sem dados suficientes (0%)</span></div>`;
            }

            htmlControles = `
                <div class="revisao-controles">
                    ${palpiteHtml}
                    <div class="flex-between" style="width: 100%; gap: 10px;">
                        <div class="custom-select" data-index="${index}" data-selected="${t.categoria_sugerida}" style="flex: 1;">
                            <div class="select-trigger">${criarBadgeCategoria(t.categoria_sugerida, false)}</div>
                            <div class="select-dropdown hidden">${options}</div>
                        </div>
                        <button type="button" class="btn-ignorar" data-index="${index}" title="Marcar como Indefinida">
                            <i class="fa-solid fa-eye-slash"></i>
                        </button>
                    </div>
                    <div class="toggle-container">
                        <label class="switch">
                            <input type="checkbox" class="check-treino" data-index="${index}" checked>
                            <span class="slider round"></span>
                        </label>
                        <span class="toggle-label">Treinar IA</span>
                    </div>
                </div>`;
        } else {
            const bgColor = meta.cor + '25';
            htmlControles = `
                <div class="transacao-valores ai-values">
                    <div class="cat-badge ai-badge" style="background-color: ${bgColor}; color: ${meta.cor}; border: 1px solid ${meta.cor};">
                        <div><i class="fa-solid ${meta.icone}"></i> <span>${t.categoria_sugerida}</span></div>
                    </div>
                    <span class="ai-confidence">Confiança: ${porcentagem}%</span>
                </div>`;
        }
        
        div.innerHTML = htmlBase + htmlControles; 
        return div;
    }

    if (btnSalvar) {
        btnSalvar.addEventListener('click', async () => {
            document.querySelectorAll('.custom-select[data-index]').forEach(select => {
                const idx = select.getAttribute('data-index');
                dadosAtuais[idx].categoria_revisada = select.getAttribute('data-selected');
            });
            
            document.querySelectorAll('.check-treino').forEach(check => {
                const idx = check.getAttribute('data-index');
                dadosAtuais[idx].usar_para_treino = check.checked;
            });

            const originalText = btnSalvar.innerHTML;
            btnSalvar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...';
            btnSalvar.disabled = true;

            try {
                const response = await fetch("http://localhost:8000/confirm", {
                    method: "POST", 
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ transacoes: dadosAtuais })
                });
                
                if (!response.ok) throw new Error("Erro no servidor.");
                alert("Fatura salva com sucesso!");

                document.getElementById('dropdown-mes-container').removeAttribute('data-loaded'); 
                carregarResumo(); 
                carregarHistorico();
                modalRevisao.classList.add('hidden');
                if (resultadosSection) resultadosSection.classList.remove('hidden');
                
                fileInput.value = ''; 
                fileNameDisplay.textContent = 'Escolher Arquivo CSV';
                dadosAtuais = []; 
            } catch (error) { 
                alert("Erro: " + error.message); 
            } finally { 
                btnSalvar.innerHTML = originalText; 
                btnSalvar.disabled = false; 
            }
        });
    }

    if (btnCancelarRevisao) {
        btnCancelarRevisao.addEventListener('click', () => {
            modalRevisao.classList.add('hidden');
            fileInput.value = ''; 
            fileNameDisplay.textContent = 'Escolher Arquivo CSV';
            dadosAtuais = []; 
            if (resultadosSection) resultadosSection.classList.add('hidden');
        });
    }

    // ==========================================
    // 5. RENDERIZAÇÃO DO DASHBOARD E GRÁFICOS
    // ==========================================
    async function carregarResumo(mesFiltro = null) {
        try {
            let url = "http://localhost:8000/resumo";
            if (mesFiltro) url += `?mes_filtro=${mesFiltro}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error("Erro ao carregar resumo");
            const data = await response.json();

            const listaMesesHtml = document.getElementById('lista-meses-opcoes');
            const textoMesSelecionado = document.getElementById('mes-selecionado-texto');

            if (!selectMesGlobal.getAttribute('data-loaded') && data.meses_disponiveis.length > 0) {
                listaMesesHtml.innerHTML = data.meses_disponiveis.map(m => 
                    `<div class="month-option" data-value="${m.value}">${m.label}</div>`
                ).join('');
                
                const mesAtivoObj = data.meses_disponiveis.find(m => m.value === data.mes_atual);
                if (mesAtivoObj) textoMesSelecionado.innerText = mesAtivoObj.label;
                
                selectMesGlobal.setAttribute('data-loaded', 'true');
                selectMesGlobal.setAttribute('data-selected', data.mes_atual);
            }

            metasAtuaisGlobais = data.todas_metas;

            if (document.getElementById('receita-total')) {
                document.getElementById('receita-total').textContent = formatBRL.format(data.receita_total);
                document.getElementById('gasto-total').textContent = formatBRL.format(data.gasto_total);
                document.getElementById('saldo-previsto').textContent = formatBRL.format(data.saldo_previsto);
            }

            desenharGrafico(data.grafico_dados);
            desenharGraficoEvolucao(data.evolucao_mensal);
            carregarRadar(mesFiltro || data.mes_atual);

            const listaTop5 = document.getElementById('lista-top5');
            if (listaTop5) {
                if(data.top_5_gastos.length === 0) {
                    listaTop5.innerHTML = '<p class="empty-list-msg">Sem gastos neste mês.</p>';
                } else {
                    listaTop5.innerHTML = data.top_5_gastos.map(item => `
                        <div class="top5-item">
                            <div class="top5-info">
                                <strong>${item.descricao}</strong>
                                <span>${item.data} • ${item.categoria}</span>
                            </div>
                            <span class="top5-valor">${formatBRL.format(item.valor)}</span>
                        </div>
                    `).join('');
                }
            }

            const listaOrcamentos = document.getElementById('lista-orcamentos');
            if (listaOrcamentos) {
                if (data.progresso_orcamento.length === 0) {
                    listaOrcamentos.innerHTML = '<p class="empty-list-msg margin-top-10">Nenhuma meta definida.</p>';
                } else {
                    listaOrcamentos.innerHTML = data.progresso_orcamento.map(orc => {
                        let corBarra = 'var(--success)';
                        if (orc.porcentagem > 100) corBarra = 'var(--danger)';
                        else if (orc.porcentagem > 80) corBarra = '#F1C40F';
                        
                        const larguraVisual = Math.min(orc.porcentagem, 100);
                        
                        return `
                            <div class="orcamento-item">
                                <div class="orcamento-header">
                                    <span>${orc.categoria}</span>
                                    <span>${formatBRL.format(orc.gasto)} / ${formatBRL.format(orc.limite)}</span>
                                </div>
                                <div class="orcamento-track">
                                    <div class="orcamento-fill" style="width: ${larguraVisual}%; background-color: ${corBarra};"></div>
                                </div>
                                <span class="orcamento-footer-text">${orc.porcentagem}% utilizado</span>
                            </div>
                        `;
                    }).join('');
                }
            }
        } catch (error) { 
            console.error("Erro no resumo:", error); 
        }
    }

    function desenharGrafico(dados) {
        const ctx = document.getElementById('graficoCategorias');
        if (!ctx || dados.length === 0) return;

        const labels = dados.map(d => d.categoria);
        const valores = dados.map(d => d.total);
        const cores = labels.map(label => categoriaMeta[label] ? categoriaMeta[label].cor : '#8D99AE');

        if (graficoInstancia) graficoInstancia.destroy();
        
        graficoInstancia = new Chart(ctx, {
            type: 'doughnut',
            data: { 
                labels: labels, 
                datasets: [{ data: valores, backgroundColor: cores, borderWidth: 0, hoverOffset: 10 }] 
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                layout: { padding: { top: 15, bottom: 15, left: 10, right: 10 } },
                plugins: {
                    legend: { 
                        position: 'right', 
                        labels: { 
                            padding: 15,
                            font: { family: "'Poppins', sans-serif", size: 12, weight: '600' },
                            usePointStyle: true,
                            pointStyle: 'circle'
                        } 
                    },
                    tooltip: { 
                        callbacks: { 
                            label: function(context) { 
                                return ' R$ ' + context.raw.toFixed(2).replace('.', ','); 
                            } 
                        } 
                    }
                }
            }
        });
    }

    function desenharGraficoEvolucao(dados) {
        const ctx = document.getElementById('graficoEvolucao');
        if (!ctx || dados.length === 0) return;

        const labels = dados.map(d => d.mes.split('/')[0] + '/' + d.mes.split('/')[1].slice(-2));
        const receitas = dados.map(d => d.receita);
        const gastos = dados.map(d => d.gasto);

        if (graficoEvolucaoInstancia) graficoEvolucaoInstancia.destroy();
        
        graficoEvolucaoInstancia = new Chart(ctx, {
            type: 'bar',
            data: { 
                labels: labels, 
                datasets: [
                    { label: 'Receitas', data: receitas, backgroundColor: '#2ECC71', borderRadius: 4 },
                    { label: 'Despesas', data: gastos, backgroundColor: '#FF4D4D', borderRadius: 4 }
                ] 
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false } } }
        });
    }

    async function carregarRadar(mesFiltro) {
        try {
            const response = await fetch(`http://localhost:8000/radar-gastos?mes_filtro=${mesFiltro}`);
            if (!response.ok) return;
            const data = await response.json();

            document.querySelectorAll('.radar-receita-sub').forEach(el => {
                el.innerHTML = `Receita Base: <strong class="text-green">${formatBRL.format(data.receita_base)}</strong>`;
            });

            // RESTAURANDO AS CHAMADAS DOS GRÁFICOS
            desenharRadarPizza('graficoRadarFixos', chartFixos, 
                ['Gastos Fixos', 'Receita Livre'], [data.fixos.gasto, data.fixos.livre], ['#E74C3C', '#2ECC71']);
            
            desenharRadarPizza('graficoRadarVolateis', chartVolateis, 
                ['Gastos Voláteis', 'Receita Livre'], [data.volateis.gasto, data.volateis.livre], ['#F1C40F', '#2ECC71']);

            desenharRadarPizza('graficoRadarAmbos', chartAmbos, 
                ['Fixos', 'Voláteis', 'Receita Livre'], [data.ambos.fixo, data.ambos.volatil, data.ambos.livre], ['#E74C3C', '#F1C40F', '#2ECC71']);

        } catch (error) { 
            console.error("Erro no Radar:", error); 
        }
    }

    // RESTAURANDO O "PINTOR" DOS GRÁFICOS
    function desenharRadarPizza(canvasId, chartVar, labels, valores, cores) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        const soma = valores.reduce((a, b) => a + b, 0);
        if (soma === 0) {
            labels = ['Sem Receita neste mês']; 
            valores = [1]; 
            cores = ['#3C096C'];
        }

        const config = {
            type: 'pie',
            data: { 
                labels: labels, 
                datasets: [{ data: valores, backgroundColor: cores, borderWidth: 0, hoverOffset: 12 }] 
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                layout: { padding: { top: 15, bottom: 15, left: 15, right: 15 } },
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        onHover: function(e) { e.native.target.style.cursor = 'pointer'; },
                        onLeave: function(e) { e.native.target.style.cursor = 'default'; },
                        labels: { 
                            padding: 15, 
                            font: { family: "'Poppins', sans-serif", size: 12, weight: '600' }
                        } 
                    },
                    tooltip: { 
                        callbacks: { 
                            label: function(context) { 
                                if(soma === 0) return ' Sem dados';
                                return ' R$ ' + context.raw.toFixed(2).replace('.', ','); 
                            } 
                        } 
                    }
                }
            }
        };

        if(canvasId === 'graficoRadarFixos') { if(chartFixos) chartFixos.destroy(); chartFixos = new Chart(ctx, config); }
        if(canvasId === 'graficoRadarVolateis') { if(chartVolateis) chartVolateis.destroy(); chartVolateis = new Chart(ctx, config); }
        if(canvasId === 'graficoRadarAmbos') { if(chartAmbos) chartAmbos.destroy(); chartAmbos = new Chart(ctx, config); }
    }

    // ==========================================
    // 6. METAS DE ORÇAMENTO E HISTÓRICO
    // ==========================================
    const modalOrcamentos = document.getElementById('modal-orcamentos');
    const btnEditarOrcamentos = document.getElementById('btn-editar-orcamentos');
    const btnFecharOrcamentos = document.getElementById('btn-fechar-orcamentos');
    const btnSalvarOrcamentos = document.getElementById('btn-salvar-orcamentos');
    const formOrcamentos = document.getElementById('form-orcamentos');

    if (btnEditarOrcamentos) {
        btnEditarOrcamentos.addEventListener('click', () => {
            formOrcamentos.innerHTML = metasAtuaisGlobais.map(m => {
                const meta = categoriaMeta[m.categoria] || categoriaMeta['Indefinida'];
                return `
                    <div class="orcamento-edit-item">
                        <div class="budget-item-name">
                            <i class="fa-solid ${meta.icone}" style="color: ${meta.cor};"></i>
                            <span>${m.categoria}</span>
                        </div>
                        <div class="budget-item-input">
                            <span class="text-muted">R$</span>
                            <input type="number" step="0.01" class="input-orcamento" data-cat="${m.categoria}" value="${m.limite}">
                        </div>
                    </div>
                `;
            }).join('');
            modalOrcamentos.classList.remove('hidden');
        });
    }

    if (btnFecharOrcamentos) btnFecharOrcamentos.addEventListener('click', () => modalOrcamentos.classList.add('hidden'));

    if (btnSalvarOrcamentos) {
        // Trava para o "Enter" não recarregar a página
        if (formOrcamentos) {
            formOrcamentos.addEventListener('submit', (e) => e.preventDefault());
        }

        btnSalvarOrcamentos.addEventListener('click', async (e) => {
            e.preventDefault(); 

            // CORREÇÃO 1: Procura inputs APENAS dentro do modal de orçamentos
            const inputs = document.querySelectorAll('#form-orcamentos .input-orcamento');
            
            const novosOrcamentos = [];
            inputs.forEach(input => {
                const categoriaNome = input.getAttribute('data-cat');
                
                // CORREÇÃO 2: Só adiciona na lista se a categoria não for nula/vazia
                if (categoriaNome) {
                    novosOrcamentos.push({
                        categoria: categoriaNome, 
                        limite: parseFloat(input.value) || 0
                    });
                }
            });

            const original = btnSalvarOrcamentos.innerHTML;
            btnSalvarOrcamentos.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
            btnSalvarOrcamentos.disabled = true;

            try {
                const response = await fetch("http://localhost:8000/orcamentos", {
                    method: "PUT", 
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orcamentos: novosOrcamentos })
                });

                if(!response.ok) {
                    const err = await response.json();
                    
                    // CORREÇÃO 3: Desmonta o erro Array do FastAPI para não mostrar [object Object]
                    let msgErro = "Valores inválidos enviados.";
                    if (typeof err.detail === 'string') {
                        msgErro = err.detail;
                    } else if (Array.isArray(err.detail)) {
                        msgErro = "Erro de validação na API: " + err.detail[0].msg;
                    }
                    
                    window.mostrarAlerta(msgErro, "erro");
                    return;
                }
                
                modalOrcamentos.classList.add('hidden');
                const mesAtual = document.getElementById('dropdown-mes-container').getAttribute('data-selected') || null;
                carregarResumo(mesAtual); 
                window.mostrarAlerta("Metas atualizadas com sucesso!", "sucesso");
                
            } catch(erro) { 
                window.mostrarAlerta("Erro de conexão: O servidor (main.py) está rodando?", "erro");
            } finally { 
                btnSalvarOrcamentos.innerHTML = original; 
                btnSalvarOrcamentos.disabled = false; 
            }
        });
    }

    // --- Lógica do Histórico e Filtros ---
    const listaHistorico = document.getElementById('lista-historico');
    const btnAtualizarHistorico = document.getElementById('btn-atualizar-historico');
    const btnFiltros = document.querySelectorAll('.btn-filtro');

    async function carregarHistorico() {
        if (!listaHistorico) return;
        try {
            const response = await fetch("http://localhost:8000/transacoes");
            if (!response.ok) return;
            const data = await response.json();
            transacoesGlobais = data.transacoes;
            renderizarHistorico('todos');
        } catch (error) { 
            console.error("Erro ao carregar histórico:", error); 
        }
    }

    if (btnFiltros) {
        btnFiltros.forEach(btn => {
            btn.addEventListener('click', (e) => {
                btnFiltros.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                renderizarHistorico(e.target.getAttribute('data-filter'));
            });
        });
    }

    function renderizarHistorico(filtro) {
        if (!listaHistorico) return;
        listaHistorico.innerHTML = '';
        
        const transacoesFiltradas = transacoesGlobais.filter(t => {
            if (filtro === 'ia') return !t.classificado_manualmente;
            if (filtro === 'manual') return t.classificado_manualmente;
            return true;
        });

        if (transacoesFiltradas.length === 0) {
            listaHistorico.innerHTML = '<p class="text-muted">Nenhuma transação encontrada para este filtro.</p>';
            return;
        }

        listaHistorico.classList.add('historico-grid');
        let mesCorrente = '';

        transacoesFiltradas.forEach(t => {
            const [ano, mes, dia] = t.data_compra.split('-');
            const dataObj = new Date(ano, mes - 1, dia); 
            let nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(dataObj);
            
            if (nomeMes !== mesCorrente) {
                const divisor = document.createElement('div');
                divisor.className = 'mes-divisor';
                divisor.innerHTML = `<span>${nomeMes}</span><hr>`;
                listaHistorico.appendChild(divisor);
                mesCorrente = nomeMes;
            }

            const div = document.createElement('div'); 
            div.className = 'transacao-card';
            
            const meta = categoriaMeta[t.categoria_atual] || categoriaMeta['Indefinida'];
            const dataFormatadaBR = `${dia}/${mes}/${ano}`;
            const valorFormatado = formatBRL.format(t.valor);
            const classeCorValor = t.valor > 0 ? 'text-green' : (t.valor < 0 ? 'text-red' : '');
            const options = categoriasNomes.map(cat => criarBadgeCategoria(cat, true)).join('');
            const isChecked = t.usar_para_treino ? 'checked' : '';

            const certezaValor = t.certeza_algoritmo ? (t.certeza_algoritmo * 100).toFixed(1) : 100;
            const legendaHtml = t.classificado_manualmente 
                ? `<span class="badge-manual"><i class="fa-solid fa-user-pen"></i> Ajuste Manual</span>`
                : `<span class="badge-ia"><i class="fa-solid fa-robot"></i> Confiança IA: ${certezaValor}%</span>`;

            div.innerHTML = `
                <div class="transacao-info">
                    <i class="fa-solid ${meta.icone}" style="color: ${meta.cor}; font-size: 1.5rem; text-shadow: 0 0 8px ${meta.cor}40;"></i>
                    <div class="transacao-detalhes">
                        <strong>${t.descricao_limpa}</strong><span>${dataFormatadaBR}</span>
                        <strong class="valor-transacao ${classeCorValor}">${valorFormatado}</strong>
                        <div>${legendaHtml}</div>
                    </div>
                </div>
                <div class="revisao-controles">
                    <div class="flex-between" style="width: 100%; gap: 10px;">
                        <div class="custom-select select-historico" data-id="${t.id}" data-selected="${t.categoria_atual}" style="flex: 1;">
                            <div class="select-trigger">${criarBadgeCategoria(t.categoria_atual, false)}</div>
                            <div class="select-dropdown hidden">${options}</div>
                        </div>
                        <button type="button" class="btn-ignorar-hist" data-id="${t.id}" title="Marcar como Indefinida">
                            <i class="fa-solid fa-eye-slash"></i>
                        </button>
                    </div>
                    <div class="toggle-container">
                        <label class="switch">
                            <input type="checkbox" class="check-treino-hist" data-id="${t.id}" ${isChecked}>
                            <span class="slider round"></span>
                        </label>
                        <span class="toggle-label">Treinar IA</span>
                    </div>
                </div>`;
            listaHistorico.appendChild(div);
        });
    }

    if (btnAtualizarHistorico) {
        btnAtualizarHistorico.addEventListener('click', async () => {
            const transacoesParaAtualizar = [];
            
            document.querySelectorAll('.select-historico').forEach((select, index) => {
                transacoesParaAtualizar.push({
                    id_transacao: parseInt(select.getAttribute('data-id')),
                    categoria_nova: select.getAttribute('data-selected'),
                    usar_para_treino: document.querySelectorAll('.check-treino-hist')[index].checked
                });
            });

            const originalText = btnAtualizarHistorico.innerHTML;
            btnAtualizarHistorico.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Atualizando...';
            btnAtualizarHistorico.disabled = true;

            try {
                const response = await fetch("http://localhost:8000/transacoes/atualizar", {
                    method: "PUT", 
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ transacoes: transacoesParaAtualizar })
                });

                if (!response.ok) throw new Error("Falha ao atualizar");
                alert("Histórico atualizado com sucesso!");
                
                const mesAtual = document.getElementById('dropdown-mes-container').getAttribute('data-selected') || null;
                carregarResumo(mesAtual); 
                carregarHistorico(); 
            } catch (error) { 
                alert("Erro ao atualizar: " + error.message); 
            } finally { 
                btnAtualizarHistorico.innerHTML = originalText; 
                btnAtualizarHistorico.disabled = false; 
            }
        });
    }

    // ==========================================
    // 7. DICIONÁRIO DA IA (HEURÍSTICAS)
    // ==========================================
    const modalHeuri = document.getElementById('modal-heuristicas');
    const heuriTela1 = document.getElementById('heuri-tela1');
    const heuriTela2 = document.getElementById('heuri-tela2');
    const gridCategoriasHeuri = document.getElementById('grid-categorias-heuri');
    const listaTagsHeuri = document.getElementById('lista-tags-heuri');
    let heuristicaCategoriaAtual = '';

    if (document.getElementById('btn-abrir-heuristicas')) {
        document.getElementById('btn-abrir-heuristicas').addEventListener('click', () => {
            gridCategoriasHeuri.innerHTML = categoriasNomes.map(cat => {
                const meta = categoriaMeta[cat] || { cor: '#FFF', icone: 'fa-tag' };
                return `
                    <button class="btn-heuri-cat" data-cat="${cat}" style="padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 10px; transition: border 0.2s;">
                        <i class="fa-solid ${meta.icone}" style="color: ${meta.cor};"></i> ${cat}
                    </button>
                `;
            }).join('');
            
            heuriTela1.classList.remove('hidden');
            heuriTela2.classList.add('hidden');
            modalHeuri.classList.remove('hidden');
        });
    }

    document.querySelectorAll('.btn-fechar-heuri').forEach(btn => {
        btn.addEventListener('click', () => modalHeuri.classList.add('hidden'));
    });

    if (document.getElementById('btn-voltar-heuri')) {
        document.getElementById('btn-voltar-heuri').addEventListener('click', () => {
            heuriTela2.classList.add('hidden');
            heuriTela1.classList.remove('hidden');
        });
    }

    if (gridCategoriasHeuri) {
        gridCategoriasHeuri.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-heuri-cat');
            if (!btn) return;
            
            heuristicaCategoriaAtual = btn.getAttribute('data-cat');
            document.getElementById('heuri-cat-nome').innerText = heuristicaCategoriaAtual;
            
            heuriTela1.classList.add('hidden');
            heuriTela2.classList.remove('hidden');
            await carregarTagsHeuristicas();
        });
    }

    async function carregarTagsHeuristicas() {
        listaTagsHeuri.innerHTML = '<p class="text-muted">Carregando...</p>';
        try {
            const res = await fetch("http://localhost:8000/heuristicas");
            const data = await res.json();
            const regrasDaCategoria = data.regras.filter(r => r.categoria === heuristicaCategoriaAtual);
            
            if (regrasDaCategoria.length === 0) {
                listaTagsHeuri.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">Nenhum atalho criado ainda.</p>';
            } else {
                listaTagsHeuri.innerHTML = regrasDaCategoria.map(r => `
                    <span style="background: var(--bg-color); border: 1px solid var(--primary-color); padding: 5px 10px; border-radius: 15px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                        ${r.palavra_chave} 
                        <i class="fa-solid fa-xmark" style="cursor: pointer; color: var(--danger);" onclick="deletarHeuristica(${r.id})"></i>
                    </span>
                `).join('');
            }
        } catch(e) { console.error(e); }
    }

    if (document.getElementById('btn-add-heuri')) {
        document.getElementById('btn-add-heuri').addEventListener('click', async () => {
            const input = document.getElementById('input-nova-heuri');
            const palavra = input.value.trim();
            if(!palavra) return;

            try {
                const res = await fetch("http://localhost:8000/heuristicas", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ palavra_chave: palavra, categoria: heuristicaCategoriaAtual })
                });
                if(res.ok) {
                    input.value = '';
                    carregarTagsHeuristicas();
                } else {
                    const err = await res.json();
                    alert(err.detail);
                }
            } catch(e) { console.error(e); }
        });
    }

    window.deletarHeuristica = async function(id) {
        try {
            const res = await fetch(`http://localhost:8000/heuristicas/${id}`, { method: "DELETE" });
            if(res.ok) carregarTagsHeuristicas();
        } catch(e) { console.error(e); }
    };

    // START
    inicializarSistema();
});