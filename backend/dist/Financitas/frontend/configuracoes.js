// APLICA CONFIGURAÇÕES GLOBAIS INSTANTANEAMENTE ANTES DE RENDERIZAR
if (localStorage.getItem('financitas_tema') === 'light') document.documentElement.classList.add('light-mode');
if (localStorage.getItem('financitas_privacidade') === 'ativo') document.documentElement.classList.add('modo-privado');

document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. ELEMENTOS DOM
    // ==========================================
    const toggleTema = document.getElementById('toggle-tema');
    const togglePrivacidade = document.getElementById('toggle-privacidade');
    const sliderConfianca = document.getElementById('slider-confianca');
    const labelConfianca = document.getElementById('label-confianca');
    const btnExportar = document.getElementById('btn-exportar');
    const btnZerarBanco = document.getElementById('btn-zerar-banco');

    // ==========================================
    // 2. SINCRONIZAR ESTADO DOS BOTÕES
    // ==========================================
    if (localStorage.getItem('financitas_tema') === 'light') {
        toggleTema.checked = true;
    }

    if (localStorage.getItem('financitas_privacidade') === 'ativo') {
        togglePrivacidade.checked = true;
    }

    const confiancaSalva = localStorage.getItem('financitas_ia_confianca') || 75;
    sliderConfianca.value = confiancaSalva;
    labelConfianca.innerText = `${confiancaSalva}%`;

    // ==========================================
    // 3. EVENTOS DE MUDANÇA (TOGGLES)
    // ==========================================
    toggleTema.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.documentElement.classList.add('light-mode');
            localStorage.setItem('financitas_tema', 'light');
        } else {
            document.documentElement.classList.remove('light-mode');
            localStorage.setItem('financitas_tema', 'dark');
        }
    });

    togglePrivacidade.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.documentElement.classList.add('modo-privado');
            localStorage.setItem('financitas_privacidade', 'ativo');
        } else {
            document.documentElement.classList.remove('modo-privado');
            localStorage.setItem('financitas_privacidade', 'inativo');
        }
    });

    sliderConfianca.addEventListener('input', (e) => {
        labelConfianca.innerText = `${e.target.value}%`;
    });

    sliderConfianca.addEventListener('change', (e) => {
        localStorage.setItem('financitas_ia_confianca', e.target.value);
    });

    // ==========================================
    // 4. EXPORTAR DADOS (BACKUP)
    // ==========================================
    btnExportar.addEventListener('click', () => {
        window.location.href = "http://localhost:8000/exportar-dados";
    });

    // ==========================================
    // 5. ZONA DE PERIGO (RESET DO BANCO)
    // ==========================================
    btnZerarBanco.addEventListener('click', () => {
        mostrarConfirm("⚠️ ATENÇÃO: Isso apagará TODAS as suas transações e faturas do histórico. Suas categorias e metas serão mantidas.\n\nDeseja continuar?", () => {
            
            // Confirmação dupla de segurança
            mostrarConfirm("Tem certeza absoluta? Essa ação NÃO poderá ser desfeita.", async () => {
                const originalText = btnZerarBanco.innerHTML;
                btnZerarBanco.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Apagando...';
                btnZerarBanco.disabled = true;

                try {
                    const res = await fetch("http://localhost:8000/reset-database", { method: "DELETE" });
                    if (res.ok) {
                        alert("Histórico apagado com sucesso! O sistema está limpo.");
                    } else {
                        const err = await res.json();
                        alert("Erro: " + err.detail);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    btnZerarBanco.innerHTML = originalText;
                    btnZerarBanco.disabled = false;
                }
            });

        });
    });

    const btnZerarHeuri = document.getElementById('btn-zerar-heuri');
    btnZerarHeuri.addEventListener('click', () => {
        mostrarConfirm("Isso apagará TODOS os atalhos de palavras-chave da IA. Deseja continuar?", async () => {
            btnZerarHeuri.innerHTML = 'Limpando...';
            try {
                const res = await fetch("http://localhost:8000/reset-heuristicas", { method: "DELETE" });
                if (res.ok) alert("Dicionário da IA apagado com sucesso!");
            } catch(e) { console.error(e); }
            btnZerarHeuri.innerHTML = '<i class="fa-solid fa-eraser"></i> Zerar Atalhos da IA';
        });
    });
});