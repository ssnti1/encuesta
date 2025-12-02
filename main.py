from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

import sqlite3
import json
from datetime import datetime
from pathlib import Path

# Ruta del archivo de base de datos
DB_PATH = Path("encuestas.db")

app = FastAPI()

# ✅ CORS: permite que tu HTML (aunque lo abras desde otro origen) pueda llamar al API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],         # Si luego tienes dominio fijo, cámbialo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Archivos estáticos (CSS, JS, etc.)
# Crea una carpeta llamada "static" al lado de este main.py
# y coloca allí: style.css, script.js, dashboard.js
app.mount("/static", StaticFiles(directory="static"), name="static")


def init_db() -> None:
    """Crear tabla si no existe."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS survey_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


init_db()


@app.get("/", response_class=HTMLResponse)
def serve_landing():
    """Muestra la landing page directamente al entrar en "/"."""
    html_path = Path("index.html")
    if html_path.exists():
        return html_path.read_text(encoding="utf-8")
    return "<h1>Landing page no encontrada</h1>"


@app.get("/dashboard", response_class=HTMLResponse)
def serve_dashboard():
    """Muestra el dashboard de resultados."""
    html_path = Path("dashboard.html")
    if html_path.exists():
        return html_path.read_text(encoding="utf-8")
    return "<h1>Dashboard no encontrado</h1>"


@app.post("/api/encuesta")
def save_survey(payload: dict = Body(...)):
    """Guarda todas las respuestas tal cual vienen del formulario
    en un campo JSON dentro de la base de datos.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()

        cur.execute(
            "INSERT INTO survey_responses (data, created_at) VALUES (?, ?)",
            (json.dumps(payload, ensure_ascii=False), datetime.utcnow().isoformat()),
        )

        conn.commit()
        conn.close()

        return {"ok": True, "message": "Encuesta guardada correctamente"}
    except Exception as e:
        print("Error guardando encuesta:", e)
        raise HTTPException(
            status_code=500,
            detail="Error guardando encuesta en la base de datos",
        )


@app.get("/api/stats")
def get_stats():
    """Devuelve estadísticas agregadas para el dashboard.

    - total_responses: número total de encuestas.
    - global: distribución global de valores (1-4) y promedio general.
    - timeline: cantidad de respuestas por día.
    - stats: por cada pregunta (clave del formulario), conteo, suma, promedio y distribución por valor.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT data, created_at FROM survey_responses")
        rows = cur.fetchall()
        conn.close()
    except Exception as e:
        print("Error leyendo encuesta:", e)
        raise HTTPException(status_code=500, detail="Error leyendo datos de la base")

    total_responses = len(rows)
    stats: dict = {}
    global_options: dict = {}
    timeline: dict = {}

    for data_json, created_at in rows:
        try:
            payload = json.loads(data_json)
        except json.JSONDecodeError:
            continue

        # timeline por día
        if created_at:
            date_str = str(created_at)[:10]
            if date_str:
                timeline[date_str] = timeline.get(date_str, 0) + 1

        # recorrer todas las respuestas de la encuesta
        for key, val in payload.items():
            # ignorar campos que no sean numéricos (ej: comentarios)
            try:
                v = int(val)
            except (TypeError, ValueError):
                continue

            q = stats.setdefault(key, {"count": 0, "sum": 0, "options": {}})
            q["count"] += 1
            q["sum"] += v
            q["options"][v] = q["options"].get(v, 0) + 1

            global_options[v] = global_options.get(v, 0) + 1

    # calcular promedios por pregunta
    for key, q in stats.items():
        if q["count"]:
            q["avg"] = q["sum"] / q["count"]
        else:
            q["avg"] = None

    # promedio global
    if global_options:
        total_votes = sum(global_options.values())
        total_weighted = sum(val * count for val, count in global_options.items())
        global_avg = total_weighted / total_votes
    else:
        global_avg = None

    timeline_sorted = sorted(timeline.items())

    return {
        "total_responses": total_responses,
        "global": {
            "per_value": global_options,
            "avg": global_avg,
        },
        "timeline": [
            {"date": d, "count": c} for d, c in timeline_sorted
        ],
        "stats": stats,
    }
@app.get("/api/comments")
def get_comments():
    """
    Devuelve los comentarios abiertos (preguntas tipo texto) agrupados por área.

    Considera como comentario cualquier campo cuyo nombre termine en "_mejoras"
    y cuyo valor sea un texto no vacío.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT data, created_at FROM survey_responses ORDER BY created_at DESC")
        rows = cur.fetchall()
        conn.close()
    except Exception as e:
        print("Error leyendo comentarios:", e)
        raise HTTPException(status_code=500, detail="Error leyendo datos de la base")

    comments = []

    for data_json, created_at in rows:
        try:
            payload = json.loads(data_json)
        except json.JSONDecodeError:
            continue

        for key, val in payload.items():
            # Solo tomamos campos de texto tipo "..._mejoras"
            if not isinstance(val, str):
                continue
            text = val.strip()
            if not text:
                continue
            if not key.endswith("_mejoras"):
                continue

            # área = prefijo antes del primer "_", o el propio key si no hay "_"
            if "_" in key:
                area_key = key.split("_", 1)[0]
            else:
                area_key = key

            comments.append(
                {
                    "area_key": area_key,
                    "field": key,
                    "text": text,
                    "created_at": created_at,
                }
            )

    # Para no reventar la UI, limitamos a los últimos 200 comentarios
    comments = comments[:200]

    return {"comments": comments}
