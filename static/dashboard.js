document.addEventListener("DOMContentLoaded", () => {
  const totalEl = document.getElementById("total-responses");
  const globalAvgEl = document.getElementById("global-average");
  const latestEl = document.getElementById("latest-response-date");
  const reloadBtn = document.getElementById("reload-btn");

  const areaCtx = document.getElementById("areaAverageChart")?.getContext("2d");
  const globalCtx = document.getElementById("globalDistChart")?.getContext("2d");
  const timelineCtx = document.getElementById("timelineChart")?.getContext("2d");

  let areaChart = null;
  let globalChart = null;
  let timelineChart = null;

  // Mapeo de prefijos de las preguntas a áreas
  const AREA_LABELS = {
    comercial: "Comercial",
    marketing: "Marketing",
    finanzas: "Finanzas / Contabilidad",
    logistica: "Logística",
    compras: "Compras",
    rrhh: "Recursos Humanos",
  };

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

      const globalAvg = data.global && data.global.avg != null ? Number(data.global.avg) : null;
      globalAvgEl.textContent = globalAvg != null ? globalAvg.toFixed(2) : "-";

      if (data.timeline && data.timeline.length > 0) {
        const last = data.timeline[data.timeline.length - 1];
        latestEl.textContent = `${last.date} · ${last.count} respuesta${last.count === 1 ? "" : "s"}`;
      } else {
        latestEl.textContent = "Sin respuestas aún";
      }

      // ===== Distribución global de valores =====
      const perValue = (data.global && data.global.per_value) || {};
      const valueLabels = ["1", "2", "3", "4"]; // usamos escala 1–4
      const valueCounts = valueLabels.map((v) => perValue[v] || perValue[Number(v)] || 0);

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

      // ===== Promedio por área =====
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

      const areaKeys = Object.keys(AREA_LABELS);
      const areaLabels = [];
      const areaValues = [];

      areaKeys.forEach((key) => {
        const meta = areaStats[key];
        areaLabels.push(AREA_LABELS[key]);
        if (!meta || !meta.count) {
          areaValues.push(0);
        } else {
          areaValues.push(meta.sum / meta.count);
        }
      });

      if (areaChart) {
        areaChart.destroy();
      }
      if (areaCtx) {
        areaChart = new Chart(areaCtx, {
          type: "bar",
          data: {
            labels: areaLabels,
            datasets: [
              {
                label: "Promedio del área",
                data: areaValues,
                backgroundColor: "#22c55e33",
                borderColor: "#22c55e",
                borderWidth: 1.8,
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
                suggestedMax: 4,
              },
            },
          },
        });
      }

      // ===== Timeline: respuestas por día =====
      const timeline = data.timeline || [];
      const dates = timeline.map((item) => item.date);
      const counts = timeline.map((item) => item.count);

      if (timelineChart) {
        timelineChart.destroy();
      }
      if (timelineCtx) {
        timelineChart = new Chart(timelineCtx, {
          type: "line",
          data: {
            labels: dates,
            datasets: [
              {
                label: "Respuestas por día",
                data: counts,
                fill: false,
                borderColor: "#38bdf8",
                tension: 0.25,
                pointRadius: 3,
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
    } catch (err) {
      console.error(err);
      latestEl.textContent = "Error cargando datos";
    }
  }

  if (reloadBtn) {
    reloadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      loadStats();
    });
  }

  // Cargar de inicio y refrescar cada 60 segundos
  loadStats();
  setInterval(loadStats, 60000);
});
