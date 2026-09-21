(() => {
  "use strict";

  const STORAGE_KEY = "gavi.data.v1";
  const DAY_MS = 86400000;

  const todayISO = () => new Date().toISOString().slice(0, 10);
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

  function daysBetween(fromISO, toISO) {
    const a = new Date(fromISO + "T00:00:00");
    const b = new Date(toISO + "T00:00:00");
    return Math.round((b - a) / DAY_MS);
  }

  function formatDateBR(iso) {
    if (!iso) return "-";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function onlyDigits(str) { return (str || "").replace(/\D/g, ""); }

  function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // ============ STATE ============
  let state = loadState();

  function defaultState() {
    return {
      company: { nome: "", whats: "", endereco: "", janela: 30 },
      clients: [],
      records: [],
      collaborators: []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      return seedState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function seedState() {
    const s = defaultState();
    s.company = { nome: "177 Imóveis", whats: "(46) 99935-7929", endereco: "R. Maranhão, 165 - Centro, Francisco Beltrão - PR", janela: 30 };

    const c1 = { id: uid(), name: "Gabriel Kobielski", phone: "(46) 98830-8552", address: "", createdAt: todayISO() };
    const c2 = { id: uid(), name: "João Silva", phone: "(46) 99999-0000", address: "Rua das Garças, 112, Cango, Francisco Beltrão - PR", createdAt: todayISO() };
    const c3 = { id: uid(), name: "Gustavo Hofmann", phone: "(46) 99980-7771", address: "", createdAt: todayISO() };
    const c4 = { id: uid(), name: "Lucas Azevedo", phone: "(46) 98800-0000", address: "Travessa Vilmar Lopes, 105, AP101, Centro, Francisco Beltrão - PR", createdAt: todayISO() };
    s.clients = [c1, c2, c3, c4];
    s.collaborators = ["Amanda Albanez", "Marina Urio"];

    const shift = (n) => new Date(Date.now() + n * DAY_MS).toISOString().slice(0, 10);

    s.records = [
      {
        id: uid(), ref: "005C46", address: "Rua das Garças, 112, Cango, Francisco Beltrão - PR",
        clientId: c2.id, clientName: c2.name, collaborator: "Amanda Albanez", encerradoAt: null,
        documents: [{ id: uid(), title: "Termo de Autorização - João Silva.pdf", inclusionDate: shift(-215), validityDate: shift(177) }]
      },
      {
        id: uid(), ref: "005C47", address: "Travessa Vilmar Lopes, 105, AP101, Centro, Francisco Beltrão - PR",
        clientId: c4.id, clientName: c4.name, collaborator: "Marina Urio", encerradoAt: null,
        documents: [{ id: uid(), title: "Termo de Autorização - Lucas Azevedo.pdf", inclusionDate: shift(-190), validityDate: shift(-16) }]
      },
      {
        id: uid(), ref: "005C48", address: "Av. Governador Parigot de Souza, 909, Cango, Francisco Beltrão - PR",
        clientId: c1.id, clientName: c1.name, collaborator: "Amanda Albanez", encerradoAt: shift(-20),
        documents: [{ id: uid(), title: "Termo de Autorização - Gabriel Kobielski.pdf", inclusionDate: shift(-300), validityDate: shift(-30) }]
      },
      {
        id: uid(), ref: "005C49", address: "Av. Santo Onofre, 609, Lutherking, Francisco Beltrão - PR",
        clientId: c3.id, clientName: c3.name, collaborator: "Marina Urio", encerradoAt: null,
        documents: [{ id: uid(), title: "Termo de Autorização - Gustavo Hofmann.pdf", inclusionDate: shift(-60), validityDate: shift(15) }]
      }
    ];
    return s;
  }

  // ============ DERIVED STATUS ============
  function docStatus(doc) {
    if (!doc.validityDate) return { key: "sem", label: "Sem validade" };
    const d = daysBetween(todayISO(), doc.validityDate);
    if (d < 0) return { key: "vencido", label: `Vencido há ${Math.abs(d)} dia${Math.abs(d) === 1 ? "" : "s"}` };
    if (d <= state.company.janela) return { key: "proximo", label: d === 0 ? "Vence hoje" : `Vence em ${d} dia${d === 1 ? "" : "s"}` };
    return { key: "vigente", label: "Vigente" };
  }

  function recordDerived(rec) {
    if (rec.encerradoAt) {
      return { status: "encerrado", label: "Encerrado", vencimento: null, ultimoRegistro: lastDocDate(rec) };
    }
    if (!rec.documents.length) {
      return { status: "sem", label: "Sem documentos", vencimento: null, ultimoRegistro: null };
    }
    const withValidity = rec.documents.filter(d => d.validityDate);
    const vencimento = withValidity.length ? withValidity.map(d => d.validityDate).sort().slice(-1)[0] : null;
    const ultimoRegistro = lastDocDate(rec);
    if (!vencimento) return { status: "sem", label: "Sem vencimento", vencimento: null, ultimoRegistro };
    const d = daysBetween(todayISO(), vencimento);
    let status, label;
    if (d < 0) { status = "vencido"; label = `Vencido há ${Math.abs(d)} dia${Math.abs(d) === 1 ? "" : "s"}`; }
    else if (d <= state.company.janela) { status = "proximo"; label = d === 0 ? "Vence hoje" : `Vence em ${d} dia${d === 1 ? "" : "s"}`; }
    else { status = "vigente"; label = "Vigente"; }
    return { status, label, vencimento, ultimoRegistro };
  }

  function lastDocDate(rec) {
    if (!rec.documents.length) return null;
    return rec.documents.map(d => d.inclusionDate).sort().slice(-1)[0];
  }

  function badgeHTML(status, label) {
    return `<span class="badge badge-${status}">${label}</span>`;
  }

  // ============ NAVIGATION ============
  const views = {
    dashboard: { title: "Painel Inicial", icon: 'M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z' },
    registros: { title: "Registro Geral", icon: 'M4 5a2 2 0 0 1 2-2h6l2 2h6a2 2 0 0 1 2 2v2H4V5zm0 4h18v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z' },
    clientes: { title: "Clientes", icon: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5zm8-6a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0 2c-.8 0-1.7.1-2.5.4 1.6 1.1 2.5 2.6 2.5 4.6v1h6v-1c0-3-3-5-6-5z' },
    configuracoes: { title: "Configurações", icon: 'M19.14 12.94a7.07 7.07 0 0 0 .06-.94 7.07 7.07 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.14.56-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.62-.06.94s.02.63.06.94L2.82 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.42.32.6.22l2.39-.96c.49.38 1.04.7 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.14-.56 1.63-.94l2.39.96c.24.1.46 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.56zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z' }
  };

  function goTo(view) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(`view-${view}`).classList.add("active");
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    document.getElementById("viewTitle").querySelector("h1").textContent = views[view].title;
    document.getElementById("viewIcon").innerHTML = `<path d="${views[view].icon}" fill="currentColor"/>`;
    closeSidebar();
    renderAll();
  }

  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.addEventListener("click", () => goTo(btn.dataset.view));
  });

  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("scrim");
  document.getElementById("burger").addEventListener("click", () => {
    sidebar.classList.add("open"); scrim.classList.add("show");
  });
  scrim.addEventListener("click", closeSidebar);
  function closeSidebar() { sidebar.classList.remove("open"); scrim.classList.remove("show"); }

  // ============ TOAST ============
  let toastTimer = null;
  function toast(msg, isError = false) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.toggle("error", isError);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ============ DASHBOARD ============
  function renderDashboard() {
    const active = state.records.filter(r => !r.encerradoAt);
    const derived = state.records.map(r => ({ rec: r, d: recordDerived(r) }));
    const counts = { vigente: 0, proximo: 0, vencido: 0, encerrado: 0 };
    derived.forEach(({ d }) => { if (counts[d.status] !== undefined) counts[d.status]++; });

    document.getElementById("statTotal").textContent = active.length;
    document.getElementById("statVigentes").textContent = counts.vigente;
    document.getElementById("statProximo").textContent = counts.proximo;
    document.getElementById("statVencidos").textContent = counts.vencido;
    document.getElementById("statEncerrados").textContent = counts.encerrado;

    const recent = [...state.records]
      .sort((a, b) => (lastDocDate(b) || "").localeCompare(lastDocDate(a) || ""))
      .slice(0, 6);
    const tbody = document.querySelector("#recentTable tbody");
    tbody.innerHTML = recent.map(r => {
      const d = recordDerived(r);
      return `<tr>
        <td class="cell-strong">${escapeHTML(r.ref)}</td>
        <td class="cell-muted">${escapeHTML(r.address)}</td>
        <td>${escapeHTML(r.clientName)}</td>
        <td>${badgeHTML(d.status, d.label)}</td>
      </tr>`;
    }).join("");
    document.getElementById("recentEmpty").hidden = recent.length > 0;
  }

  // ============ REGISTROS ============
  function renderRegistros() {
    const q = document.getElementById("searchRegistros").value.trim().toLowerCase();
    const rows = state.records.filter(r => {
      if (!q) return true;
      return [r.ref, r.address, r.clientName].some(v => (v || "").toLowerCase().includes(q));
    }).sort((a, b) => a.ref.localeCompare(b.ref, "pt-BR", { numeric: true }));

    const tbody = document.querySelector("#registrosTable tbody");
    tbody.innerHTML = rows.map(r => {
      const d = recordDerived(r);
      return `<tr data-id="${r.id}">
        <td class="cell-strong">${escapeHTML(r.ref)}</td>
        <td class="cell-muted">${escapeHTML(r.address)}</td>
        <td>${escapeHTML(r.clientName)}</td>
        <td class="cell-muted">${formatDateBR(d.ultimoRegistro)}</td>
        <td class="cell-muted">${formatDateBR(d.vencimento)}</td>
        <td>${badgeHTML(d.status, d.label)}</td>
        <td class="cell-muted">${formatDateBR(r.encerradoAt)}</td>
        <td>
          <div class="row-actions">
            <button class="row-action" data-edit-registro="${r.id}" aria-label="Editar registro">
              <svg viewBox="0 0 24 24"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
            </button>
            <button class="row-action" data-del-registro="${r.id}" aria-label="Excluir registro">
              <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join("");
    document.getElementById("registrosEmpty").hidden = rows.length > 0;

    tbody.querySelectorAll("[data-edit-registro]").forEach(b =>
      b.addEventListener("click", () => openRegistroModal(b.dataset.editRegistro)));
    tbody.querySelectorAll("[data-del-registro]").forEach(b =>
      b.addEventListener("click", () => deleteRegistro(b.dataset.delRegistro)));
  }

  function deleteRegistro(id) {
    const rec = state.records.find(r => r.id === id);
    if (!rec) return;
    if (!confirm(`Excluir o registro ${rec.ref}? Esta ação não pode ser desfeita.`)) return;
    state.records = state.records.filter(r => r.id !== id);
    saveState(); renderAll();
    toast("Registro excluído.");
  }

  document.getElementById("searchRegistros").addEventListener("input", renderRegistros);

  // ============ CLIENTES ============
  function renderClientes() {
    const q = document.getElementById("searchClientes").value.trim().toLowerCase();
    const sort = document.getElementById("sortClientes").value;
    let list = state.clients.filter(c => !q || c.name.toLowerCase().includes(q) || onlyDigits(c.phone).includes(onlyDigits(q)));
    if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    else if (sort === "za") list.sort((a, b) => b.name.localeCompare(a.name, "pt-BR"));
    else list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    const grid = document.getElementById("clientGrid");
    grid.innerHTML = list.map(c => `
      <div class="client-card" data-client="${c.id}">
        <div class="avatar">${initials(c.name)}</div>
        <div class="client-info">
          <p class="client-name">${escapeHTML(c.name)}</p>
          <p class="client-phone">${escapeHTML(c.phone || "-")}</p>
        </div>
      </div>`).join("");
    document.getElementById("clientsEmpty").hidden = list.length > 0;

    grid.querySelectorAll("[data-client]").forEach(card =>
      card.addEventListener("click", () => openClienteModal(card.dataset.client)));
  }

  document.getElementById("searchClientes").addEventListener("input", renderClientes);
  document.getElementById("sortClientes").addEventListener("change", renderClientes);

  // ============ MODAL: CLIENTE ============
  const modalCliente = document.getElementById("modalCliente");
  const formCliente = document.getElementById("formCliente");

  function openClienteModal(id) {
    formCliente.reset();
    const isEdit = !!id;
    document.getElementById("clienteModalTitle").textContent = isEdit ? "Editar Cliente" : "Novo Cliente";
    document.getElementById("btnDeleteCliente").hidden = !isEdit;
    if (isEdit) {
      const c = state.clients.find(x => x.id === id);
      document.getElementById("clienteId").value = c.id;
      document.getElementById("clienteNome").value = c.name;
      document.getElementById("clienteTelefone").value = c.phone;
      document.getElementById("clienteEndereco").value = c.address || "";
    } else {
      document.getElementById("clienteId").value = "";
    }
    openModal(modalCliente);
  }

  document.getElementById("btnNovoCliente").addEventListener("click", () => openClienteModal(null));

  formCliente.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("clienteId").value;
    const name = document.getElementById("clienteNome").value.trim();
    const phone = document.getElementById("clienteTelefone").value.trim();
    const address = document.getElementById("clienteEndereco").value.trim();
    if (!name || !phone) return;

    if (id) {
      const c = state.clients.find(x => x.id === id);
      const oldName = c.name;
      Object.assign(c, { name, phone, address });
      state.records.forEach(r => { if (r.clientId === id || r.clientName === oldName) r.clientName = name; });
      toast("Cliente atualizado.");
    } else {
      state.clients.push({ id: uid(), name, phone, address, createdAt: todayISO() });
      toast("Cliente adicionado.");
    }
    saveState();
    closeModal(modalCliente);
    renderAll();
  });

  document.getElementById("btnDeleteCliente").addEventListener("click", () => {
    const id = document.getElementById("clienteId").value;
    const c = state.clients.find(x => x.id === id);
    if (!c) return;
    const linked = state.records.filter(r => r.clientId === id).length;
    const warn = linked ? ` Este cliente está vinculado a ${linked} registro(s), que permanecerão com o nome salvo.` : "";
    if (!confirm(`Excluir o cliente ${c.name}?${warn}`)) return;
    state.clients = state.clients.filter(x => x.id !== id);
    saveState();
    closeModal(modalCliente);
    renderAll();
    toast("Cliente excluído.");
  });

  // ============ MODAL: REGISTRO ============
  const modalRegistro = document.getElementById("modalRegistro");
  const formRegistro = document.getElementById("formRegistro");
  let pendingDocs = [];
  let editingRegistroId = null;

  function nextRef() {
    const nums = state.records.map(r => parseInt((r.ref.match(/(\d+)$/) || [0])[0], 10)).filter(n => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 45;
    return `005C${max + 1}`;
  }

  function refreshDatalists() {
    document.getElementById("clientesList").innerHTML = state.clients.map(c => `<option value="${escapeHTML(c.name)}">`).join("");
    document.getElementById("colaboradoresList").innerHTML = state.collaborators.map(c => `<option value="${escapeHTML(c)}">`).join("");
  }

  function openRegistroModal(id) {
    formRegistro.reset();
    pendingDocs = [];
    editingRegistroId = id || null;
    refreshDatalists();

    const isEdit = !!id;
    document.getElementById("registroModalTitle").textContent = isEdit ? "Edição de Registro" : "Novo Registro";
    document.getElementById("btnEncerrarRegistro").hidden = !isEdit;
    document.getElementById("btnContatarCliente").hidden = !isEdit;

    if (isEdit) {
      const r = state.records.find(x => x.id === id);
      document.getElementById("registroId").value = r.id;
      document.getElementById("registroEndereco").value = r.address;
      document.getElementById("registroRef").value = r.ref;
      document.getElementById("registroCliente").value = r.clientName;
      document.getElementById("registroColaborador").value = r.collaborator || "";
      pendingDocs = r.documents.map(d => ({ ...d }));
      const rec = recordDerived(r);
      document.getElementById("btnEncerrarRegistro").textContent = r.encerradoAt ? "Reabrir Registro" : "Encerrar Registro";
    } else {
      document.getElementById("registroId").value = "";
      document.getElementById("registroRef").value = nextRef();
    }
    renderDocsTable();
    openModal(modalRegistro);
  }

  document.getElementById("btnNovoRegistro").addEventListener("click", () => openRegistroModal(null));

  function renderDocsTable() {
    const tbody = document.querySelector("#docsTable tbody");
    tbody.innerHTML = pendingDocs.map((d, i) => {
      const s = docStatus(d);
      return `<tr>
        <td>
          <div class="doc-title-cell">
            <svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z" stroke="currentColor" stroke-width="1.6"/></svg>
            <span title="${escapeHTML(d.title)}">${escapeHTML(d.title)}</span>
          </div>
        </td>
        <td>${formatDateBR(d.inclusionDate)}</td>
        <td><input type="date" value="${d.validityDate || ""}" data-doc-validity="${i}"></td>
        <td>${badgeHTML(s.key, s.label)}</td>
        <td><button type="button" class="row-action" data-doc-remove="${i}" aria-label="Remover documento">
          <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2"/></svg>
        </button></td>
      </tr>`;
    }).join("");
    document.getElementById("docsEmpty").hidden = pendingDocs.length > 0;

    tbody.querySelectorAll("[data-doc-validity]").forEach(inp => {
      inp.addEventListener("change", () => {
        pendingDocs[+inp.dataset.docValidity].validityDate = inp.value || null;
        renderDocsTable();
      });
    });
    tbody.querySelectorAll("[data-doc-remove]").forEach(btn => {
      btn.addEventListener("click", () => {
        pendingDocs.splice(+btn.dataset.docRemove, 1);
        renderDocsTable();
      });
    });
  }

  function addFiles(fileList) {
    Array.from(fileList).forEach(f => {
      pendingDocs.push({ id: uid(), title: f.name, inclusionDate: todayISO(), validityDate: null });
    });
    renderDocsTable();
  }

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });
  ["dragenter", "dragover"].forEach(evt => dropzone.addEventListener(evt, (e) => {
    e.preventDefault(); dropzone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(evt => dropzone.addEventListener(evt, (e) => {
    e.preventDefault(); dropzone.classList.remove("dragover");
  }));
  dropzone.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  formRegistro.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("registroId").value;
    const address = document.getElementById("registroEndereco").value.trim();
    const ref = document.getElementById("registroRef").value.trim();
    const clientName = document.getElementById("registroCliente").value.trim();
    const collaborator = document.getElementById("registroColaborador").value.trim();
    if (!address || !ref || !clientName) return;

    if (collaborator && !state.collaborators.includes(collaborator)) state.collaborators.push(collaborator);
    const matchedClient = state.clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());

    if (id) {
      const r = state.records.find(x => x.id === id);
      Object.assign(r, { address, ref, clientName, clientId: matchedClient ? matchedClient.id : null, collaborator, documents: pendingDocs });
      toast("Registro atualizado.");
    } else {
      state.records.push({
        id: uid(), ref, address, clientName, clientId: matchedClient ? matchedClient.id : null,
        collaborator, encerradoAt: null, documents: pendingDocs
      });
      toast("Registro criado.");
    }
    saveState();
    closeModal(modalRegistro);
    renderAll();
  });

  document.getElementById("btnEncerrarRegistro").addEventListener("click", () => {
    const r = state.records.find(x => x.id === editingRegistroId);
    if (!r) return;
    if (r.encerradoAt) {
      r.encerradoAt = null;
      toast("Registro reaberto.");
    } else {
      if (!confirm(`Encerrar o registro ${r.ref}?`)) return;
      r.encerradoAt = todayISO();
      toast("Registro encerrado.");
    }
    saveState();
    closeModal(modalRegistro);
    renderAll();
  });

  document.getElementById("btnContatarCliente").addEventListener("click", () => {
    const r = state.records.find(x => x.id === editingRegistroId);
    if (!r) return;
    const client = state.clients.find(c => c.id === r.clientId) || state.clients.find(c => c.name === r.clientName);
    const phoneDigits = onlyDigits(client ? client.phone : "");
    if (!phoneDigits) { toast("Cliente sem telefone cadastrado.", true); return; }
    const full = phoneDigits.length <= 11 ? `55${phoneDigits}` : phoneDigits;
    const msg = encodeURIComponent(`Olá ${r.clientName.split(" ")[0]}, tudo bem? Estou entrando em contato sobre o registro ${r.ref} (${r.address}).`);
    window.open(`https://wa.me/${full}?text=${msg}`, "_blank", "noopener");
  });

  // ============ MODAL HELPERS ============
  function openModal(el) { el.classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeModal(el) { el.classList.remove("open"); document.body.style.overflow = ""; }
  document.querySelectorAll(".close-modal").forEach(btn =>
    btn.addEventListener("click", () => closeModal(document.getElementById(btn.dataset.close))));
  document.querySelectorAll(".modal-backdrop").forEach(bd =>
    bd.addEventListener("click", (e) => { if (e.target === bd) closeModal(bd); }));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal-backdrop.open").forEach(closeModal);
  });

  // ============ CONFIGURAÇÕES ============
  function fillSettingsForm() {
    document.getElementById("cfgNome").value = state.company.nome || "";
    document.getElementById("cfgWhats").value = state.company.whats || "";
    document.getElementById("cfgEndereco").value = state.company.endereco || "";
    document.getElementById("cfgJanela").value = state.company.janela || 30;
  }

  document.getElementById("formEmpresa").addEventListener("submit", (e) => {
    e.preventDefault();
    state.company = {
      nome: document.getElementById("cfgNome").value.trim(),
      whats: document.getElementById("cfgWhats").value.trim(),
      endereco: document.getElementById("cfgEndereco").value.trim(),
      janela: parseInt(document.getElementById("cfgJanela").value, 10) || 30
    };
    saveState();
    renderAll();
    toast("Configurações salvas.");
  });

  document.getElementById("btnExport").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gavi-backup-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("Backup exportado.");
  });

  document.getElementById("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.clients || !parsed.records) throw new Error("formato inválido");
        state = Object.assign(defaultState(), parsed);
        saveState();
        renderAll();
        fillSettingsForm();
        toast("Backup importado com sucesso.");
      } catch (err) {
        toast("Arquivo inválido. Verifique o backup.", true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("btnSeed").addEventListener("click", () => {
    if (!confirm("Isso irá adicionar os dados de demonstração novamente. Deseja continuar?")) return;
    state = seedState();
    saveState();
    renderAll();
    fillSettingsForm();
    toast("Dados de exemplo restaurados.");
  });

  document.getElementById("btnWipe").addEventListener("click", () => {
    if (!confirm("Tem certeza? Todos os clientes, registros e documentos serão apagados permanentemente.")) return;
    state = defaultState();
    saveState();
    renderAll();
    fillSettingsForm();
    toast("Todos os dados foram apagados.");
  });

  // ============ UTIL ============
  function escapeHTML(str) {
    return (str ?? "").toString().replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  function renderAll() {
    renderDashboard();
    renderRegistros();
    renderClientes();
  }

  fillSettingsForm();
  renderAll();
})();
