(function(){
  "use strict";

  const SUPABASE_URL = "https://lipkgzneyweiyjoanrcm.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_z5RxIO2RbVPaBvvh0GYpOQ_obEe_F8I";
  const STATUSES = ["idea","desarrollo","prueba","piloto","disponible","en_uso","pausada","archivada"];
  const STATUS_LABELS = {idea:"Idea",desarrollo:"En desarrollo",prueba:"En prueba",piloto:"Piloto",disponible:"Disponible",en_uso:"En uso",pausada:"Pausada",archivada:"Archivada"};
  const state = { tools: [], adoption: [], needs: [], user: null };
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const arr = value => String(value || "").split(",").map(v => v.trim()).filter(Boolean);
  const val = id => $(id)?.value?.trim() || "";
  const checked = id => !!$(id)?.checked;
  const label = status => STATUS_LABELS[status] || status || "Sin estado";
  const toolName = id => state.tools.find(t => t.id === id)?.name || "Herramienta";
  const slugify = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const supabase = () => window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let db;

  function message(text, isError){
    const node = $("adminMessage");
    if(!node) return;
    const friendly = String(text || "").includes("Invalid login credentials")
      ? "No se pudo iniciar sesión. Revisá que el usuario exista en Supabase Auth, que la contraseña sea correcta y que ese usuario esté agregado en toolbox_admins."
      : text;
    node.textContent = friendly;
    node.classList.toggle("is-error", !!isError);
  }

  async function guarded(button, task){
    const original = button?.textContent;
    if(button){ button.disabled = true; button.textContent = "Guardando..."; }
    try { await task(); }
    catch(error){ message(error.message || "Ocurrió un error.", true); }
    finally { if(button){ button.disabled = false; button.textContent = original; } }
  }

  async function init(){
    try{
      if(!window.supabase) throw new Error("No se pudo cargar Supabase JS.");
      db = supabase();
      fillStatusOptions();
      bind();
      const { data } = await db.auth.getSession();
      state.user = data.session?.user || null;
      if(state.user) await verifyAdmin();
      else showLogin();
    }catch(error){
      message(error.message, true);
      showLogin();
    }
  }

  function showLogin(){
    $("loginForm").hidden = false;
    $("adminApp").hidden = true;
    $("logoutBtn").hidden = true;
    message("Inicia sesión con una cuenta autorizada en toolbox_admins.");
  }

  async function verifyAdmin(){
    const { data, error } = await db.from("toolbox_admins").select("user_id").eq("user_id", state.user.id).maybeSingle();
    if(error || !data){
      await db.auth.signOut();
      state.user = null;
      showLogin();
      message("La cuenta inició sesión, pero no está registrada como administradora.", true);
      return;
    }
    $("loginForm").hidden = true;
    $("adminApp").hidden = false;
    $("logoutBtn").hidden = false;
    message(`Sesión activa: ${state.user.email}`);
    await refreshAll();
  }

  async function refreshAll(){
    const [tools, adoption, needs] = await Promise.all([
      db.from("toolbox_tools").select("*").order("sort_order", { ascending:true }).order("name", { ascending:true }),
      db.from("toolbox_adoption").select("*").order("created_at", { ascending:false }),
      db.from("toolbox_needs").select("*").order("created_at", { ascending:false })
    ]);
    if(tools.error) throw tools.error;
    if(adoption.error) throw adoption.error;
    if(needs.error) throw needs.error;
    state.tools = tools.data || [];
    state.adoption = adoption.data || [];
    state.needs = needs.data || [];
    fillToolSelects();
    renderAll();
  }

  function fillStatusOptions(){
    const node = $("toolStatus");
    if(node) node.innerHTML = STATUSES.map(status => `<option value="${status}">${label(status)}</option>`).join("");
  }

  function fillToolSelects(){
    const options = state.tools.map(tool => `<option value="${esc(tool.id)}">${esc(tool.name)}</option>`).join("");
    ["adoptionTool","needTool"].forEach(id => { const node = $(id); if(node) node.innerHTML = options; });
  }

  function filteredTools(){
    const filters = {
      name: val("filterName").toLowerCase(),
      category: val("filterCategory").toLowerCase(),
      status: val("filterStatus").toLowerCase(),
      project: val("filterProject").toLowerCase(),
      organization: val("filterOrganization").toLowerCase(),
      area: val("filterArea").toLowerCase(),
      owner: val("filterOwner").toLowerCase()
    };
    const adoptionByTool = new Map(state.adoption.map(a => [a.tool_id, [a.organization, a.project_site].join(" ").toLowerCase()]));
    return state.tools.filter(tool => {
      if(filters.name && !String(tool.name).toLowerCase().includes(filters.name)) return false;
      if(filters.category && !String(tool.category).toLowerCase().includes(filters.category)) return false;
      if(filters.status && !String(tool.status).toLowerCase().includes(filters.status)) return false;
      if(filters.area && !String(tool.business_area).toLowerCase().includes(filters.area)) return false;
      if(filters.owner && !String(tool.owner).toLowerCase().includes(filters.owner)) return false;
      if(filters.project && !String(adoptionByTool.get(tool.id) || "").includes(filters.project)) return false;
      if(filters.organization && !String(adoptionByTool.get(tool.id) || "").includes(filters.organization)) return false;
      return true;
    });
  }

  function renderAll(){
    renderDashboard();
    renderTools();
    renderAdoption();
    renderNeeds();
  }

  function renderDashboard(){
    const tools = filteredTools();
    const adoptedToolIds = new Set(state.adoption.filter(a => a.active !== false).map(a => a.tool_id));
    const needsToolIds = new Set(state.needs.map(n => n.tool_id));
    const projects = new Set(state.adoption.map(a => [a.organization, a.project_site].filter(Boolean).join(" / ")).filter(Boolean));
    const kpis = [
      ["Total de herramientas", tools.length],
      ["Activas", tools.filter(t => t.active).length],
      ["En desarrollo", tools.filter(t => t.status === "desarrollo").length],
      ["En piloto", tools.filter(t => t.status === "piloto").length],
      ["En uso", tools.filter(t => t.status === "en_uso").length],
      ["Sin usuarios registrados", tools.filter(t => !adoptedToolIds.has(t.id)).length],
      ["Con interesados", tools.filter(t => needsToolIds.has(t.id)).length],
      ["Proyectos usando Toolbox", projects.size]
    ];
    $("dashboardCards").innerHTML = kpis.map(([name, value]) => `<div class="toolbox-kpi"><b>${value}</b><span>${esc(name)}</span></div>`).join("");
    const counts = [...state.adoption.reduce((map, item) => map.set(item.tool_id, (map.get(item.tool_id) || 0) + 1), new Map())]
      .sort((a,b) => b[1] - a[1]).slice(0,5);
    $("topAdopted").innerHTML = `<div class="toolbox-row"><b>Herramientas más adoptadas</b>${counts.length ? counts.map(([id,count]) => `<small>${esc(toolName(id))}: ${count} registro${count === 1 ? "" : "s"}</small>`).join("") : "<small>Sin registros de adopción todavía.</small>"}</div>`;
  }

  function renderTools(){
    $("toolList").innerHTML = state.tools.map(tool => `
      <div class="toolbox-row">
        <div class="toolbox-row-main"><div><b>${esc(tool.icon || "🧰")} ${esc(tool.name)}</b><small>${esc(tool.category || "")} · ${esc(label(tool.status))} · ${tool.active ? "Activa" : "Inactiva"}</small></div><small>Orden ${esc(tool.sort_order || 0)}</small></div>
        <small>${esc(tool.description || "")}</small>
        <div class="toolbox-admin-actions">
          <button type="button" data-edit-tool="${esc(tool.id)}">Editar</button>
          <button type="button" data-toggle-tool="${esc(tool.id)}">${tool.active ? "Desactivar" : "Activar"}</button>
          <button type="button" data-feature-tool="${esc(tool.id)}">${tool.featured ? "Quitar destacada" : "Destacar"}</button>
          <button type="button" data-delete-tool="${esc(tool.id)}">Eliminar</button>
        </div>
      </div>`).join("") || `<div class="toolbox-row">Sin herramientas registradas.</div>`;
  }

  function renderAdoption(){
    $("adoptionList").innerHTML = state.adoption.map(item => `
      <div class="toolbox-row">
        <b>${esc(toolName(item.tool_id))}</b>
        <small>${esc(item.organization || "")} · ${esc(item.project_site || "")} · ${esc(item.usage_status || "")}</small>
        <small>Responsable: ${esc(item.responsible_person || "Sin registrar")} · Usuarios: ${esc(item.estimated_users || 0)}</small>
        <div class="toolbox-admin-actions"><button type="button" data-edit-adoption="${esc(item.id)}">Editar</button><button type="button" data-delete-adoption="${esc(item.id)}">Eliminar</button></div>
      </div>`).join("") || `<div class="toolbox-row">Sin adopciones registradas.</div>`;
  }

  function renderNeeds(){
    $("needList").innerHTML = state.needs.map(item => `
      <div class="toolbox-row">
        <b>${esc(toolName(item.tool_id))}</b>
        <small>${esc(item.organization || "")} · ${esc(item.project_site || "")} · ${esc(item.need_level || "")}</small>
        <small>Contacto: ${esc(item.contact_person || "Sin registrar")} · Estado: ${esc(item.status || "")}</small>
        <div class="toolbox-admin-actions"><button type="button" data-edit-need="${esc(item.id)}">Editar</button><button type="button" data-delete-need="${esc(item.id)}">Eliminar</button></div>
      </div>`).join("") || `<div class="toolbox-row">Sin necesidades registradas.</div>`;
  }

  function toolPayload(){
    const url = val("toolUrl");
    if(url){ new URL(url, window.location.href); }
    const name = val("toolName");
    return {
      name,
      slug: slugify(name),
      description: val("toolDescription"),
      url: url || null,
      icon: val("toolIcon") || "🧰",
      category: val("toolCategory") || "Utilidad",
      tags: arr(val("toolTags")),
      status: val("toolStatus") || "idea",
      active: checked("toolActive"),
      featured: checked("toolFeatured"),
      sort_order: Number(val("toolOrder") || 0),
      target_users: val("toolTarget") || null,
      potential_users: val("toolPotential") || null,
      business_area: val("toolArea") || null,
      problem_solved: val("toolProblem") || null,
      expected_impact: val("toolImpact") || null,
      technologies: arr(val("toolTech")),
      owner: val("toolOwner") || null,
      version: val("toolVersion") || null,
      notes: val("toolNotes") || null
    };
  }

  function adoptionPayload(){
    return {
      tool_id: val("adoptionTool"),
      organization: val("adoptionOrg") || null,
      project_site: val("adoptionProject") || null,
      department: val("adoptionDepartment") || null,
      responsible_person: val("adoptionResponsible") || null,
      usage_status: val("adoptionStatus") || null,
      estimated_users: val("adoptionUsers") ? Number(val("adoptionUsers")) : null,
      start_date: val("adoptionStart") || null,
      notes: val("adoptionNotes") || null,
      active: checked("adoptionActive")
    };
  }

  function needPayload(){
    return {
      tool_id: val("needTool"),
      organization: val("needOrg") || null,
      project_site: val("needProject") || null,
      department: val("needDepartment") || null,
      contact_person: val("needContact") || null,
      need_level: val("needLevel") || null,
      status: val("needStatus") || null,
      notes: val("needNotes") || null
    };
  }

  async function save(table, id, payload){
    const request = id ? db.from(table).update(payload).eq("id", id) : db.from(table).insert(payload);
    const { error } = await request;
    if(error) throw error;
    message("Cambios guardados correctamente.");
    await refreshAll();
  }

  async function remove(table, id, labelText){
    if(!confirm(`Escribí OK en la siguiente confirmación para eliminar ${labelText}.`)) return;
    if(prompt("Confirmación explícita: escribí OK para eliminar.") !== "OK") return;
    const { error } = await db.from(table).delete().eq("id", id);
    if(error) throw error;
    message("Registro eliminado.");
    await refreshAll();
  }

  function editTool(id){
    const tool = state.tools.find(t => t.id === id);
    if(!tool) return;
    $("toolId").value = tool.id; $("toolName").value = tool.name || ""; $("toolUrl").value = tool.url || ""; $("toolIcon").value = tool.icon || "🧰"; $("toolCategory").value = tool.category || "Utilidad"; $("toolTags").value = (tool.tags || []).join(", "); $("toolStatus").value = tool.status || "idea"; $("toolArea").value = tool.business_area || ""; $("toolOwner").value = tool.owner || ""; $("toolVersion").value = tool.version || ""; $("toolOrder").value = tool.sort_order || 0; $("toolDescription").value = tool.description || ""; $("toolProblem").value = tool.problem_solved || ""; $("toolImpact").value = tool.expected_impact || ""; $("toolTarget").value = tool.target_users || ""; $("toolPotential").value = tool.potential_users || ""; $("toolTech").value = (tool.technologies || []).join(", "); $("toolNotes").value = tool.notes || ""; $("toolActive").checked = tool.active !== false; $("toolFeatured").checked = !!tool.featured;
  }

  function editAdoption(id){
    const item = state.adoption.find(a => a.id === id);
    if(!item) return;
    $("adoptionId").value = item.id; $("adoptionTool").value = item.tool_id || ""; $("adoptionOrg").value = item.organization || ""; $("adoptionProject").value = item.project_site || ""; $("adoptionDepartment").value = item.department || ""; $("adoptionResponsible").value = item.responsible_person || ""; $("adoptionStatus").value = item.usage_status || ""; $("adoptionUsers").value = item.estimated_users || ""; $("adoptionStart").value = item.start_date || ""; $("adoptionNotes").value = item.notes || ""; $("adoptionActive").checked = item.active !== false;
  }

  function editNeed(id){
    const item = state.needs.find(n => n.id === id);
    if(!item) return;
    $("needId").value = item.id; $("needTool").value = item.tool_id || ""; $("needOrg").value = item.organization || ""; $("needProject").value = item.project_site || ""; $("needDepartment").value = item.department || ""; $("needContact").value = item.contact_person || ""; $("needLevel").value = item.need_level || ""; $("needStatus").value = item.status || ""; $("needNotes").value = item.notes || "";
  }

  function resetForm(formId){ $(formId).reset(); ["toolId","adoptionId","needId"].forEach(id => { if($(id)) $(id).value = ""; }); if($("toolIcon")) $("toolIcon").value = "🧰"; if($("toolCategory")) $("toolCategory").value = "Utilidad"; if($("toolOrder")) $("toolOrder").value = "0"; }

  function exportCsv(rows, filename){
    if(!rows.length){ message("No hay datos para exportar.", true); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(row => headers.map(h => `"${String(Array.isArray(row[h]) ? row[h].join("; ") : row[h] ?? "").replace(/"/g,'""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function bind(){
    $("loginForm").addEventListener("submit", event => guarded(event.submitter, async () => {
      event.preventDefault();
      const { data, error } = await db.auth.signInWithPassword({ email: val("loginEmail"), password: val("loginPassword") });
      if(error) throw error;
      state.user = data.user;
      await verifyAdmin();
    }));
    $("logoutBtn").addEventListener("click", async () => { await db.auth.signOut(); state.user = null; showLogin(); });
    document.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b === btn));
      ["dashboard","tools","adoption","needs"].forEach(tab => { $("tab-" + tab).hidden = tab !== btn.dataset.tab; });
    }));
    ["filterName","filterCategory","filterStatus","filterProject","filterOrganization","filterArea","filterOwner"].forEach(id => $(id).addEventListener("input", renderDashboard));
    $("toolForm").addEventListener("submit", event => guarded(event.submitter, async () => { event.preventDefault(); await save("toolbox_tools", val("toolId"), toolPayload()); resetForm("toolForm"); }));
    $("adoptionForm").addEventListener("submit", event => guarded(event.submitter, async () => { event.preventDefault(); await save("toolbox_adoption", val("adoptionId"), adoptionPayload()); resetForm("adoptionForm"); }));
    $("needForm").addEventListener("submit", event => guarded(event.submitter, async () => { event.preventDefault(); await save("toolbox_needs", val("needId"), needPayload()); resetForm("needForm"); }));
    $("resetToolForm").onclick = () => resetForm("toolForm");
    $("resetAdoptionForm").onclick = () => resetForm("adoptionForm");
    $("resetNeedForm").onclick = () => resetForm("needForm");
    $("exportTools").onclick = () => exportCsv(state.tools, "toolbox_tools.csv");
    $("exportAdoption").onclick = () => exportCsv(state.adoption, "toolbox_adoption.csv");
    $("exportNeeds").onclick = () => exportCsv(state.needs, "toolbox_needs.csv");
    document.addEventListener("click", event => guarded(event.target.closest("button"), async () => {
      const target = event.target;
      if(target.dataset.editTool) editTool(target.dataset.editTool);
      if(target.dataset.toggleTool){ const tool = state.tools.find(t => t.id === target.dataset.toggleTool); await save("toolbox_tools", tool.id, { active: !tool.active }); }
      if(target.dataset.featureTool){ const tool = state.tools.find(t => t.id === target.dataset.featureTool); await save("toolbox_tools", tool.id, { featured: !tool.featured }); }
      if(target.dataset.deleteTool) await remove("toolbox_tools", target.dataset.deleteTool, "esta herramienta");
      if(target.dataset.editAdoption) editAdoption(target.dataset.editAdoption);
      if(target.dataset.deleteAdoption) await remove("toolbox_adoption", target.dataset.deleteAdoption, "esta adopción");
      if(target.dataset.editNeed) editNeed(target.dataset.editNeed);
      if(target.dataset.deleteNeed) await remove("toolbox_needs", target.dataset.deleteNeed, "esta necesidad");
    }));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
