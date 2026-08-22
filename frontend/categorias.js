// APLICA CONFIGURAÇÕES GLOBAIS INSTANTANEAMENTE
if (localStorage.getItem('financitas_tema') === 'light') document.documentElement.classList.add('light-mode');
if (localStorage.getItem('financitas_privacidade') === 'ativo') document.documentElement.classList.add('modo-privado');

document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. VARIÁVEIS E INICIALIZAÇÃO
    // ==========================================
    const listaFabrica = document.getElementById('lista-categorias-fabrica');
    const listaLivres = document.getElementById('lista-categorias-livres');
    
    let categoriasArray = [];

    async function carregarCategorias() {
        try {
            const res = await fetch("http://localhost:8000/gestao-categorias");
            if (!res.ok) return;
            const data = await res.json();
            categoriasArray = data.categorias;
            renderizarCategorias();
        } catch (e) { 
            console.error("Erro ao carregar categorias:", e); 
        }
    }

    // ==========================================
    // 2. RENDERIZAÇÃO
    // ==========================================
    function gerarCardHTML(c) {
        const corHex = c.cor || '#8D99AE';
        const bgColor = corHex + '25'; 
        
        const btnDeleteHtml = c.is_default 
            ? `<span class="badge-system"><i class="fa-solid fa-lock"></i> Padrão</span>`
            : `<button onclick="deletarCategoria(${c.id}, '${c.nome}')" class="btn-icon" style="color: var(--danger); padding: 5px;" title="Excluir Categoria"><i class="fa-solid fa-trash"></i></button>`;

        return `
            <div class="cat-manager-card">
                <div class="cat-manager-header">
                    <div class="meta-icon-box" style="background-color: ${bgColor}; color: ${corHex}; border: 1px solid ${corHex}50;">
                        <i class="fa-solid ${c.icone || 'fa-tag'}"></i>
                    </div>
                    <div style="flex-grow: 1;">
                        <strong style="font-size: 1.1rem; color: var(--text-main);">${c.nome}</strong>
                    </div>
                </div>
                
                <div class="cat-manager-stats">
                    <span><i class="fa-solid fa-receipt"></i> ${c.qtd_transacoes} compras atreladas</span>
                </div>

                <div class="flex-between" style="margin-top: 5px;">
                    <div>${btnDeleteHtml}</div>
                    <button onclick="abrirModalCategoria(${c.id})" class="btn-icon" style="color: var(--info); padding: 5px; background: rgba(255,255,255,0.05); border-radius: 6px;" title="Editar Estilo">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>
                </div>
            </div>
        `;
    }

    function renderizarCategorias() {
        const fabrica = categoriasArray.filter(c => c.is_default);
        const livres = categoriasArray.filter(c => !c.is_default);

        listaFabrica.innerHTML = fabrica.map(gerarCardHTML).join('');
        
        if (livres.length === 0) {
            listaLivres.innerHTML = `
                <div class="panel full-width" style="text-align: center; border-style: dashed;">
                    <p class="text-muted">Você ainda não criou nenhuma categoria personalizada.</p>
                </div>
            `;
        } else {
            listaLivres.innerHTML = livres.map(gerarCardHTML).join('');
        }
    }

    // ==========================================
    // 3. FUNÇÕES GLOBAIS DE JANELA (EXCLUSÃO)
    // ==========================================
    window.deletarCategoria = function(id, nome) {
        mostrarConfirm(`Tem certeza que deseja apagar a categoria "${nome}"?\n\nTodas as compras registradas nela serão movidas com segurança para a categoria "Indefinida".`, async () => {
            try {
                const res = await fetch(`http://localhost:8000/gestao-categorias/${id}`, { method: "DELETE" });
                if(res.ok) {
                    carregarCategorias(); 
                    alert("Categoria deletada com sucesso!");
                }
            } catch(e) { 
                console.error("Erro ao deletar:", e); 
            }
        });
    };

    window.abrirModalCategoria = function(id) {
        const cat = categoriasArray.find(c => c.id === id);
        if(!cat) return;

        inputId.value = cat.id;
        inputNome.value = cat.nome;
        inputIcone.value = cat.icone || 'fa-tag';
        inputCor.value = cat.cor || '#ffffff';
        
        tituloModal.innerText = 'Editar Categoria';
        inputNome.disabled = cat.is_default;
        
        modalCategoria.classList.remove('hidden');
    };

    // ==========================================
    // 4. CONTROLES DO MODAL (CRIAR / EDITAR)
    // ==========================================
    const modalCategoria = document.getElementById('modal-categoria');
    const inputId = document.getElementById('input-cat-id');
    const inputNome = document.getElementById('input-cat-nome');
    const inputIcone = document.getElementById('input-cat-icone');
    const inputCor = document.getElementById('input-cat-cor');
    const tituloModal = document.getElementById('titulo-modal-categoria');

    document.getElementById('btn-nova-categoria').addEventListener('click', () => {
        inputId.value = ''; inputNome.value = ''; inputIcone.value = 'fa-tag'; inputCor.value = '#9D4EDD';
        tituloModal.innerText = 'Nova Categoria';
        inputNome.disabled = false;
        modalCategoria.classList.remove('hidden');
    });

    document.getElementById('btn-fechar-categoria').addEventListener('click', () => modalCategoria.classList.add('hidden'));

    document.getElementById('btn-salvar-categoria').addEventListener('click', async () => {
        const id = inputId.value;
        const payload = {
            nome: inputNome.value,
            icone: inputIcone.value || 'fa-tag',
            cor: inputCor.value
        };

        if (!payload.nome) { alert("Preencha o nome!"); return; }

        try {
            let res;
            if (id) {
                res = await fetch(`http://localhost:8000/gestao-categorias/${id}`, {
                    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
                });
            } else {
                res = await fetch("http://localhost:8000/gestao-categorias", {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
                });
            }

            if(res.ok) {
                modalCategoria.classList.add('hidden');
                carregarCategorias();
            } else {
                const err = await res.json();
                alert("Erro: " + err.detail);
            }
        } catch(e) { console.error(e); }
    });

    // START
    carregarCategorias();
});