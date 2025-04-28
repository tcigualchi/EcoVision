import os
import requests
from duckduckgo_search import DDGS
from PIL import Image
from io import BytesIO
from datetime import datetime

tipos_reciclagem = [
    "reciclagem de papel",
    "reciclagem de plástico",
    "reciclagem de vidro",
    "reciclagem de metal",
    "reciclagem de eletrônico",
    "reciclagem de orgânica",
    "reciclagem de quimicos"
]

num_imagens = 30

if not os.path.exists("imagens_reciclagem"):
    os.makedirs("imagens_reciclagem")

log_path = "log_download.txt"
with open(log_path, "w", encoding="utf-8") as log_file:
    log_file.write(f"Log de Download - Início: {datetime.now()}\n\n")

def escrever_log(mensagem):
    with open(log_path, "a", encoding="utf-8") as log_file:
        log_file.write(mensagem + "\n")

def baixar_imagens(termo, num):
    pasta = f"imagens_reciclagem/{termo.replace('', '_')}"
    os.makedirs(pasta, exist_ok=True)

    with DDGS() as ddgs:
        results = ddgs.images(termo, max_results=num)
        for idx, result in enumerate(results):
            try:
                url = result['image']
                resposta = requests.get(url, timeout=10)
                imagem = Image.open(BytesIO(resposta.content)).convert('RGB')
                caminho = f"{pasta}/{termo.replace('', '_')}_{idx}.jpg"
                imagem.save(caminho)
                mensagem = f"Salvo com sucesso: {caminho}"
                print(mensagem)
                escrever_log(mensagem)
            except Exception as e:
                mensagem = f"Erro ao baixar imagem {idx} de {termo}: {e}"
                print(mensagem)
                escrever_log(mensagem)

for tipo in tipos_reciclagem:
    baixar_imagens(tipo, num_imagens)

escrever_log(f"\nLog de Download - Fim: {datetime.now()}")
print("Download Concluído!")