document.addEventListener("DOMContentLoaded", () => {
  const totalEl = document.getElementById("total-responses");
  const globalAvgEl = document.getElementById("global-average");
  const latestEl = document.getElementById("latest-response-date");
  const reloadBtn = document.getElementById("reload-btn");

  const globalCtx = document
    .getElementById("globalDistChart")
    ?.getContext("2d");

  const commentsListEl = document.getElementById("comments-list");
  const commentsSummaryEl = document.getElementById("comments-summary");
  const commentsAreaFilterEl = document.getElementById("comments-area-filter");
  const commentsSearchEl = document.getElementById("comments-search");

  const bestAreaNameEl = document.getElementById("best-area-name");
  const bestAreaScoreEl = document.getElementById("best-area-score");
  const worstAreaNameEl = document.getElementById("worst-area-name");
  const worstAreaScoreEl = document.getElementById("worst-area-score");
  const mostAnswersAreaNameEl = document.getElementById(
    "most-answers-area-name"
  );
  const mostAnswersAreaCountEl = document.getElementById(
    "most-answers-area-count"
  );

  // Nuevos indicadores globales
  const criticalPctEl = document.getElementById("critical-percentage");
  const positivePctEl = document.getElementById("positive-percentage");
  const satisfactionIndexEl = document.getElementById("satisfaction-index");

  let globalChart = null;

  // Estado en memoria de todos los comentarios (para filtros)
  let allComments = [];

  // Mapeo de prefijos de las preguntas a áreas (incluye las 2 nuevas)
  const AREA_LABELS = {
    comercial: "Comercial",
    marketing: "Marketing",
    finanzas: "Finanzas / Contabilidad",
    logistica: "Logística",
    compras: "Compras",
    rrhh: "Recursos Humanos",
    creditocartera: "Crédito y Cartera",
    garantias: "Garantías",
  };

  // =========================
  // Carga de estadísticas numéricas
  // =========================
  async function loadStats() {
    try {
      const resp = await fetch("/api/stats");
      if (!resp.ok) {
        throw new Error("Error al consultar /api/stats");
      }
      const data = await resp.json();

      // ===== KPIs básicos =====
      const total = data.total_responses || 0;
      totalEl.textContent = total;

      const globalAvg =
        data.global && data.global.avg != null ? Number(data.global.avg) : null;
      globalAvgEl.textContent = globalAvg != null ? globalAvg.toFixed(2) : "-";

      if (data.timeline && data.timeline.length > 0) {
        const last = data.timeline[data.timeline.length - 1];
        latestEl.textContent = `${last.date} · ${last.count} respuesta${
          last.count === 1 ? "" : "s"
        }`;
      } else {
        latestEl.textContent = "Sin respuestas aún";
      }

      // ===== Distribución global de valores (1–4) =====
      const perValue = (data.global && data.global.per_value) || {};
      const valueLabels = ["1", "2", "3", "4"];
      const valueCounts = valueLabels.map(
        (v) => perValue[v] || perValue[Number(v)] || 0
      );

      // Cálculo de indicadores: zona crítica / positiva e índice global
      const totalAnswers = valueCounts.reduce((acc, val) => acc + val, 0);
      let criticalPct = null;
      let positivePct = null;
      let satisfactionIndex = null;

      if (totalAnswers > 0) {
        const criticalCount = valueCounts[0] + valueCounts[1]; // 1 y 2
        const positiveCount = valueCounts[2] + valueCounts[3]; // 3 y 4
        criticalPct = (criticalCount / totalAnswers) * 100;
        positivePct = (positiveCount / totalAnswers) * 100;

        if (globalAvg != null) {
          satisfactionIndex = (globalAvg / 4) * 100;
        }
      }

      if (criticalPctEl) {
        criticalPctEl.textContent =
          criticalPct != null ? `${criticalPct.toFixed(1)} %` : "-";
      }
      if (positivePctEl) {
        positivePctEl.textContent =
          positivePct != null ? `${positivePct.toFixed(1)} %` : "-";
      }
      if (satisfactionIndexEl) {
        satisfactionIndexEl.textContent =
          satisfactionIndex != null ? `${satisfactionIndex.toFixed(1)} %` : "-";
      }

      // Gráfica de distribución global
      if (globalChart) {
        globalChart.destroy();
      }
      if (globalCtx) {
        globalChart = new Chart(globalCtx, {
          type: "bar",
          data: {
            labels: valueLabels,
            datasets: [
              {
                label: "Cantidad de respuestas",
                data: valueCounts,
                backgroundColor: ["#fee2e2", "#fef3c7", "#dcfce7", "#bbf7d0"],
                borderColor: "#16a34a",
                borderWidth: 1.5,
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0,
                },
              },
            },
          },
        });
      }

      // ===== Agregados por área (para insights, sin gráfica) =====
      const stats = data.stats || {};
      const areaStats = {};

      Object.entries(stats).forEach(([questionKey, qStats]) => {
        const parts = questionKey.split("_");
        const areaKey = parts[0];
        if (!AREA_LABELS[areaKey]) return;
        if (!qStats || typeof qStats.sum !== "number" || !qStats.count) return;

        if (!areaStats[areaKey]) {
          areaStats[areaKey] = { sum: 0, count: 0 };
        }
        areaStats[areaKey].sum += qStats.sum;
        areaStats[areaKey].count += qStats.count;
      });

      // ===== Insights ejecutivos por área =====
      let bestArea = null;
      let bestAvg = -Infinity;
      let worstArea = null;
      let worstAvg = Infinity;
      let mostAnswersArea = null;
      let mostAnswersCount = 0;

      Object.entries(areaStats).forEach(([areaKey, meta]) => {
        if (!meta || !meta.count) return;
        const avg = meta.sum / meta.count;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestArea = areaKey;
        }
        if (avg < worstAvg) {
          worstAvg = avg;
          worstArea = areaKey;
        }
        if (meta.count > mostAnswersCount) {
          mostAnswersCount = meta.count;
          mostAnswersArea = areaKey;
        }
      });

      // Área mejor valorada
      if (bestAreaNameEl) {
        if (bestArea) {
          bestAreaNameEl.textContent = AREA_LABELS[bestArea] || bestArea;
          if (bestAreaScoreEl) {
            bestAreaScoreEl.textContent = `Nivel medio ${bestAvg.toFixed(
              2
            )} / 4`;
          }
        } else {
          bestAreaNameEl.textContent = "-";
          if (bestAreaScoreEl) {
            bestAreaScoreEl.textContent = "Aún no hay suficientes respuestas.";
          }
        }
      }

      // Área con más oportunidades
      if (worstAreaNameEl) {
        if (worstArea) {
          worstAreaNameEl.textContent = AREA_LABELS[worstArea] || worstArea;
          if (worstAreaScoreEl) {
            worstAreaScoreEl.textContent = `Nivel medio ${worstAvg.toFixed(
              2
            )} / 4`;
          }
        } else {
          worstAreaNameEl.textContent = "-";
          if (worstAreaScoreEl) {
            worstAreaScoreEl.textContent = "Aún no hay suficientes respuestas.";
          }
        }
      }

      // Área con más respuestas
      if (mostAnswersAreaNameEl) {
        if (mostAnswersArea) {
          mostAnswersAreaNameEl.textContent =
            AREA_LABELS[mostAnswersArea] || mostAnswersArea;
          if (mostAnswersAreaCountEl) {
            mostAnswersAreaCountEl.textContent = `${mostAnswersCount} respuesta${
              mostAnswersCount === 1 ? "" : "s"
            } registradas.`;
          }
        } else {
          mostAnswersAreaNameEl.textContent = "-";
          if (mostAnswersAreaCountEl) {
            mostAnswersAreaCountEl.textContent =
              "Aún no hay suficientes respuestas.";
          }
        }
      }
    } catch (err) {
      console.error(err);
      latestEl.textContent = "Error cargando datos";
    }
  }

  // =========================
  // Comentarios abiertos (con filtro por área + búsqueda)
  // =========================
  function renderComments(comments) {
    if (!commentsListEl) return;

    commentsListEl.innerHTML = "";
    if (commentsSummaryEl) {
      commentsSummaryEl.innerHTML = "";
    }

    if (!comments || comments.length === 0) {
      commentsListEl.innerHTML =
        '<p class="panel-subtitle">Aún no hay comentarios abiertos registrados.</p>';
      return;
    }

    // Resumen: número de comentarios por área (de los filtrados)
    const areaCounts = {};
    comments.forEach((c) => {
      const areaKey = c.area_key || "otros";
      areaCounts[areaKey] = (areaCounts[areaKey] || 0) + 1;
    });

    if (commentsSummaryEl) {
      const frag = document.createDocumentFragment();
      Object.entries(areaCounts).forEach(([areaKey, count]) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        const label = AREA_LABELS[areaKey] || areaKey;
        chip.textContent = `${label}: ${count} comentario${
          count === 1 ? "" : "s"
        }`;
      });
      commentsSummaryEl.appendChild(frag);
    }

    // Listado: últimos N comentarios
    const MAX_CARDS = 40;
    const subset = comments.slice(0, MAX_CARDS);

    const listFrag = document.createDocumentFragment();

    subset.forEach((c) => {
      const card = document.createElement("article");
      card.className = "comment-card";

      const areaLabel = AREA_LABELS[c.area_key] || c.area_key || "Sin área";
      const createdAt = c.created_at
        ? new Date(c.created_at).toLocaleString("es-CO", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "";

      const title = document.createElement("strong");
      title.textContent = areaLabel;

      const textP = document.createElement("p");
      textP.textContent = c.text;

      const meta = document.createElement("small");
      meta.textContent = createdAt
        ? `Registrado el ${createdAt}`
        : "Fecha no disponible";

      card.appendChild(title);
      card.appendChild(textP);
      card.appendChild(meta);

      listFrag.appendChild(card);
    });

    commentsListEl.appendChild(listFrag);
  }

  // Aplica filtros de área + búsqueda sobre allComments
  function applyCommentsFilters() {
    if (!allComments || allComments.length === 0) {
      renderComments([]);
      return;
    }

    const areaFilter = commentsAreaFilterEl
      ? commentsAreaFilterEl.value
      : "all";
    const searchTerm = commentsSearchEl
      ? commentsSearchEl.value.trim().toLowerCase()
      : "";

    let filtered = allComments.slice();

    if (areaFilter && areaFilter !== "all") {
      filtered = filtered.filter((c) => {
        const areaKey = c.area_key || "otros";
        return areaKey === areaFilter;
      });
    }

    if (searchTerm) {
      filtered = filtered.filter((c) => {
        const text = (c.text || "").toLowerCase();
        const field = (c.field || "").toLowerCase();
        return text.includes(searchTerm) || field.includes(searchTerm);
      });
    }

    renderComments(filtered);
  }

  async function loadComments() {
    if (!commentsListEl) return;

    try {
      const resp = await fetch("/api/comments");
      if (!resp.ok) {
        throw new Error("Error al consultar /api/comments");
      }
      const data = await resp.json();
      allComments = data.comments || [];
      applyCommentsFilters();
    } catch (err) {
      console.error(err);
      allComments = [];
      commentsListEl.innerHTML =
        '<p class="panel-subtitle">Error cargando comentarios abiertos.</p>';
      if (commentsSummaryEl) {
        commentsSummaryEl.innerHTML = "";
      }
    }
  }

  // =========================
  // Eventos
  // =========================
  if (reloadBtn) {
    reloadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      loadStats();
      loadComments();
    });
  }

  if (commentsAreaFilterEl) {
    commentsAreaFilterEl.addEventListener("change", () => {
      applyCommentsFilters();
    });
  }

  if (commentsSearchEl) {
    commentsSearchEl.addEventListener("input", () => {
      applyCommentsFilters();
    });
  }

  // Carga inicial
  loadStats();
  loadComments();
});
