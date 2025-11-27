# Imagen base con Python 3.11
FROM python:3.11-slim

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar dependencias
COPY requirements.txt .

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar todo el proyecto al contenedor
COPY . .

# Exponer el puerto que Railway asigna automáticamente
EXPOSE 8000

# Comando para iniciar la app (Railway asigna PORT como variable)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
