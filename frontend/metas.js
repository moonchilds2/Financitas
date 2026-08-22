// APLICA CONFIGURAÇÕES GLOBAIS INSTANTANEAMENTE
if (localStorage.getItem('financitas_tema') === 'light') document.documentElement.classList.add('light-mode');
if (localStorage.getItem('financitas_privacidade') === 'ativo') document.documentElement.classList.add('modo-privado');

document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. VARIÁVEIS E INICIALIZAÇÃO
    // ==========================================
    Chart.defaults.font.family = "'Poppins', sans-serif";
    const formatBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const listaMetas = document.getElementById('lista-metas');
    
    let categoriaMeta = {};
    let metasArray = [];
    let chartProjecao = null;

    async function inicializarMetas() {
        try {
            const res = await fetch("http://localhost:8000/gestao-categorias");
            const data = await res.json();
            data.categorias.forEach(c => {
                categoriaMeta[c.nome] = { icone: c.icone || 'fa-tag', cor: c.cor || '#8D99AE' };
            });
            carregarProjecao();
            carregarMetas();
        } catch(e) { 
            console.error(e); 
        }
    }

    // ==========================================
    // 2. MOTOR PREDITIVO (GRÁFICO HORIZONTAL)
    // ==========================================
    async function carregarProjecao() {
        try {
            const res = await fetch("http://localhost:8000/projecao-gastos");
            if (!res.ok) return;
            const data = await res.json();

            document.getElementById('valor-projecao-total').textContent = formatBRL.format(data.projecao_total);

            const labels = data.categorias.map(c => c.categoria);
            const valores = data.categorias.map(c => c.projetado);
            const cores = labels.map(label => categoriaMeta[label] ? categoriaMeta[label].cor : '#8D99AE');

            const ctx = document.getElementById('graficoProjecao');
            if (!ctx || labels.length === 0) return;
            
            // Plugin: Linha de Segurança (Receita Média)
            const linhaReceitaPlugin = {
                id: 'linhaReceita',
                afterDraw: (chart) => {
                    if (data.receita_media <= 0) return;
                    const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
                    const lineX = x.getPixelForValue(data.receita_media);
                    
                    if (lineX >= chart.chartArea.left && lineX <= chart.chartArea.right) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.setLineDash([5, 5]); 
                        ctx.moveTo(lineX, top);
                        ctx.lineTo(lineX, bottom);
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = '#2ECC71'; 
                        ctx.stroke();
                        
                        ctx.fillStyle = '#2ECC71';
                        ctx.font = '600 11px Poppins';
                        ctx.textAlign = 'right';
                        ctx.fillText(`Receita Média: ${formatBRL.format(data.receita_media)}`, lineX - 8, top - 8);
                        ctx.restore();
                    }
                }
            };

            const corTexto = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#FFF';
            const corGrid = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#5A189A';
            const corLabels = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#E0AAFF';

            if (chartProjecao) chartProjecao.destroy();
            
            chartProjecao = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{ label: 'Gasto Previsto', data: valores, backgroundColor: cores, borderRadius: 6 }]
                },
                plugins: [linhaReceitaPlugin], 
                options: {
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                    layout: { padding: { top: 25, right: 15 } },
                    scales: {
                        x: { suggestedMax: data.receita_media > 0 ? data.receita_media * 1.2 : undefined, grid: { color: corGrid, drawBorder: false }, ticks: { color: corLabels } },
                        y: { grid: { display: false }, ticks: { color: corTexto, font: { family: "'Poppins', sans-serif", weight: '600' } } }
                    },
                    plugins: {
                        legend: { display: false }, 
                        tooltip: { callbacks: { label: function(context) { return ' Estimativa: R$ ' + context.raw.toFixed(2).replace('.', ','); } } }
                    }
                }
            });
        } catch(e) { 
            console.error("Erro ao gerar projeção:", e); 
        }
    }

    // ==========================================
    // 3. SISTEMA DE SONHOS E METAS
    // ==========================================
    async function carregarMetas() {
        try {
            const response = await fetch("http://localhost:8000/metas");
            if (!response.ok) return;
            const data = await response.json();
            metasArray = data.metas;
            renderizarMetas();
        } catch (e) { 
            console.error(e); 
        }
    }

    function renderizarMetas() {
        if (metasArray.length === 0) {
            listaMetas.innerHTML = `
                <div class="panel full-width" style="text-align: center;">
                    <p class="text-muted" style="font-size: 1.1rem;">Você ainda não cadastrou nenhum sonho. Clique em <b class="text-main">"+ Novo Sonho"</b> para começar!</p>
                </div>
            `;
            return;
        }

        listaMetas.innerHTML = metasArray.map(m => {
            const porcentagem = Math.min((m.valor_atual / m.valor_alvo) * 100, 100).toFixed(1);
            const diasTotais = m.dias_passados === 0 ? 1 : m.dias_passados;
            const mesesTotais = Math.max(1, diasTotais / 30.4);
            const mediaMensalGuardada = m.valor_atual / mesesTotais;
            
            let previsaoTexto = "Aguardando aportes...";
            if (mediaMensalGuardada > 0 && m.valor_atual < m.valor_alvo) {
                const mesesRestantes = Math.ceil((m.valor_alvo - m.valor_atual) / mediaMensalGuardada);
                previsaoTexto = `Em aprox. <b>${mesesRestantes} meses</b> mantendo o ritmo.`;
            } else if (m.valor_atual >= m.valor_alvo) {
                previsaoTexto = `<span class="text-green">Concluída! 🎉</span>`;
            }

            const [a, mes, d] = m.data_criacao.split('-');
            const dataCriacaoBR = `${d}/${mes}/${a}`;

            return `
                <div class="meta-card">
                    <div class="meta-header">
                        <div class="meta-title">
                            <div class="meta-icon-box" style="background-color: ${m.cor}30; color: ${m.cor};"><i class="fa-solid ${m.icone}"></i></div>
                            <div>
                                <span>${m.nome}</span><br>
                                <span class="text-muted" style="font-size: 0.8rem; font-weight: 400;">${formatBRL.format(m.valor_atual)} de ${formatBRL.format(m.valor_alvo)}</span>
                            </div>
                        </div>
                        <button onclick="abrirModalSaldo(${m.id}, '${m.nome}')" class="btn-icon" style="background-color: var(--sidebar-bg); border: 1px solid var(--success); color: var(--success); padding: 8px 12px; border-radius: 8px; font-size: 0.9rem;" title="Adicionar Saldo">
                            <i class="fa-solid fa-plus"></i> Saldo
                        </button>
                    </div>

                    <div>
                        <div class="flex-between" style="margin-bottom: 5px; font-size: 0.8rem;">
                            <span style="color: ${m.cor}; font-weight: 600;">${porcentagem}%</span>
                        </div>
                        <div class="meta-progress-bg">
                            <div class="meta-progress-fill" style="width: ${porcentagem}%; background-color: ${m.cor}; box-shadow: 0 0 10px ${m.cor}80;"></div>
                        </div>
                    </div>

                    <details class="predicao-accordion">
                        <summary><i class="fa-solid fa-wand-magic-sparkles"></i> Detalhes & Simulador Preditivo</summary>
                        <div class="predicao-content">
                            <div class="predicao-row"><span>Data de início:</span> <strong>${dataCriacaoBR}</strong></div>
                            <div class="predicao-row"><span>Dias no foco:</span> <strong>${diasTotais} dias</strong></div>
                            <div class="predicao-row"><span>Ritmo médio guardado:</span> <strong>${formatBRL.format(mediaMensalGuardada)} /mês</strong></div>
                            <div class="predicao-row"><span>Previsão Automática:</span> <span>${previsaoTexto}</span></div>
                            
                            <div class="calc-preditiva">
                                <label style="font-weight:600; margin-bottom:5px; display:block;">Calculadora: Quando você quer concluir?</label>
                                <div class="align-center">
                                    <input type="month" id="input-alvo-data-${m.id}">
                                    <button onclick="calcularPredicao(${m.id}, ${m.valor_alvo}, ${m.valor_atual})" class="btn-primary" style="padding: 8px 15px; font-size: 0.9rem;">Simular</button>
                                </div>
                                <div id="resultado-predicao-${m.id}" style="margin-top:10px; font-size: 0.9rem; color: var(--info);"></div>
                            </div>
                        </div>
                    </details>

                    <div style="display: flex; justify-content: flex-end; margin-top: 15px;">
                        <button onclick="deletarMeta(${m.id})" class="btn-icon" style="padding: 5px;" title="Excluir Sonho" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==========================================
    // 4. FUNÇÕES GLOBAIS DE JANELA (WINDOW)
    // ==========================================
    window.deletarMeta = function(id) {
        mostrarConfirm("Tem certeza que deseja excluir este sonho? Essa ação não pode ser desfeita.", async () => {
            try {
                const res = await fetch(`http://localhost:8000/metas/${id}`, { method: "DELETE" });
                if(res.ok) {
                    carregarMetas(); 
                    alert("Sonho apagado com sucesso.");
                }
            } catch(e) { console.error("Erro ao deletar:", e); }
        });
    };

    window.calcularPredicao = function(metaId, valorAlvo, valorAtual) {
        const inputMes = document.getElementById(`input-alvo-data-${metaId}`);
        const spanResultado = document.getElementById(`resultado-predicao-${metaId}`);
        if(!inputMes.value) { spanResultado.innerHTML = `<span class="text-red">Selecione um mês/ano.</span>`; return; }

        const dataAlvo = new Date(inputMes.value + "-01");
        const dataHoje = new Date();
        let mesesFaltando = (dataAlvo.getFullYear() - dataHoje.getFullYear()) * 12;
        mesesFaltando -= dataHoje.getMonth();
        mesesFaltando += dataAlvo.getMonth();

        if (mesesFaltando <= 0) { spanResultado.innerHTML = `<span class="text-red">A data precisa ser no futuro!</span>`; return; }
        const valorFaltante = valorAlvo - valorAtual;
        if(valorFaltante <= 0) { spanResultado.innerHTML = `<span class="text-green">Meta já concluída! 🎉</span>`; return; }

        const aporteNecessario = valorFaltante / mesesFaltando;
        spanResultado.innerHTML = `Invista <b>${formatBRL.format(aporteNecessario)}</b>/mês para chegar lá.`;
    };

    window.abrirModalSaldo = function(id, nome) {
        document.getElementById('id-meta-alvo').value = id;
        document.getElementById('titulo-add-saldo').innerText = `Destino: ${nome}`;
        document.getElementById('modal-add-saldo').classList.remove('hidden');
    };

    // ==========================================
    // 5. CONTROLES DE MODAIS
    // ==========================================
    const modalNovaMeta = document.getElementById('modal-nova-meta');
    
    document.getElementById('btn-nova-meta').addEventListener('click', () => modalNovaMeta.classList.remove('hidden'));
    document.getElementById('btn-fechar-meta').addEventListener('click', () => modalNovaMeta.classList.add('hidden'));

    document.getElementById('btn-salvar-meta').addEventListener('click', async () => {
        const nome = document.getElementById('input-meta-nome').value;
        const valor = parseFloat(document.getElementById('input-meta-valor').value);
        const cor = document.getElementById('input-meta-cor').value;
        const icone = 'fa-piggy-bank'; 

        if (!nome || !valor) { alert("Preencha o nome e o valor alvo!"); return; }

        try {
            const res = await fetch("http://localhost:8000/metas", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: nome, valor_alvo: valor, icone: icone, cor: cor })
            });
            if(res.ok) {
                modalNovaMeta.classList.add('hidden');
                document.getElementById('input-meta-nome').value = '';
                document.getElementById('input-meta-valor').value = '';
                carregarMetas();
                alert("Novo sonho criado com sucesso!");
            }
        } catch(e) { console.error(e); }
    });

    const modalAddSaldo = document.getElementById('modal-add-saldo');
    document.getElementById('btn-fechar-saldo').addEventListener('click', () => {
        modalAddSaldo.classList.add('hidden');
        document.getElementById('input-add-saldo').value = '';
    });

    document.getElementById('btn-salvar-saldo').addEventListener('click', async () => {
        const id = document.getElementById('id-meta-alvo').value;
        const valorAdd = parseFloat(document.getElementById('input-add-saldo').value);
        if (!valorAdd || valorAdd <= 0) return;

        const btn = document.getElementById('btn-salvar-saldo');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

        try {
            const res = await fetch(`http://localhost:8000/metas/${id}/saldo`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valor: valorAdd })
            });
            if(res.ok) {
                modalAddSaldo.classList.add('hidden');
                document.getElementById('input-add-saldo').value = '';
                carregarMetas();
                alert("Saldo guardado com sucesso!");
            }
        } catch(e) { 
            console.error(e); 
        } finally { 
            btn.innerHTML = 'Guardar Valor'; 
        }
    });

    // START
    inicializarMetas();
});