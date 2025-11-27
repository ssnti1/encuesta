document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("encuesta-form");
  const success = document.getElementById("encuesta-success");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
      data[key] = value;
    });

    try {
      const resp = await fetch("/api/encuesta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!resp.ok) {
        throw new Error("Error en el servidor");
      }

      form.classList.add("is-submitted");
      success.style.display = "block";
      success.textContent =
        "¡Gracias por completar la evaluación! Tus respuestas han sido registradas.";
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      console.error(err);
      success.style.display = "block";
      success.style.background = "rgba(248, 113, 113, 0.12)";
      success.style.borderColor = "rgba(248, 113, 113, 0.7)";
      success.textContent =
        "Hubo un error guardando tus respuestas. Intenta de nuevo en unos minutos.";
    }
  });
});
