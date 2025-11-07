const API_BASE = "https://proyecto-folio-cey8cecg0-alejandracorralesmuro-8459s-projects.vercel.app";

async function login() {
  const usuario = document.getElementById("usuario").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, password })
  });
  const data = await res.json();

  if (data.success) {
    document.getElementById("login").style.display = "none";
    document.getElementById("sistema").style.display = "block";
  } else {
    document.getElementById("loginMsg").innerText = data.message;
  }
}

async function buscarFolio() {
  const folio = document.getElementById("folioInput").value;
  const res = await fetch(`${API_BASE}/buscar/${folio}`);
  const data = await res.json();

  const div = document.getElementById("resultado");
  div.innerHTML = "";

  if (data.success) {

   div.innerHTML = `
  <p><b>Nombre:</b> ${data.usuario.nombre}</p>
  <p><b>Estado:</b> ${data.usuario.estado}</p>
  <p><b>Número de Cliente:</b> ${data.usuario.folio}</p>
  <p><b>Hub/Club:</b> ${data.usuario.hub ?? "(No registrado)"}</p>
  ${data.usuario.fotografia_url 
    ? `<p><b>Fotografía:</b><br><img src="${data.usuario.fotografia_url}" width="150">`
    : "<p><b>Fotografía:</b> (Sin fotografía)</p>"
  }
`;

  } else {
    div.innerHTML = `<p style="color:red">${data.message}</p>`;
  }
}

async function agregarUsuario(event) {
  if (event) event.preventDefault(); //  Evita que el form recargue
  
  const nombre = document.getElementById("nombre").value;
  const estado = document.getElementById("estado").value;
  const hub = document.getElementById("hub").value;
  const expediente = document.getElementById("expediente").value;
 const ref_nombre = document.getElementById("ref_nombre").value;
const ref_telefono = document.getElementById("num_ref").value;
  const foto = document.getElementById("foto").files[0];

  if (!nombre || !estado) {
    document.getElementById("msg").innerHTML =
      `<div class="alert alert-error">⚠️ Por favor complete al menos el Nombre y Estado.</div>`;
    return;
  }

  const formData = new FormData();
  formData.append("nombre", nombre);
  formData.append("estado", estado);
  formData.append("hub", hub);
  formData.append("expediente", expediente);
 formData.append("ref_nombre", ref_nombre);
formData.append("num_ref", num_ref);
  if (foto) formData.append("fotografia", foto);
  

  try {
    const res = await fetch(`${API_BASE}/agregar`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    console.log("Respuesta /agregar:", data); // 👀 log para depuración

    if (data.success) {
      document.getElementById("msg").innerHTML = 
        `<div class="alert alert-success">
          ✅ Usuario agregado con número de cliente: ${data.usuario.folio}
        </div>`;
      document.getElementById("formAgregar").reset();
    } else {
      document.getElementById("msg").innerHTML = 
        `<div class="alert alert-error">❌ ${data.message}</div>`;
    }
  } catch (error) {
    console.error("Error al llamar /agregar:", error);
    document.getElementById("msg").innerHTML = 
      `<div class="alert alert-error">❌ Error de conexión al servidor</div>`;
  }
}
function limpiarCampos() {
  document.getElementById("formAgregar").reset();
  document.getElementById("msg").innerText = "";
}
function limpiarCampos2() {
  document.getElementById("folioInput").value = "";
  document.getElementById("resultado").innerHTML = "";
}
