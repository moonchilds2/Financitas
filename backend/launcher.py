import os
import sys
import time
import webbrowser
import tkinter as tk
from multiprocessing import Process, freeze_support
import uvicorn

# IMPORTA O APP DIRETAMENTE PARA O UVICORN NÃO SE PERDER NO .EXE
from main import app 

# ==========================================
# O "TERMINAL FANTASMA" PARA O MODO WINDOWED
# ==========================================
class DummyStream:
    def write(self, *args, **kwargs): pass
    def flush(self, *args, **kwargs): pass
    def isatty(self): return False

if sys.stdout is None:
    sys.stdout = DummyStream()
if sys.stderr is None:
    sys.stderr = DummyStream()
# ==========================================

def iniciar_servidor():
    """Inicia o FastAPI passando o objeto 'app' real, e não a string"""
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

def fechar_sistema(processo, root):
    """Mata o processo instantaneamente e fecha a interface."""
    processo.terminate()
    processo.join()
    root.destroy()
    sys.exit(0)

def main():
    freeze_support()

    # Inicia o servidor em uma "linha temporal" separada (Processo)
    processo_servidor = Process(target=iniciar_servidor)
    processo_servidor.start()
    
    # Aguarda o servidor esquentar (aumentado ligeiramente por precaução)
    time.sleep(3) 
    
    # Abre a aba no Chrome/Edge automaticamente
    webbrowser.open("http://127.0.0.1:8000")
    
    # Criação da Janela de Controle
    root = tk.Tk()
    root.title("Financitas")
    root.geometry("320x150")
    root.resizable(False, False)
    root.configure(bg="#10002B")
    root.eval('tk::PlaceWindow . center')

    tk.Label(root, text="Financitas Ativo!", font=("Poppins", 14, "bold"), bg="#10002B", fg="#2ECC71").pack(pady=(20, 5))
    tk.Label(root, text="Pode usar o sistema no seu navegador.", font=("Poppins", 9), bg="#10002B", fg="#E0AAFF").pack(pady=(0, 15))
    
    btn_fechar = tk.Button(
        root, text="Encerrar Sistema", 
        command=lambda: fechar_sistema(processo_servidor, root),
        bg="#FF4D4D", fg="white", font=("Poppins", 10, "bold"), border=0, padx=15, pady=5, cursor="hand2"
    )
    btn_fechar.pack()

    root.protocol("WM_DELETE_WINDOW", lambda: fechar_sistema(processo_servidor, root))
    root.mainloop()

if __name__ == "__main__":
    main()