(function(){
  "use strict";

  const SUPABASE_URL = "https://lipkgzneyweiyjoanrcm.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_z5RxIO2RbVPaBvvh0GYpOQ_obEe_F8I";
  const STATUS_LABELS = {
    idea:"Idea",
    desarrollo:"En desarrollo",
    prueba:"En prueba",
    piloto:"Piloto",
    disponible:"Disponible",
    en_uso:"En uso",
    pausada:"Pausada",
    archivada:"Archivada"
  };

  const state = { tools: [], filtered: [] };
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const asArray = value => Array.isArray(value) ? value : String(value || "").split(",").map(v => v.trim()).filter(Boolean);
  const label = value => STATUS_LABELS[value] || value || "Sin estado";
  const validUrl = value => {
    if(!value) return false;
    try { const url = new URL(value, window.location.href); return ["http:","https:"].includes(url.protocol) || !value.includes(":"); }
    catch { return false; }
  };

  function client(){
    if(!window.supabase || !window.supabase.createClient) return null;
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  async function loadTools(){
    const message = $("toolboxMessage");
    try{
      const supabase = client();
      if(!supabase) throw new Error("No se pudo cargar Supabase JS.");
      const { data, error } = await supabase
        .from("toolbox_tools")
        .select("id,name,slug,description,url,icon,category,tags,status,featured,sort_order,target_users,potential_users,business_area,problem_solved,expected_impact,technologies,version")
        .eq("active", true)
        .order("sort_order", { ascending:true })
        .order("name", { ascending:true });
      if(error) throw error;
      state.tools = data || [];
      fillFilters();
      applyFilters();
      if(message) message.hidden = true;
    }catch(error){
      if(message){
        message.hidden = false;
        message.textContent = "Toolbox no pudo conectarse temporalmente a Supabase. El catálogo principal sigue disponible.";
      }
      updateCount(0);
    }
  }

  function unique(field){
    return [...new Set(state.tools.map(t => t[field]).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b), "es"));
  }

  function fillSelect(id, values){
    const node = $(id);
    if(!node || node.dataset.ready) return;
    const first = node.querySelector("option")?.outerHTML || "<option value=''>Todos</option>";
    node.innerHTML = first + values.map(value => `<option value="${esc(value)}">${esc(label(value))}</option>`).join("");
    node.dataset.ready = "true";
  }

  function fillFilters(){
    fillSelect("toolboxCategory", unique("category"));
    fillSelect("toolboxStatus", unique("status"));
    fillSelect("toolboxArea", unique("business_area"));
  }

  function haystack(tool){
    return [
      tool.name, tool.description, tool.category, tool.status, tool.business_area,
      tool.target_users, tool.potential_users, ...(tool.tags || [])
    ].join(" ").toLowerCase();
  }

  function applyFilters(){
    const q = ($("toolboxSearch")?.value || "").trim().toLowerCase();
    const category = $("toolboxCategory")?.value || "";
    const status = $("toolboxStatus")?.value || "";
    const area = $("toolboxArea")?.value || "";
    const featured = $("toolboxFeatured")?.checked || false;
    state.filtered = state.tools.filter(tool => {
      if(q && !haystack(tool).includes(q)) return false;
      if(category && tool.category !== category) return false;
      if(status && tool.status !== status) return false;
      if(area && tool.business_area !== area) return false;
      if(featured && !tool.featured) return false;
      return true;
    });
    renderCards();
  }

  function updateCount(count){
    const countNode = $("toolboxCount");
    const indexNode = $("toolboxIndexCount");
    if(countNode) countNode.textContent = `${count} herramienta${count === 1 ? "" : "s"} visible${count === 1 ? "" : "s"}`;
    if(indexNode) indexNode.textContent = String(state.tools.length || count);
  }

  function openAction(tool, extraClass){
    if(!validUrl(tool.url)) return `<span class="btn toolbox-btn-disabled ${extraClass || ""}">En preparación</span>`;
    return `<a class="btn primary ${extraClass || ""}" href="${esc(tool.url)}" target="_blank" rel="noopener">Abrir herramienta</a>`;
  }

  function renderCards(){
    const grid = $("toolboxGrid");
    if(!grid) return;
    updateCount(state.filtered.length);
    if(!state.filtered.length){
      grid.innerHTML = `<div class="toolbox-message">No hay herramientas que coincidan con los filtros actuales.</div>`;
      return;
    }
    grid.innerHTML = state.filtered.map(tool => `
      <article class="toolbox-card" data-toolbox-id="${esc(tool.id)}">
        <div class="toolbox-card-top">
          <div class="toolbox-icon">${esc(tool.icon || "🧰")}</div>
          <div>
            <h3>${esc(tool.name)}</h3>
            <p>${esc(tool.description)}</p>
          </div>
        </div>
        <div class="toolbox-meta">
          <span class="toolbox-pill">${esc(tool.category || "Utilidad")}</span>
          <span class="toolbox-pill state">${esc(label(tool.status))}</span>
          ${tool.business_area ? `<span class="toolbox-pill">${esc(tool.business_area)}</span>` : ""}
          ${tool.featured ? `<span class="toolbox-pill off">Destacada</span>` : ""}
        </div>
        ${(tool.tags || []).length ? `<div class="toolbox-meta">${tool.tags.slice(0,5).map(tag => `<span class="toolbox-pill">${esc(tag)}</span>`).join("")}</div>` : ""}
        ${tool.target_users || tool.potential_users ? `<div class="toolbox-small" style="margin-top:10px">${esc(tool.target_users || tool.potential_users)}</div>` : ""}
        <div class="toolbox-card-actions">${openAction(tool)}<span class="btn" data-detail>Ver ficha</span></div>
      </article>
    `).join("");
  }

  function renderDetail(tool){
    return `<div class="toolbox-detail">
      <div class="toolbox-icon">${esc(tool.icon || "🧰")}</div>
      <h3>${esc(tool.name)}</h3>
      <p class="lead">${esc(tool.description)}</p>
      <div class="toolbox-detail-grid">
        ${detailBlock("Problema que resuelve", tool.problem_solved)}
        ${detailBlock("Impacto esperado", tool.expected_impact)}
        ${detailBlock("Dirigido a", tool.target_users)}
        ${detailBlock("Posibles usuarios", tool.potential_users)}
        ${detailBlock("Estado", label(tool.status))}
        ${detailBlock("Versión", tool.version)}
        ${detailBlock("Tecnologías", asArray(tool.technologies).join(", "))}
        ${detailBlock("Etiquetas", asArray(tool.tags).join(", "))}
      </div>
      <div class="toolbox-card-actions" style="margin-top:14px">${openAction(tool)}</div>
    </div>`;
  }

  function detailBlock(title, value){
    if(!value) return "";
    return `<div class="toolbox-detail-block"><b>${esc(title)}</b><span>${esc(value)}</span></div>`;
  }

  function openDetail(id){
    const tool = state.tools.find(item => item.id === id);
    const modal = $("toolboxModal");
    const body = $("toolboxModalBody");
    if(!tool || !modal || !body) return;
    body.innerHTML = renderDetail(tool);
    modal.hidden = false;
  }

  function bind(){
    ["toolboxSearch","toolboxCategory","toolboxStatus","toolboxArea","toolboxFeatured"].forEach(id => {
      const node = $(id);
      if(node) node.addEventListener("input", applyFilters);
      if(node) node.addEventListener("change", applyFilters);
    });
    document.addEventListener("click", event => {
      const card = event.target.closest("[data-toolbox-id]");
      if(card && !event.target.closest("a")) openDetail(card.dataset.toolboxId);
      if(event.target.closest(".toolbox-close") || event.target.id === "toolboxModal") {
        const modal = $("toolboxModal");
        if(modal) modal.hidden = true;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if(!$("toolboxSlide")) return;
    bind();
    loadTools();
  });
})();
