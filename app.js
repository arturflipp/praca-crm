(function () {
  "use strict";
  const STORAGE_KEY = "praca-crm-local-v1";
  const LEGACY_MIGRATED_KEY = "praca-crm-legacy-migrated-v1";
  const SIDEBAR_KEY = "praca-crm-sidebar-collapsed-v1";
  const SYNC_META_PREFIX = "praca-crm-sync-v1:";
  const USER_STATE_PREFIX = "praca-crm-user-v1:";
  const supabaseConfig = window.PRACA_CRM_SUPABASE || {};
  let supabase = null;
  let supabaseReadyPromise = null;
  const STATUSES = ["Novo", "Mandei", "Respondeu", "Proposta", "Fechou", "Sem resposta"];
  const messageRule = "- Uma única mensagem de abertura para WhatsApp, em português, curta, natural e pronta para enviar. Siga este modelo, adaptando apenas dados confirmados: \"Oi, tudo bem? Encontrei a {comércio} no Google e vi nota {nota} com {avaliações} avaliações; a {concorrente}, da mesma região e categoria, aparece com {avaliações do concorrente}. Trabalho com placas NFC/QR para facilitar avaliações: vocês já têm algum processo para convidar clientes satisfeitos a avaliar?\" Faça somente essa versão e uma pergunta. Se não houver comparação local confirmada, retire apenas o trecho do concorrente. Não invente elogios ou fatos, não finja ser cliente e não afirme que a diferença de avaliações causa perda de clientes ou pior posição no Google.";
  const defaultPrompt = [
    "Você é meu assistente de prospecção. Eu vendo placas NFC/QR que facilitam o cliente deixar avaliação no Google para comércios locais.",
    "",
    "Use a busca na web. Busque até 30 comércios REAIS da categoria [CATEGORIA] em [BAIRRO, CIDADE]. Priorize dados completos e verificados; não complete a quantidade com negócios ou informações duvidosas.",
    "",
    "Para cada comércio, encontre:",
    "- Nome",
    "- Telefone/WhatsApp (só os dígitos com DDD, ex: 13999990000; se não achar, escreva \"não encontrado\")",
    "- Link direto da ficha pública desse comércio no Google Maps (abra o resultado do estabelecimento e copie a URL; não use uma busca genérica e nunca invente o link; se não encontrar, escreva \"não encontrado\")",
    "- Número de avaliações no Google",
    "- Nota média",
    "- O concorrente direto mais avaliado entre os negócios comparáveis e próximos, da mesma categoria e região, e o número de avaliações exibido na ficha dele",
    "",
    messageRule,
    "",
    "ENTREGUE SOMENTE uma tabela markdown, sem texto antes ou depois, com exatamente estas colunas nesta ordem:",
    "| Comércio | Telefone | Link do Google | Avaliações | Nota | Concorrente | Avaliações do concorrente | Mensagem |",
    "",
    "Ordene do maior para o menor gap (diferença entre as avaliações do concorrente e as do comércio). Os melhores leads são os que têm claramente menos avaliações que um concorrente próximo.",
    "",
    "Regras de pesquisa: confira nome, telefone, nota e avaliações na ficha individual do Google Maps. Escolha concorrente da mesma categoria e região e confira a ficha e a contagem dele; não reutilize um concorrente sem confirmar que é uma comparação local adequada. Não presuma que um telefone aceita WhatsApp. Use somente dados encontrados; nunca invente números, nomes, elogios ou links. Se faltar dado, escreva \"não encontrado\"."
  ].join("\n");

  function promptTemplate(text, category, location) {
    let template = String(text || "");
    if (category) template = template.split(category).join("[CATEGORIA]");
    if (location) template = template.split(location).join("[BAIRRO, CIDADE]");
    template = template.replace(/(Busque\s+)(.+?)(\s+em\s+)(.+?)(\.\s+Traga)/i, "$1[CATEGORIA]$3[BAIRRO, CIDADE]$5");
    return template;
  }
  const promptBlockMeta = [
    ["Papel e oferta", "Define quem a IA deve representar e qual é seu produto ou serviço."],
    ["Busca e quantidade", "Define a categoria, a região e quantos comércios procurar."],
    ["Dados de cada comércio", "Escolhe os campos que a pesquisa deve levantar para cada lead."],
    ["Mensagem de abordagem", "Define o texto e o tom da única mensagem sugerida para WhatsApp."],
    ["Formato da resposta", "Define como a IA entrega os dados para colar no CRM."],
    ["Prioridade dos leads", "Define como comparar e ordenar as oportunidades."],
    ["Regras de verificação", "Define o que precisa ser confirmado e o que fazer quando faltar dado."]
  ];
  function promptBlocksFromText(text) {
    return String(text || "").trim().split(/\n\s*\n/).filter(function (part) { return part.trim(); }).map(function (part, index) {
      const meta = promptBlockMeta[index] || ["Instrução extra " + (index - promptBlockMeta.length + 1), "Edite esta parte adicional do comando."];
      return { title: meta[0], help: meta[1], text: part.trim() };
    });
  }
  function composePrompt(blocks) {
    return (blocks || []).map(function (block) { return String(block.text || "").trim(); }).filter(Boolean).join("\n\n");
  }

  function newState() {
    return { promptCategory: "", promptLocation: "", promptText: defaultPrompt, promptBlocks: promptBlocksFromText(defaultPrompt), promptHistory: [], leads: [], reminders: [], _promptUpdatedAt: "" };
  }
  function loadState(storageKey) {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey || STORAGE_KEY) || "null");
      if (data && typeof data.promptText === "string") {
        data.promptText = data.promptText.replace(/^- O concorrente direto MAIS avaliado da mesma categoria e região, e o número de avaliações dele$/m, "- O concorrente direto mais avaliado entre os negócios comparáveis e próximos, da mesma categoria e região, e o número de avaliações exibido na ficha dele");
        data.promptText = data.promptText.replace(/^Use a busca na web\. Busque .*?\. Traga de (?:12 a 20|20 a 30) comércios REAIS que tenham perfil no Google\.$/m, "Use a busca na web. Busque negócios da categoria [CATEGORIA] em [BAIRRO, CIDADE]. Traga até 30 comércios reais com ficha no Google Maps. Priorize dados verificados; se encontrar menos, não complete a lista com dados duvidosos.");
        if (data.promptText.includes("tom de cliente, não de vendedor")) {
          data.promptText = data.promptText.replace(/^- Uma mensagem de abertura de WhatsApp[^\n]*$/m, messageRule);
          data.promptText = data.promptText.replace(/^Regras: use só dados que você encontrou na busca\.[^\n]*$/m, "Regras de pesquisa: confira nome, telefone, nota e avaliações na ficha individual do Google Maps. Escolha concorrente da mesma categoria e região e confira a ficha e a contagem dele; não reutilize um concorrente sem confirmar que é uma comparação local adequada. Não presuma que um telefone aceita WhatsApp. Use somente dados encontrados; nunca invente números, nomes, elogios ou links. Se faltar dado, escreva \"não encontrado\".");
        }
        data.promptText = data.promptText.replace(/\n+(- Uma única mensagem de abertura para WhatsApp)/g, "\n\n$1");
      }
      if (data && typeof data.promptText === "string" && data.promptText.includes("Você é meu assistente de prospecção") && data.promptText.includes("ENTREGUE SOMENTE") && !data.promptText.includes("Link do Google")) {
        data.promptText = data.promptText
          .replace(/(- Telefone\/WhatsApp[^\n]*\n)/, '$1- Link direto da ficha pública desse comércio no Google Maps (use a URL da ficha do estabelecimento; não use uma busca genérica nem invente o link; se não encontrar, escreva "não encontrado")\n')
          .replace("| Comércio | Telefone | Avaliações |", "| Comércio | Telefone | Link do Google | Avaliações |");
      }
    return data ? (function () {
      const promptCategory = data.promptCategory || "";
      const promptLocation = data.promptLocation || "";
      const promptText = promptTemplate(data.promptText || defaultPrompt, promptCategory, promptLocation);
      const promptBlocks = Array.isArray(data.promptBlocks) && data.promptBlocks.length
        ? data.promptBlocks.map(function (block, index) {
          const meta = promptBlockMeta[index] || ["Instrução extra " + (index - promptBlockMeta.length + 1), "Edite esta parte adicional do comando."];
          return { title: block.title || meta[0], help: block.help || meta[1], text: String(block.text || "") };
        })
        : promptBlocksFromText(promptText);
      return {
        promptCategory: promptCategory,
        promptLocation: promptLocation,
        promptText: composePrompt(promptBlocks),
        promptBlocks: promptBlocks,
        promptHistory: Array.isArray(data.promptHistory) ? data.promptHistory.slice(0, 10) : [],
        leads: Array.isArray(data.leads) ? data.leads : [],
        reminders: Array.isArray(data.reminders) ? data.reminders : [],
        _promptUpdatedAt: typeof data._promptUpdatedAt === "string" ? data._promptUpdatedAt : ""
      };
    })() : newState();
    } catch (_) { return newState(); }
  }

  let state = loadState();
  let currentUser = null;
  let activeStorageKey = STORAGE_KEY;
  let cloudReady = false;
  let localOnly = false;
  let syncDirty = false;
  let syncTimer = null;
  let syncInFlight = false;
  let syncPromise = null;
  let resolveSyncPromise = null;
  let syncVersion = 0;
  let activatingUserId = null;
  let retryDelayMs = 5000;
  let lastRemoteUpdatedAt = "";
  let lastStateSnapshot = JSON.parse(JSON.stringify(state));
  let authMode = "login";
  let activeStatus = "Todos";
  let agendaFilter = "upcoming";
  let toastTimer;
  let pendingImport = null;
  let pendingSingleField = "";
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const leadDialog = $("#leadDialog");
  const reminderDialog = $("#reminderDialog");
  const authForm = $("#authForm");
  const singleFieldMap = {
    leadName: ["name", "Nome"], leadPhone: ["phone", "Telefone"], leadCategory: ["category", "Categoria"],
    leadLocation: ["location", "Região"], leadSource: ["source", "Origem"], leadReviews: ["reviews", "Avaliações"],
    leadRating: ["rating", "Nota"], leadCompetitor: ["competitor", "Concorrente"],
    leadCompetitorReviews: ["competitorReviews", "Avaliações do concorrente"], leadGoogleUrl: ["googleUrl", "Ficha do Google"],
    leadStatus: ["status", "Status"], leadMessage: ["message", "Mensagem"], leadNotes: ["notes", "Observações"]
  };

  function accountStorageKey(userId) { return USER_STATE_PREFIX + userId; }
  function syncMetaKey(userId) { return SYNC_META_PREFIX + userId; }
  function readSyncMeta(userId) {
    try { return JSON.parse(localStorage.getItem(syncMetaKey(userId)) || "{}"); } catch (_) { return {}; }
  }
  function setSyncMeta(meta) {
    if (!currentUser) return;
    try { localStorage.setItem(syncMetaKey(currentUser.id), JSON.stringify(meta)); } catch (_) {}
  }
  function saveLocalSnapshot() {
    try { localStorage.setItem(activeStorageKey, JSON.stringify(state)); } catch (_) {}
  }
  function setSyncState(status, label, detail) {
    const pill = $("#syncStatus");
    if (pill) {
      pill.dataset.state = status;
      const text = pill.querySelector("span:last-child");
      if (text) text.textContent = label;
    }
    const title = $("#sidebarSyncTitle");
    const subtitle = $("#sidebarSyncDetail");
    if (title) title.textContent = label;
    if (subtitle) subtitle.textContent = detail || ({ synced: "Disponível nos seus dispositivos", syncing: "Enviando alterações", offline: "Alterações guardadas neste navegador", local: "Apenas neste navegador" }[status] || "Sincronização da conta");
    const promptHint = $("#promptSaveHint");
    const agendaHint = $("#agendaStorageHint");
    const localCopy = status === "local";
    if (promptHint) promptHint.textContent = localCopy ? "Alterações ficam somente neste navegador." : status === "offline" ? "Alterações ficam guardadas e serão sincronizadas quando a conexão voltar." : "Alterações são salvas automaticamente na sua conta.";
    if (agendaHint) agendaHint.textContent = localCopy ? "Seus lembretes ficam somente neste navegador." : "Seus lembretes sincronizam na conta e aparecem aqui por data.";
  }
  function showAuthMessage(message, isError) {
    const node = $("#authMessage");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("error", Boolean(isError));
  }
  function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === "signup";
    $("#authTitle").textContent = signup ? "Crie sua conta" : "Entre no seu CRM";
    $("#authDescription").textContent = signup ? "Crie um acesso com seu e-mail e uma senha para sincronizar seus dados." : "Acesse sua conta para sincronizar leads, lembretes e prompts.";
    $("#authSubmit").textContent = signup ? "Criar conta" : "Entrar";
    $("#authModeToggle").textContent = signup ? "Já tenho uma conta" : "Criar uma conta";
    $("#authPassword").setAttribute("autocomplete", signup ? "new-password" : "current-password");
    showAuthMessage("");
  }
  function cloudState(data) {
    const source = data && typeof data === "object" ? data : {};
    const result = newState();
    result.promptCategory = typeof source.promptCategory === "string" ? source.promptCategory : "";
    result.promptLocation = typeof source.promptLocation === "string" ? source.promptLocation : "";
    result.promptBlocks = Array.isArray(source.promptBlocks) && source.promptBlocks.length
      ? source.promptBlocks.map(function (block, index) {
        const meta = promptBlockMeta[index] || ["Instrução extra " + (index - promptBlockMeta.length + 1), "Edite esta parte adicional do comando."];
        return { title: block.title || meta[0], help: block.help || meta[1], text: String(block.text || "") };
      })
      : promptBlocksFromText(typeof source.promptText === "string" ? source.promptText : defaultPrompt);
    result.promptText = composePrompt(result.promptBlocks);
    result.promptHistory = Array.isArray(source.promptHistory) ? source.promptHistory.slice(0, 10) : [];
    result.leads = Array.isArray(source.leads) ? source.leads : [];
    result.reminders = Array.isArray(source.reminders) ? source.reminders : [];
    result._promptUpdatedAt = typeof source._promptUpdatedAt === "string" ? source._promptUpdatedAt : "";
    return result;
  }
  function stampChangedRecords() {
    const now = new Date().toISOString();
    function stamp(list, previousList) {
      const previous = new Map((previousList || []).map(function (item) { return [item.id, item]; }));
      (list || []).forEach(function (item) {
        const old = previous.get(item.id);
        const currentCopy = Object.assign({}, item); delete currentCopy.updatedAt;
        const oldCopy = old ? Object.assign({}, old) : null; if (oldCopy) delete oldCopy.updatedAt;
        if (!old || JSON.stringify(currentCopy) !== JSON.stringify(oldCopy)) item.updatedAt = now;
      });
    }
    stamp(state.leads, lastStateSnapshot.leads);
    stamp(state.reminders, lastStateSnapshot.reminders);
    const promptFields = ["promptCategory", "promptLocation", "promptText", "promptBlocks", "promptHistory"];
    if (promptFields.some(function (key) { return JSON.stringify(state[key]) !== JSON.stringify(lastStateSnapshot[key]); })) state._promptUpdatedAt = now;
  }
  function mergeSyncedState(localState, remoteState, remoteUpdatedAt, meta) {
    const localPromptAt = Date.parse(localState._promptUpdatedAt || meta.localUpdatedAt || "") || 0;
    const remotePromptAt = Date.parse(remoteState._promptUpdatedAt || remoteUpdatedAt || "") || 0;
    const promptSource = localPromptAt > remotePromptAt ? localState : remoteState;
    function mergeRecords(localItems, remoteItems) {
      const merged = new Map((remoteItems || []).map(function (item) { return [item.id, item]; }));
      (localItems || []).forEach(function (item) {
        const remoteItem = merged.get(item.id);
        if (!remoteItem || (Date.parse(item.updatedAt || item.createdAt || "") || 0) > (Date.parse(remoteItem.updatedAt || remoteItem.createdAt || "") || 0)) merged.set(item.id, item);
      });
      return Array.from(merged.values());
    }
    const history = new Map();
    (remoteState.promptHistory || []).concat(localState.promptHistory || []).forEach(function (item) {
      const key = item.readyText || item.text || "";
      if (key && (!history.has(key) || (Date.parse(item.usedAt || "") || 0) > (Date.parse(history.get(key).usedAt || "") || 0))) history.set(key, item);
    });
    const merged = Object.assign({}, remoteState, {
      promptCategory: promptSource.promptCategory,
      promptLocation: promptSource.promptLocation,
      promptText: promptSource.promptText,
      promptBlocks: promptSource.promptBlocks,
      promptHistory: Array.from(history.values()).sort(function (a,b) { return (Date.parse(b.usedAt || "") || 0) - (Date.parse(a.usedAt || "") || 0); }).slice(0, 10),
      _promptUpdatedAt: promptSource._promptUpdatedAt,
      leads: mergeRecords(localState.leads, remoteState.leads),
      reminders: mergeRecords(localState.reminders, remoteState.reminders)
    });
    return cloudState(merged);
  }
  async function flushCloudSync() {
    if (!supabase || !currentUser || !cloudReady || localOnly || !syncDirty) return;
    if (syncInFlight) return syncPromise || Promise.resolve();
    syncInFlight = true;
    syncPromise = new Promise(function (resolve) { resolveSyncPromise = resolve; });
    const userId = currentUser.id;
    const version = syncVersion;
    const snapshot = JSON.parse(JSON.stringify(state));
    const timestamp = new Date().toISOString();
    try {
      const result = await supabase.from("crm_state").upsert({ user_id: userId, state: snapshot, updated_at: timestamp }, { onConflict: "user_id" }).select("updated_at").single();
      if (result.error) throw result.error;
      if (!currentUser || currentUser.id !== userId) return;
      lastRemoteUpdatedAt = result.data.updated_at || timestamp;
      retryDelayMs = 5000;
      syncDirty = syncVersion !== version;
      setSyncMeta({ dirty: syncDirty, localUpdatedAt: syncDirty ? new Date().toISOString() : lastRemoteUpdatedAt, remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: false });
      if (!syncDirty) {
        try { localStorage.setItem(LEGACY_MIGRATED_KEY, "true"); } catch (_) {}
        setSyncState("synced", "Sincronizado");
      } else {
        setSyncState("syncing", "Salvando…");
        clearTimeout(syncTimer);
        syncTimer = setTimeout(flushCloudSync, 200);
      }
    } catch (error) {
      if (!currentUser || currentUser.id !== userId) return;
      syncDirty = true;
      setSyncMeta({ dirty: true, localUpdatedAt: new Date().toISOString(), remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: readSyncMeta(userId).migratingLegacy });
      setSyncState("offline", "Sem conexão");
      if (window.console && console.warn) console.warn("Supabase sync unavailable:", error.message || error);
      clearTimeout(syncTimer);
      syncTimer = setTimeout(flushCloudSync, retryDelayMs);
      retryDelayMs = Math.min(retryDelayMs * 2, 60000);
    } finally {
      syncInFlight = false;
      if (resolveSyncPromise) resolveSyncPromise();
      syncPromise = null;
      resolveSyncPromise = null;
    }
  }
  async function activateSession(session) {
    if (!session || !session.user) return;
    const user = session.user;
    if (currentUser && currentUser.id === user.id && (cloudReady || activatingUserId === user.id)) return;
    activatingUserId = user.id;
    currentUser = user;
    localOnly = false;
    cloudReady = false;
    activeStorageKey = accountStorageKey(user.id);
    $("#accountEmail").textContent = user.email || "Conta conectada";
    setSyncState("syncing", "Carregando…");
    const userCacheExists = localStorage.getItem(activeStorageKey) !== null;
    const cachedState = userCacheExists ? loadState(activeStorageKey) : null;
    const meta = readSyncMeta(user.id);
    try {
      const result = await supabase.from("crm_state").select("state, updated_at").eq("user_id", user.id).maybeSingle();
      if (result.error) throw result.error;
      if (!currentUser || currentUser.id !== user.id) return;
      if (result.data) {
        const remoteState = cloudState(result.data.state);
        lastRemoteUpdatedAt = result.data.updated_at || "";
        if (cachedState && meta.dirty) {
          state = mergeSyncedState(cachedState, remoteState, lastRemoteUpdatedAt, meta);
          syncDirty = true;
          syncVersion += 1;
        } else if (localStorage.getItem(STORAGE_KEY) !== null && localStorage.getItem(LEGACY_MIGRATED_KEY) !== "true") {
          const legacyState = loadState(STORAGE_KEY);
          const localCandidate = cachedState ? mergeSyncedState(legacyState, cachedState, meta.remoteUpdatedAt, meta) : legacyState;
          state = mergeSyncedState(localCandidate, remoteState, lastRemoteUpdatedAt, {});
          syncDirty = true;
          syncVersion += 1;
          meta.migratingLegacy = true;
        } else {
          state = remoteState;
          syncDirty = false;
        }
      } else if (cachedState) {
        state = cachedState;
        syncDirty = true;
        syncVersion += 1;
      } else if (localStorage.getItem(STORAGE_KEY) !== null && localStorage.getItem(LEGACY_MIGRATED_KEY) !== "true") {
        state = loadState(STORAGE_KEY);
        syncDirty = true;
        syncVersion += 1;
        meta.migratingLegacy = true;
      } else {
        state = newState();
        syncDirty = false;
      }
      cloudReady = true;
      lastStateSnapshot = JSON.parse(JSON.stringify(state));
      saveLocalSnapshot();
      if (meta.migratingLegacy) {
        try { localStorage.setItem(LEGACY_MIGRATED_KEY, "true"); } catch (_) {}
      }
      setSyncMeta({ dirty: syncDirty, localUpdatedAt: meta.localUpdatedAt || lastRemoteUpdatedAt, remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: Boolean(meta.migratingLegacy) });
      document.body.classList.add("authenticated");
      renderAll();
      if (syncDirty) {
        setSyncState("syncing", "Sincronizando…");
        clearTimeout(syncTimer);
        syncTimer = setTimeout(flushCloudSync, 100);
      } else setSyncState("synced", "Sincronizado");
      activatingUserId = null;
    } catch (error) {
      if (!currentUser || currentUser.id !== user.id) { activatingUserId = null; return; }
      state = cachedState || (localStorage.getItem(STORAGE_KEY) !== null && localStorage.getItem(LEGACY_MIGRATED_KEY) !== "true" ? loadState(STORAGE_KEY) : newState());
      syncDirty = Boolean(cachedState || localStorage.getItem(STORAGE_KEY) !== null);
      cloudReady = true;
      lastStateSnapshot = JSON.parse(JSON.stringify(state));
      saveLocalSnapshot();
      const migratingLegacy = !cachedState && localStorage.getItem(STORAGE_KEY) !== null && localStorage.getItem(LEGACY_MIGRATED_KEY) !== "true";
      setSyncMeta({ dirty: syncDirty, localUpdatedAt: new Date().toISOString(), remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: migratingLegacy });
      if (migratingLegacy) {
        try { localStorage.setItem(LEGACY_MIGRATED_KEY, "true"); } catch (_) {}
      }
      document.body.classList.add("authenticated");
      renderAll();
      setSyncState("offline", "Sem conexão");
      if (syncDirty) {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(flushCloudSync, 1200);
      }
      if (window.console && console.warn) console.warn("Could not load CRM cloud state:", error.message || error);
      activatingUserId = null;
    }
  }
  async function refreshCloudState() {
    if (!supabase || !currentUser || !cloudReady || localOnly || syncInFlight) return;
    try {
      const result = await supabase.from("crm_state").select("state, updated_at").eq("user_id", currentUser.id).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data || (Date.parse(result.data.updated_at || "") || 0) <= (Date.parse(lastRemoteUpdatedAt || "") || 0)) {
        if (syncDirty) flushCloudSync();
        return;
      }
      if (syncDirty) {
        state = mergeSyncedState(state, cloudState(result.data.state), result.data.updated_at, { localUpdatedAt: readSyncMeta(currentUser.id).localUpdatedAt });
        lastRemoteUpdatedAt = result.data.updated_at || "";
        syncVersion += 1;
        lastStateSnapshot = JSON.parse(JSON.stringify(state));
        saveLocalSnapshot();
        syncDirty = true;
        setSyncMeta({ dirty: true, localUpdatedAt: new Date().toISOString(), remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: false });
        flushCloudSync();
        return;
      }
      state = cloudState(result.data.state);
      lastRemoteUpdatedAt = result.data.updated_at || "";
      lastStateSnapshot = JSON.parse(JSON.stringify(state));
      saveLocalSnapshot();
      setSyncMeta({ dirty: false, localUpdatedAt: lastRemoteUpdatedAt, remoteUpdatedAt: lastRemoteUpdatedAt, migratingLegacy: false });
      renderAll();
      setSyncState("synced", "Atualizado");
    } catch (_) { setSyncState("offline", "Sem conexão"); }
  }
  function initializeAuth() {
    if (supabaseReadyPromise) return supabaseReadyPromise;
    if (!supabaseConfig.url || !supabaseConfig.publishableKey) {
      showAuthMessage("A configuração do Supabase está ausente. Você ainda pode usar o CRM somente neste navegador.");
      return Promise.resolve(null);
    }
    supabaseReadyPromise = (async function () {
      try {
        const sdk = await import("https://esm.sh/@supabase/supabase-js@2.112.3");
        supabase = sdk.createClient(supabaseConfig.url, supabaseConfig.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
        supabase.auth.onAuthStateChange(function (event, session) {
          if (event === "SIGNED_OUT") { lockApp(); return; }
          if (session) window.setTimeout(function () { activateSession(session); }, 0);
          else if (event === "INITIAL_SESSION") setSyncState("offline", "Entre na sua conta");
        });
        return supabase;
      } catch (error) {
        supabaseReadyPromise = null;
        showAuthMessage("Não foi possível carregar a conexão segura. Você pode tentar novamente ou usar somente este navegador.");
        setSyncState("offline", "Sem conexão");
        if (window.console && console.warn) console.warn("Supabase client unavailable:", error.message || error);
        return null;
      }
    })();
    return supabaseReadyPromise;
  }
  function lockApp() {
    document.body.classList.remove("authenticated");
    currentUser = null;
    cloudReady = false;
    localOnly = false;
    syncDirty = false;
    activeStorageKey = STORAGE_KEY;
    state = newState();
    lastStateSnapshot = JSON.parse(JSON.stringify(state));
    $("#accountEmail").textContent = "";
    $("#authPassword").value = "";
    setAuthMode("login");
    setSyncState("offline", "Desconectado");
    renderAll();
    showAuthMessage("");
  }
  function startLocalOnly() {
    currentUser = null;
    cloudReady = false;
    localOnly = true;
    syncDirty = false;
    activeStorageKey = STORAGE_KEY;
    state = loadState(STORAGE_KEY);
    lastStateSnapshot = JSON.parse(JSON.stringify(state));
    $("#accountEmail").textContent = "Somente neste navegador";
    document.body.classList.add("authenticated");
    renderAll();
    setSyncState("local", "Somente local");
  }

  function saveState() {
    stampChangedRecords();
    lastStateSnapshot = JSON.parse(JSON.stringify(state));
    try { localStorage.setItem(activeStorageKey, JSON.stringify(state)); }
    catch (_) { showToast("Não foi possível salvar neste navegador."); }
    if (!cloudReady || localOnly || !currentUser) return;
    syncDirty = true;
    syncVersion += 1;
    setSyncState("syncing", "Salvando…");
    setSyncMeta({ dirty: true, localUpdatedAt: new Date().toISOString(), remoteUpdatedAt: lastRemoteUpdatedAt });
    clearTimeout(syncTimer);
    syncTimer = setTimeout(flushCloudSync, 650);
  }
  function uid() {
    return window.crypto && crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
    });
  }
  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  function digits(value) { return String(value || "").replace(/\D/g, ""); }
  function numeric(value) {
    const match = String(value == null ? "" : value).match(/-?\d[\d.]*/);
    if (!match) return null;
    const parsed = Number(match[0].replace(/\./g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  function gapFor(lead) {
    const competitor = numeric(lead.competitorReviews);
    const own = numeric(lead.reviews);
    return competitor === null || own === null ? null : competitor - own;
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2500);
  }
  function localDateValue(date) {
    const d = date || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function formatDate(dateValue, options) {
    if (!dateValue) return "";
    const parts = dateValue.split("-").map(Number);
    if (parts.length !== 3 || !parts[0]) return dateValue;
    return new Intl.DateTimeFormat("pt-BR", options || { day: "2-digit", month: "short", year: "numeric" }).format(new Date(parts[0], parts[1] - 1, parts[2]));
  }
  function readyPrompt() {
    return readyPromptText(state.promptText);
  }
  function readyPromptText(text) {
    return String(text || "")
      .replace(/\[CATEGORIA\]/g, state.promptCategory.trim() || "[CATEGORIA]")
      .replace(/\[BAIRRO, CIDADE\]/g, state.promptLocation.trim() || "[BAIRRO, CIDADE]");
  }
  function renderPromptBlocks() {
    const blocks = Array.isArray(state.promptBlocks) ? state.promptBlocks : [];
    $("#promptSections").innerHTML = blocks.map(function (block, index) {
      return '<details class="prompt-block"><summary><span>' + escapeHtml(block.title) + '</span><small>Editar</small></summary><div class="prompt-block-body"><p>' + escapeHtml(block.help) + '</p><textarea rows="4" data-prompt-block-index="' + index + '" aria-label="' + escapeHtml(block.title) + '"></textarea></div></details>';
    }).join("");
    $$("[data-prompt-block-index]").forEach(function (textarea) {
      textarea.value = readyPromptText(blocks[Number(textarea.dataset.promptBlockIndex)].text);
    });
  }
  function renderPrompt() {
    $("#promptCategory").value = state.promptCategory;
    $("#promptLocation").value = state.promptLocation;
    $("#promptEditor").value = readyPrompt();
    renderPromptBlocks();
    renderPromptHistory();
  }
  function renderPromptHistory() {
    const history = Array.isArray(state.promptHistory) ? state.promptHistory : [];
    $("#promptHistoryCount").textContent = history.length + "/10";
    $("#promptHistoryList").innerHTML = history.length ? history.map(function (item, index) {
      const date = item.usedAt ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.usedAt)) : "Salvo anteriormente";
      const excerpt = String(item.readyText || item.text || "").replace(/\s+/g, " ").trim();
      return '<button class="history-item" type="button" data-history-index="' + index + '"><span class="history-date">' + escapeHtml(date) + '</span><span class="history-excerpt">' + escapeHtml(excerpt.slice(0, 150)) + (excerpt.length > 150 ? "…" : "") + '</span><span class="history-restore">Restaurar</span></button>';
    }).join("") : '<div class="history-empty">Ainda não há versões. Salve uma versão ou copie um prompt para começar.</div>';
  }
  function rememberPrompt(text) {
    const prompt = String(text || "").trim();
    if (!prompt) { showToast("Escreva um prompt antes de salvar."); return false; }
    state.promptHistory = Array.isArray(state.promptHistory) ? state.promptHistory : [];
    state.promptHistory = [{ text: state.promptText, readyText: prompt, usedAt: new Date().toISOString() }]
      .concat(state.promptHistory.filter(function (item) { return (item.readyText || item.text) !== prompt; }))
      .slice(0, 10);
    saveState();
    renderPromptHistory();
    return true;
  }
  function setView(view) {
    $$(".page-view").forEach(function (section) { section.classList.toggle("active", section.id === "view-" + view); });
    $$(".nav-item").forEach(function (button) { button.classList.toggle("active", button.dataset.view === view); });
    $("#topTitle").textContent = { prompt: "Prompt de pesquisa", crm: "Leads", agenda: "Lembretes" }[view] || "Prospecção";
    if (view === "crm") renderLeads();
    if (view === "agenda") renderAgenda();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function setSidebarCollapsed(collapsed) {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    const button = $("#sidebarToggle");
    button.setAttribute("aria-expanded", String(!collapsed));
    button.setAttribute("aria-label", collapsed ? "Abrir menu" : "Recolher menu");
    button.title = collapsed ? "Abrir menu" : "Recolher menu";
    try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch (_) {}
  }
  function whatsappHref(lead) {
    const phone = digits(lead.phone);
    if (!phone) return "";
    const internationalPhone = phone.startsWith("55") ? phone : "55" + phone;
    const message = String(lead.message || "").trim();
    return "https://wa.me/" + internationalPhone + (message ? "?text=" + encodeURIComponent(message) : "");
  }
  function googleProfileHref(value) {
    const raw = String(value || "").trim();
    if (!/^https?:\/\//i.test(raw)) return "";
    try {
      const url = new URL(raw);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  }

  function renderLeads() {
    const query = normalize($("#leadSearch").value.trim());
    const visible = state.leads.filter(function (lead) {
      const statusMatches = activeStatus === "Todos" || lead.status === activeStatus;
      const searchMatches = !query || normalize([lead.name, lead.phone, lead.category, lead.location, lead.competitor, lead.source].join(" ")).includes(query);
      return statusMatches && searchMatches;
    });
    $("#leadList").innerHTML = visible.map(function (lead) {
      const gap = gapFor(lead);
      const gapText = gap === null ? "Gap não informado" : (gap > 0 ? "+" : "") + gap + " avaliações";
      const subtitle = [lead.category, lead.location].filter(Boolean).join(" · ") || "Sem categoria ou região";
      const phone = lead.phone ? "WhatsApp " + lead.phone : "Sem telefone";
      const status = STATUSES.includes(lead.status) ? lead.status : "Novo";
      const googleLink = googleProfileHref(lead.googleUrl);
      return '<article class="lead-row" data-lead-id="' + escapeHtml(lead.id) + '" tabindex="0" role="button" aria-label="Abrir lead ' + escapeHtml(lead.name) + '">' +
        '<div><div class="lead-name">' + escapeHtml(lead.name || "Comércio sem nome") + '</div><div class="lead-sub">' + escapeHtml(subtitle) + " · " + escapeHtml(phone) + '</div></div>' +
        '<div class="lead-gap">' + escapeHtml(gapText) + '<small>' + escapeHtml(lead.competitor ? "vs. " + lead.competitor : "sem concorrente") + '</small></div>' +
        '<div class="lead-source">' + escapeHtml(lead.source || "Origem não informada") + (googleLink ? '<a class="google-quick-link" href="' + escapeHtml(googleLink) + '" target="_blank" rel="noopener noreferrer">Google ↗</a>' : '') + '</div>' +
        '<span class="status-chip" data-status="' + escapeHtml(status) + '">' + escapeHtml(status) + '</span><span class="lead-arrow">›</span></article>';
    }).join("");
    $$(".filter-tab").forEach(function (button) { button.classList.toggle("active", button.dataset.status === activeStatus); });
    $("#filterCountTodos").textContent = String(state.leads.length);
    $("#emptyLeads").classList.toggle("hidden", state.leads.length > 0);
    $("#noResults").classList.toggle("hidden", state.leads.length === 0 || visible.length > 0);
    $("#leadList").classList.toggle("hidden", state.leads.length === 0 || visible.length === 0);
    $("#leadCountBadge").textContent = String(state.leads.length);
    $("#statTotal").textContent = String(state.leads.length);
    $("#statActive").textContent = String(state.leads.filter(function (lead) { return ["Mandei", "Respondeu", "Proposta"].includes(lead.status); }).length);
    $("#statWon").textContent = String(state.leads.filter(function (lead) { return lead.status === "Fechou"; }).length);
    const pending = state.reminders.filter(function (item) { return !item.done; }).length;
    $("#statReminders").textContent = String(pending);
    $("#reminderCountBadge").textContent = String(pending);
  }
  function updateLeadActions(lead) {
    const link = $("#leadWhatsApp");
    const href = whatsappHref(lead);
    if (href) { link.href = href; link.classList.remove("hidden"); }
    else link.classList.add("hidden");
    const googleHref = googleProfileHref(lead.googleUrl);
    const googleButton = $("#leadGoogleProfile");
    if (googleHref) { googleButton.href = googleHref; googleButton.classList.remove("hidden"); }
    else googleButton.classList.add("hidden");
  }
  function resetSingleFieldSave() {
    pendingSingleField = "";
    const button = $("#saveSingleField");
    button.disabled = true;
    button.textContent = "Salvar só o campo editado";
  }
  function openLead(id) {
    const lead = state.leads.find(function (item) { return item.id === id; });
    if (!lead) return;
    $("#leadId").value = lead.id;
    $("#leadModalEyebrow").textContent = "LEAD · " + (lead.status || "Novo").toUpperCase();
    $("#leadModalTitle").textContent = "Editar lead";
    $("#leadName").value = lead.name || "";
    $("#leadPhone").value = lead.phone || "";
    $("#leadCategory").value = lead.category || "";
    $("#leadLocation").value = lead.location || "";
    $("#leadSource").value = lead.source || "Outro";
    $("#leadReviews").value = lead.reviews || "";
    $("#leadRating").value = lead.rating || "";
    $("#leadCompetitor").value = lead.competitor || "";
    $("#leadCompetitorReviews").value = lead.competitorReviews || "";
    $("#leadGoogleUrl").value = lead.googleUrl || "";
    $("#leadStatus").value = STATUSES.includes(lead.status) ? lead.status : "Novo";
    $("#leadMessage").value = lead.message || "";
    $("#leadNotes").value = lead.notes || "";
    $("#deleteLead").classList.remove("hidden");
    $("#addReminderForLead").classList.remove("hidden");
    $("#saveSingleField").classList.remove("hidden");
    resetSingleFieldSave();
    updateLeadActions(lead);
    leadDialog.showModal();
  }
  function resetLeadDialog() {
    $("#leadForm").reset();
    $("#leadId").value = "";
    $("#leadModalEyebrow").textContent = "NOVO REGISTRO";
    $("#leadModalTitle").textContent = "Adicionar lead";
    $("#leadStatus").value = "Novo";
    $("#leadSource").value = "Prospecção na rua";
    $("#deleteLead").classList.add("hidden");
    $("#addReminderForLead").classList.add("hidden");
    $("#leadWhatsApp").classList.add("hidden");
    $("#leadGoogleProfile").classList.add("hidden");
    $("#saveSingleField").classList.add("hidden");
    resetSingleFieldSave();
  }
  function openNewLead() {
    resetLeadDialog();
    leadDialog.showModal();
  }

  function splitTableRow(line) {
    let value = line.trim();
    if (value.startsWith("|")) value = value.slice(1);
    if (value.endsWith("|")) value = value.slice(0, -1);
    return value.split(/(?<!\\)\|/).map(function (cell) {
      return cell.replace(/\\\|/g, "|").trim().replace(/^["“]|["”]$/g, "");
    });
  }
  function isSeparatorRow(cells) {
    return cells.length > 0 && cells.every(function (cell) { return /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")); });
  }
  function columnIndex(headers, kind) {
    const normalized = headers.map(normalize);
    const predicates = {
      competitorReviews: function (h) { return h.includes("avaliacoesdoconcorrente") || h.includes("avalconcorrente"); },
      competitor: function (h) { return h === "concorrente" || h.includes("nomedoconcorrente"); },
      reviews: function (h) { return (h === "avaliacoes" || h.includes("avaliacoesdogoogle") || h === "quantidadedeavaliacoes") && !h.includes("concorrente"); },
      name: function (h) { return ["comercio", "nome", "nomedocomercio", "negocio"].includes(h); },
      phone: function (h) { return h.includes("telefone") || h.includes("whatsapp") || h === "celular"; },
      googleUrl: function (h) { return h.includes("linkdogoogle") || h.includes("perfilnogoogle") || h.includes("googlemaps") || h.includes("urlperfilgoogle"); },
      rating: function (h) { return h === "nota" || h.includes("notamedia") || h === "avaliacao"; },
      message: function (h) { return h === "mensagem" || h.includes("mensagemdeabertura"); },
      location: function (h) { return h.includes("bairro") || h.includes("regiao") || h.includes("cidade"); },
      category: function (h) { return h === "categoria" || h.includes("tipodenegocio"); }
    };
    return normalized.findIndex(predicates[kind]);
  }
  function parseTable(text) {
    const lines = text.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    const rows = lines.filter(function (line) { return line.includes("|"); }).map(splitTableRow);
    if (rows.length < 2) return { leads: [], error: "Não encontrei uma tabela Markdown. Confira se a resposta tem colunas separadas por |." };
    const headers = rows[0];
    const indexes = {};
    ["name", "phone", "googleUrl", "reviews", "rating", "competitor", "competitorReviews", "message", "location", "category"].forEach(function (key) {
      indexes[key] = columnIndex(headers, key);
    });
    if (indexes.name < 0) return { leads: [], error: "A tabela precisa ter uma coluna Comércio ou Nome." };
    if (indexes.reviews < 0) return { leads: [], error: "Não encontrei a coluna Avaliações." };
    const parsed = [];
    rows.slice(1).forEach(function (cells) {
      if (isSeparatorRow(cells)) return;
      const val = function (key) {
        const index = indexes[key];
        return index >= 0 && cells[index] ? cells[index].trim() : "";
      };
      const name = val("name");
      if (!meaningfulImportValue(name) || normalize(name) === "comercio") return;
      parsed.push({
        id: uid(), name: name, phone: val("phone"), googleUrl: val("googleUrl"), category: val("category") || state.promptCategory,
        location: val("location") || state.promptLocation, reviews: val("reviews"), rating: val("rating"),
        competitor: val("competitor"), competitorReviews: val("competitorReviews"),
        message: val("message"), notes: "", source: "Pesquisa online", status: "Novo",
        createdAt: new Date().toISOString()
      });
    });
    return parsed.length ? { leads: parsed, error: "" } : { leads: [], error: "A tabela não tem linhas de comércio para importar." };
  }
  const missingValueTokens = ["", "na", "naoencontrado", "naoinformado", "naodisponivel", "naolocalizado", "naolocalizada", "nd", "n/a", "semregistro", "semtelefone", "semtelefoneinformado", "desconhecido", "unknown", "null", "undefined"];
  function isMissingValue(value) {
    const text = String(value == null ? "" : value).trim();
    const normalized = normalize(text);
    return !text || missingValueTokens.includes(normalized) || text === "-" || text === "—";
  }
  function normalizedProfileUrl(value) {
    if (isMissingValue(value)) return "";
    try {
      const url = new URL(String(value).trim());
      if (!["http:", "https:"].includes(url.protocol)) return "";
      const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
      const pathname = url.pathname.replace(/\/+$/, "").toLowerCase();
      const isGoogleMaps = hostname === "maps.app.goo.gl" || (/(^|\.)google\./i.test(hostname) && /\/maps(?:\/|$)/i.test(url.pathname));
      if (!isGoogleMaps) return "";

      const queryPlaceId = url.searchParams.get("query_place_id") || url.searchParams.get("place_id") || "";
      const queryText = Array.from(url.searchParams.values()).join(" ");
      const queryPlaceIdMatch = queryText.match(/(?:^|[?&\s])place_id\s*[:=]\s*([A-Za-z0-9_-]+)/i);
      const pathPlaceIdMatch = url.pathname.match(/!1s([^!/?&]+)/i);
      const placeId = queryPlaceId || (queryPlaceIdMatch && queryPlaceIdMatch[1]) || (pathPlaceIdMatch && pathPlaceIdMatch[1]);
      if (placeId) return "google-place-id:" + placeId.trim();

      const cid = url.searchParams.get("cid");
      if (cid) return "google-cid:" + cid.trim();

      if (hostname === "maps.app.goo.gl") return pathname ? hostname + pathname : "";

      const placePathMatch = url.pathname.match(/\/maps\/place\/([^/]+)/i);
      if (!placePathMatch || !placePathMatch[1]) return "";
      const placeSlug = normalize(decodeURIComponent(placePathMatch[1]));
      return placeSlug ? hostname + "/maps/place/" + placeSlug : "";
    } catch (_) { return ""; }
  }
  function duplicateKey(lead) {
    const normalizedName = normalize(lead.name);
    const name = isMissingValue(lead.name) ? "" : normalizedName;
    let phone = digits(lead.phone);
    if (phone.length > 11 && phone.startsWith("55")) phone = phone.slice(2);
    if (phone.length < 10 || phone.length > 11 || /^([0-9])\1+$/.test(phone)) phone = "";
    return { name: name, phone: phone, googleUrl: normalizedProfileUrl(lead.googleUrl) };
  }
  const importFields = [
    ["name", "Nome"], ["phone", "Telefone"], ["googleUrl", "Ficha do Google"], ["category", "Categoria"],
    ["location", "Região"], ["reviews", "Avaliações"], ["rating", "Nota"], ["competitor", "Concorrente"],
    ["competitorReviews", "Avaliações do concorrente"], ["message", "Mensagem"]
  ];
  function meaningfulImportValue(value) {
    return !isMissingValue(value);
  }
  function importFieldEqual(key, a, b) {
    if (key === "phone") return duplicateKey({ phone: a }).phone === duplicateKey({ phone: b }).phone;
    if (key === "googleUrl") return normalizedProfileUrl(a) === normalizedProfileUrl(b);
    return normalize(a) === normalize(b);
  }
  function findDuplicateTargets(incoming, pool, type) {
    const incomingKey = duplicateKey(incoming);
    return pool.filter(function (lead) {
      const key = duplicateKey(lead);
      return (incomingKey.name && key.name === incomingKey.name) ||
        (incomingKey.phone && key.phone === incomingKey.phone) ||
        (incomingKey.googleUrl && key.googleUrl === incomingKey.googleUrl);
    }).map(function (lead) {
      const key = duplicateKey(lead);
      const nameMatch = incomingKey.name && key.name === incomingKey.name;
      const phoneMatch = incomingKey.phone && key.phone === incomingKey.phone;
      const googleMatch = incomingKey.googleUrl && key.googleUrl === incomingKey.googleUrl;
      const reasons = [];
      if (nameMatch) reasons.push("Nome igual");
      if (phoneMatch) reasons.push("Telefone igual");
      if (googleMatch) reasons.push("Ficha do Google igual");
      return { type: type, id: lead.id, lead: lead, reasons: reasons };
    });
  }
  function duplicateStatus(lead) {
    const status = STATUSES.includes(lead.status) ? lead.status : "Novo";
    if (status === "Novo") return "Sem mensagem registrada · Novo";
    if (["Mandei", "Respondeu", "Sem resposta"].includes(status)) return "Mensagem enviada · " + status;
    return "Já contatado · " + status;
  }
  function duplicateFieldChanges(incoming, target) {
    return importFields.filter(function (field) {
      const key = field[0];
      const before = target[key];
      const after = incoming[key];
      if (!meaningfulImportValue(after)) return false;
      return !meaningfulImportValue(before) || !importFieldEqual(key, before, after);
    });
  }
  function renderDuplicateReview() {
    if (!pendingImport) return;
    const duplicateCount = pendingImport.duplicates.length;
    const updatesCount = pendingImport.duplicates.filter(function (item) { return item.update; }).length;
    const addedCount = pendingImport.addedCount;
    $("#duplicateSummary").innerHTML = '<strong>' + duplicateCount + ' possível(is) duplicado(s)</strong>' +
      '<span class="duplicate-summary-detail">' + addedCount + ' lead(s) novo(s) já adicionado(s). ' + updatesCount + ' duplicado(s) marcado(s) para atualizar; status, observações e lembretes serão preservados.</span>';
    $("#duplicateList").innerHTML = pendingImport.duplicates.map(function (item, index) {
      const chosen = item.targets.find(function (target) { return target.type === item.selectedType && target.id === item.selectedId; }) || item.targets[0];
      if (!chosen) return "";
      const incoming = item.incoming;
      const changedFields = duplicateFieldChanges(incoming, chosen.lead);
      const sameFields = importFields.filter(function (field) {
        const key = field[0];
        return meaningfulImportValue(incoming[key]) && meaningfulImportValue(chosen.lead[key]) && importFieldEqual(key, incoming[key], chosen.lead[key]);
      });
      const targetOptions = item.targets.map(function (target, targetIndex) {
        const selected = target.type === item.selectedType && target.id === item.selectedId;
        const label = target.type === "new" ? "Outro item desta importação: " + (target.lead.name || "Sem nome") : (target.lead.name || "Lead sem nome");
        return '<label class="duplicate-target"><input type="radio" name="duplicate-target-' + index + '" data-duplicate-target="' + index + '" value="' + targetIndex + '"' + (selected ? " checked" : "") + '><span><strong>' + escapeHtml(label) + '</strong><small>' + escapeHtml(target.reasons.join(" · ")) + ' · ' + escapeHtml(duplicateStatus(target.lead)) + '</small></span></label>';
      }).join("");
      const differenceList = changedFields.length ? changedFields.map(function (field) {
        const before = meaningfulImportValue(chosen.lead[field[0]]) ? chosen.lead[field[0]] : "(vazio)";
        return '<span class="duplicate-field"><strong>' + escapeHtml(field[1]) + ':</strong> ' + escapeHtml(before) + ' <span aria-hidden="true">→</span> ' + escapeHtml(incoming[field[0]]) + '</span>';
      }).join("") : '<span class="duplicate-field">Nenhum dado de pesquisa novo ou diferente.</span>';
      const equalMarkup = sameFields.length ? sameFields.map(function (field) {
        return '<span class="duplicate-field"><strong>' + escapeHtml(field[1]) + ':</strong> ' + escapeHtml(chosen.lead[field[0]]) + '</span>';
      }).join("") : '<span class="duplicate-field">nenhum dado preenchido coincide</span>';
      return '<article class="duplicate-card"><div class="duplicate-card-heading"><div><strong>Importado: ' + escapeHtml(incoming.name || "Comércio sem nome") + '</strong><small>' + escapeHtml(incoming.phone || "Sem telefone informado") + '</small></div><span class="duplicate-match-badge">Possível duplicado</span></div>' +
        '<fieldset class="duplicate-targets"><legend>Escolha qual ficha comparar e, se quiser, atualizar</legend>' + targetOptions + '</fieldset>' +
        '<div class="duplicate-data"><div class="duplicate-equal"><strong>Dados iguais:</strong>' + equalMarkup + '</div><div class="duplicate-differences"><strong>Diferenças / dados para completar:</strong>' + differenceList + '</div></div>' +
        '<label class="duplicate-update"><input type="checkbox" data-duplicate-update="' + index + '"' + (item.update ? " checked" : "") + '><span>Atualizar os dados de pesquisa desta ficha</span></label></article>';
    }).join("");
    $("#duplicateReview").classList.remove("hidden");
  }
  function importTable() {
    pendingImport = null;
    $("#duplicateReview").classList.add("hidden");
    const result = parseTable($("#importText").value);
    const status = $("#importStatus");
    if (result.error) {
      status.textContent = result.error;
      status.classList.add("error-text");
      return;
    }
    const staged = [];
    const duplicates = [];
    result.leads.forEach(function (lead) {
      let targets = findDuplicateTargets(lead, state.leads, "existing");
      if (!targets.length) targets = findDuplicateTargets(lead, staged, "new");
      if (targets.length) {
        duplicates.push({ incoming: lead, targets: targets, selectedType: targets[0].type, selectedId: targets[0].id, update: false });
      } else staged.push(lead);
    });
    if (staged.length) {
      state.leads = state.leads.concat(staged);
      saveState();
      renderLeads();
      renderAgenda();
    }
    duplicates.forEach(function (item) {
      item.targets.forEach(function (target) { if (target.type === "new") target.type = "existing"; });
      if (item.selectedType === "new") item.selectedType = "existing";
    });
    $("#importText").value = "";
    pendingImport = { addedCount: staged.length, duplicates: duplicates };
    status.classList.remove("error-text");
    if (duplicates.length) {
      renderDuplicateReview();
      status.textContent = staged.length + " lead(s) novo(s) adicionado(s). Revise apenas os " + duplicates.length + " possível(is) duplicado(s).";
      showToast(staged.length + " novo(s) adicionado(s); " + duplicates.length + " duplicado(s) em revisão.");
    } else {
      $("#duplicateReview").classList.add("hidden");
      status.textContent = staged.length + " lead(s) novo(s) adicionado(s). Nenhum duplicado encontrado.";
      showToast(staged.length + " novo(s) adicionado(s) ao CRM.");
    }
  }
  function cancelImportReview() {
    const addedCount = pendingImport ? pendingImport.addedCount : 0;
    const duplicateCount = pendingImport ? pendingImport.duplicates.length : 0;
    pendingImport = null;
    $("#duplicateReview").classList.add("hidden");
    $("#duplicateSummary").innerHTML = "";
    $("#duplicateList").innerHTML = "";
    $("#importStatus").textContent = "Revisão descartada. " + addedCount + " lead(s) novo(s) permanecem no CRM; os " + duplicateCount + " duplicado(s) não foram alterados.";
    $("#importStatus").classList.remove("error-text");
  }
  function applyImportReview() {
    if (!pendingImport) return;
    const updates = pendingImport.duplicates.filter(function (item) { return item.update; });
    updates.forEach(function (item) {
      const target = item.targets.find(function (candidate) { return candidate.type === item.selectedType && candidate.id === item.selectedId; });
      if (!target) return;
      const applyFields = function (lead) {
        importFields.forEach(function (field) {
          const key = field[0];
          if (meaningfulImportValue(item.incoming[key])) lead[key] = item.incoming[key];
        });
      };
      const current = state.leads.find(function (lead) { return lead.id === target.id; });
      if (current) applyFields(current);
    });
    const newCount = pendingImport.addedCount;
    const duplicateCount = pendingImport.duplicates.length;
    const updateCount = updates.length;
    if (updateCount) saveState();
    pendingImport = null;
    $("#duplicateReview").classList.add("hidden");
    $("#duplicateSummary").innerHTML = "";
    $("#duplicateList").innerHTML = "";
    $("#importStatus").textContent = newCount + " lead(s) novo(s) já adicionados; " + updateCount + " ficha(s) atualizada(s) e " + (duplicateCount - updateCount) + " duplicado(s) ignorado(s).";
    $("#importStatus").classList.remove("error-text");
    renderLeads();
    renderAgenda();
    showToast(updateCount + " ficha(s) atualizada(s); " + (duplicateCount - updateCount) + " duplicado(s) ignorado(s).");
  }

  function openReminder(id, defaultLeadId) {
    const reminder = id ? state.reminders.find(function (item) { return item.id === id; }) : null;
    $("#reminderForm").reset();
    $("#reminderId").value = reminder ? reminder.id : "";
    $("#reminderModalTitle").textContent = reminder ? "Editar lembrete" : "Novo lembrete";
    $("#reminderLead").innerHTML = '<option value="">Sem lead específico</option>' + state.leads.map(function (lead) {
      return '<option value="' + escapeHtml(lead.id) + '">' + escapeHtml(lead.name) + '</option>';
    }).join("");
    $("#reminderTitle").value = reminder ? reminder.title : "";
    $("#reminderDate").value = reminder ? reminder.date : localDateValue();
    $("#reminderTime").value = reminder ? reminder.time || "" : "";
    $("#reminderNotes").value = reminder ? reminder.notes || "" : "";
    $("#reminderLead").value = reminder ? reminder.leadId || "" : defaultLeadId || "";
    $("#deleteReminder").classList.toggle("hidden", !reminder);
    reminderDialog.showModal();
  }
  function renderAgenda() {
    const today = localDateValue();
    let items = state.reminders.slice();
    if (agendaFilter === "upcoming") items = items.filter(function (item) { return !item.done; });
    if (agendaFilter === "done") items = items.filter(function (item) { return item.done; });
    items.sort(function (a, b) {
      return (a.date + " " + (a.time || "23:59")).localeCompare(b.date + " " + (b.time || "23:59"));
    });
    $("#reminderList").innerHTML = items.map(function (item) {
      const lead = state.leads.find(function (entry) { return entry.id === item.leadId; });
      const overdue = !item.done && item.date < today;
      const weekday = formatDate(item.date, { weekday: "short" }).replace(".", "");
      return '<article class="reminder-card ' + (item.done ? "is-done" : "") + (overdue ? " is-overdue" : "") + '" data-reminder-id="' + escapeHtml(item.id) + '">' +
        '<div class="reminder-date"><strong>' + escapeHtml(item.date ? item.date.slice(8, 10) : "—") + '</strong><small>' + escapeHtml(weekday || "data") + '</small></div>' +
        '<div><div class="reminder-title">' + escapeHtml(item.title) + (overdue ? ' <span class="overdue-label">Atrasado</span>' : "") + '</div>' +
        '<div class="reminder-meta">' + escapeHtml(formatDate(item.date)) + (item.time ? " · " + escapeHtml(item.time) : "") + (lead ? " · " + escapeHtml(lead.name) : " · Sem lead") + '</div>' +
        (item.notes ? '<div class="reminder-notes">' + escapeHtml(item.notes) + '</div>' : "") + '</div>' +
        '<div class="reminder-actions"><button class="small-action complete" data-action="toggle">' + (item.done ? "Reabrir" : "Concluir") + '</button><button class="small-action" data-action="edit">Editar</button></div></article>';
    }).join("");
    $("#emptyAgenda").classList.toggle("hidden", items.length > 0);
    if (!items.length) {
      $("#emptyAgenda h3").textContent = state.reminders.length ? "Nenhum lembrete neste filtro" : "Nenhum lembrete por enquanto";
      $("#emptyAgenda p").textContent = state.reminders.length ? "Troque o filtro para ver outros lembretes ou crie um novo." : "Crie um lembrete para uma visita, retorno ou detalhe importante de uma venda.";
      $("#emptyReminder").classList.toggle("hidden", state.reminders.length > 0);
    }
    $("#reminderList").classList.toggle("hidden", items.length === 0);
    $$(".agenda-filter").forEach(function (button) { button.classList.toggle("active", button.dataset.agenda === agendaFilter); });
    $("#reminderList").querySelectorAll(".reminder-card").forEach(function (card) {
      card.querySelector('[data-action="edit"]').addEventListener("click", function () { openReminder(card.dataset.reminderId); });
      card.querySelector('[data-action="toggle"]').addEventListener("click", function () {
        const reminder = state.reminders.find(function (item) { return item.id === card.dataset.reminderId; });
        if (reminder) {
          reminder.done = !reminder.done;
          saveState();
          renderAgenda();
          renderLeads();
        }
      });
    });
    const pending = state.reminders.filter(function (item) { return !item.done; }).length;
    $("#reminderCountBadge").textContent = String(pending);
    $("#statReminders").textContent = String(pending);
  }
  function renderAll() { renderPrompt(); renderLeads(); renderAgenda(); }

  $$(".nav-item").forEach(function (button) {
    button.addEventListener("click", function () {
      const view = button.dataset.view;
      $$(".page-view").forEach(function (section) { section.classList.toggle("active", section.id === "view-" + view); });
      $$(".nav-item").forEach(function (item) { item.classList.toggle("active", item === button); });
      $("#topTitle").textContent = { prompt: "Prompt de pesquisa", crm: "Leads", agenda: "Lembretes" }[view];
      if (view === "crm") renderLeads();
      if (view === "agenda") renderAgenda();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  $$("[data-go]").forEach(function (button) {
    button.addEventListener("click", function () {
      const target = button.dataset.go;
      const nav = $('.nav-item[data-view="' + target + '"]');
      if (nav) nav.click();
    });
  });

  $("#promptCategory").addEventListener("input", function (event) { state.promptCategory = event.target.value; $("#promptEditor").value = readyPrompt(); renderPromptBlocks(); saveState(); });
  $("#sidebarToggle").addEventListener("click", function () { setSidebarCollapsed(!document.body.classList.contains("sidebar-collapsed")); });
  $("#promptLocation").addEventListener("input", function (event) { state.promptLocation = event.target.value; $("#promptEditor").value = readyPrompt(); renderPromptBlocks(); saveState(); });
  $("#promptSections").addEventListener("input", function (event) {
    const textarea = event.target.closest("[data-prompt-block-index]");
    if (!textarea) return;
    const index = Number(textarea.dataset.promptBlockIndex);
    state.promptBlocks[index].text = promptTemplate(textarea.value, state.promptCategory.trim(), state.promptLocation.trim());
    state.promptText = composePrompt(state.promptBlocks);
    $("#promptEditor").value = readyPrompt();
    saveState();
  });
  $("#promptEditor").addEventListener("input", function (event) {
    state.promptText = promptTemplate(event.target.value, state.promptCategory.trim(), state.promptLocation.trim());
    state.promptBlocks = promptBlocksFromText(state.promptText);
    saveState();
  });
  $("#promptEditor").addEventListener("change", renderPromptBlocks);
  $("#savePromptHistory").addEventListener("click", function () {
    if (rememberPrompt(readyPrompt())) showToast("Versão salva no histórico.");
  });
  $("#promptHistoryList").addEventListener("click", function (event) {
    const button = event.target.closest("[data-history-index]");
    if (!button) return;
    const item = state.promptHistory[Number(button.dataset.historyIndex)];
    if (!item) return;
    state.promptText = promptTemplate(item.text, state.promptCategory, state.promptLocation);
    state.promptBlocks = promptBlocksFromText(state.promptText);
    saveState();
    renderPrompt();
    showToast("Prompt restaurado do histórico.");
    $("#promptEditor").focus();
  });
  $("#copyPrompt").addEventListener("click", async function () {
    const ready = readyPrompt();
    rememberPrompt(ready);
    try {
      await navigator.clipboard.writeText(ready);
      showToast("Prompt pronto copiado.");
    } catch (_) {
      const temporary = document.createElement("textarea");
      temporary.value = ready;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.select();
      const copied = document.execCommand("copy");
      temporary.remove();
      showToast(copied ? "Prompt pronto copiado." : "Não foi possível copiar o prompt.");
    }
  });
  $("#restorePrompt").addEventListener("click", function () {
    if (!window.confirm("Restaurar o texto original do prompt?")) return;
    state.promptText = defaultPrompt;
    state.promptBlocks = promptBlocksFromText(defaultPrompt);
    saveState();
    renderPrompt();
    showToast("Modelo original restaurado.");
  });

  $("#toggleImport").addEventListener("click", function () {
    $("#importPanel").classList.toggle("hidden");
    if (!$("#importPanel").classList.contains("hidden")) $("#importText").focus();
  });
  $("#emptyImport").addEventListener("click", function () { $("#importPanel").classList.remove("hidden"); $("#importText").focus(); });
  $("#closeImport").addEventListener("click", function () { $("#importPanel").classList.add("hidden"); });
  $("#importLeads").addEventListener("click", importTable);
  $("#cancelImportReview").addEventListener("click", cancelImportReview);
  $("#applyImport").addEventListener("click", applyImportReview);
  $("#duplicateList").addEventListener("change", function (event) {
    const radio = event.target.closest("[data-duplicate-target]");
    if (radio && pendingImport) {
      const index = Number(radio.dataset.duplicateTarget);
      const duplicate = pendingImport.duplicates[index];
      const target = duplicate && duplicate.targets[Number(radio.value)];
      if (duplicate && target) {
        duplicate.selectedType = target.type;
        duplicate.selectedId = target.id;
        renderDuplicateReview();
      }
      return;
    }
    const checkbox = event.target.closest("[data-duplicate-update]");
    if (checkbox && pendingImport) {
      const duplicate = pendingImport.duplicates[Number(checkbox.dataset.duplicateUpdate)];
      if (duplicate) duplicate.update = checkbox.checked;
      renderDuplicateReview();
    }
  });
  $("#newLead").addEventListener("click", openNewLead);
  $("#emptyAdd").addEventListener("click", openNewLead);
  $("#leadSearch").addEventListener("input", renderLeads);
  $("#leadList").addEventListener("click", function (event) {
    if (event.target.closest(".google-quick-link")) return;
    const row = event.target.closest(".lead-row");
    if (row) openLead(row.dataset.leadId);
  });
  $("#leadList").addEventListener("keydown", function (event) {
    if (event.target.closest("a")) return;
    const row = event.target.closest(".lead-row");
    if (row && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openLead(row.dataset.leadId);
    }
  });
  $$(".filter-tab").forEach(function (button) {
    button.addEventListener("click", function () { activeStatus = button.dataset.status; renderLeads(); });
  });

  function markSingleFieldChanged(event) {
    const field = singleFieldMap[event.target.id];
    if (!field || !$("#leadId").value) return;
    pendingSingleField = event.target.id;
    const button = $("#saveSingleField");
    button.textContent = "Salvar só “" + field[1] + "”";
    button.disabled = event.target.id === "leadName" && !event.target.value.trim();
  }
  $("#leadForm").addEventListener("input", markSingleFieldChanged);
  $("#leadForm").addEventListener("change", markSingleFieldChanged);
  $("#saveSingleField").addEventListener("click", function () {
    const id = $("#leadId").value;
    const field = singleFieldMap[pendingSingleField];
    const lead = state.leads.find(function (item) { return item.id === id; });
    if (!lead || !field) return;
    const input = $("#" + pendingSingleField);
    if (pendingSingleField === "leadName" && !input.value.trim()) return;
    lead[field[0]] = input.value.trim();
    saveState();
    renderLeads();
    renderAgenda();
    updateLeadActions(lead);
    const savedLabel = field[1];
    resetSingleFieldSave();
    showToast(savedLabel + " salvo. Os outros dados não foram alterados.");
  });

  $("#leadForm").addEventListener("submit", function (event) {
    event.preventDefault();
    const id = $("#leadId").value;
    const current = id ? state.leads.find(function (lead) { return lead.id === id; }) : null;
    const lead = {
      id: id || uid(), name: $("#leadName").value.trim(), phone: $("#leadPhone").value.trim(),
      category: $("#leadCategory").value.trim(), location: $("#leadLocation").value.trim(),
      googleUrl: $("#leadGoogleUrl").value.trim(),
      source: $("#leadSource").value, reviews: $("#leadReviews").value.trim(), rating: $("#leadRating").value.trim(),
      competitor: $("#leadCompetitor").value.trim(), competitorReviews: $("#leadCompetitorReviews").value.trim(),
      status: $("#leadStatus").value, message: $("#leadMessage").value.trim(), notes: $("#leadNotes").value.trim(),
      createdAt: current ? current.createdAt : new Date().toISOString()
    };
    if (current) {
      state.leads = state.leads.map(function (item) { return item.id === id ? lead : item; });
      showToast("Lead atualizado.");
    } else {
      state.leads.push(lead);
      showToast("Lead adicionado.");
    }
    saveState();
    leadDialog.close();
    renderLeads();
    renderAgenda();
  });
  $("#deleteLead").addEventListener("click", function () {
    const id = $("#leadId").value;
    const lead = state.leads.find(function (item) { return item.id === id; });
    if (!lead || !window.confirm("Excluir " + lead.name + " e desvincular seus lembretes?")) return;
    state.leads = state.leads.filter(function (item) { return item.id !== id; });
    state.reminders = state.reminders.map(function (item) { return item.leadId === id ? Object.assign({}, item, { leadId: "" }) : item; });
    saveState();
    leadDialog.close();
    renderLeads();
    renderAgenda();
    showToast("Lead excluído.");
  });

  $("#newReminder").addEventListener("click", function () { openReminder(""); });
  $("#emptyReminder").addEventListener("click", function () { openReminder(""); });
  $("#addReminderForLead").addEventListener("click", function () {
    const leadId = $("#leadId").value;
    leadDialog.close();
    openReminder("", leadId);
  });
  $$(".agenda-filter").forEach(function (button) {
    button.addEventListener("click", function () { agendaFilter = button.dataset.agenda; renderAgenda(); });
  });
  $("#reminderForm").addEventListener("submit", function (event) {
    event.preventDefault();
    const id = $("#reminderId").value;
    const old = id ? state.reminders.find(function (item) { return item.id === id; }) : null;
    const reminder = {
      id: id || uid(), leadId: $("#reminderLead").value, title: $("#reminderTitle").value.trim(),
      date: $("#reminderDate").value, time: $("#reminderTime").value, notes: $("#reminderNotes").value.trim(),
      done: old ? old.done : false, createdAt: old ? old.createdAt : new Date().toISOString()
    };
    if (old) state.reminders = state.reminders.map(function (item) { return item.id === id ? reminder : item; });
    else state.reminders.push(reminder);
    saveState();
    reminderDialog.close();
    renderAgenda();
    renderLeads();
    showToast(old ? "Lembrete atualizado." : "Lembrete salvo.");
  });
  $("#deleteReminder").addEventListener("click", function () {
    const id = $("#reminderId").value;
    if (!id || !window.confirm("Excluir este lembrete?")) return;
    state.reminders = state.reminders.filter(function (item) { return item.id !== id; });
    saveState();
    reminderDialog.close();
    renderAgenda();
    renderLeads();
    showToast("Lembrete excluído.");
  });

  $$("[data-close]").forEach(function (button) {
    button.addEventListener("click", function () {
      const dialog = $("#" + button.dataset.close);
      if (dialog === leadDialog) resetLeadDialog();
      dialog.close();
    });
  });
  [leadDialog, reminderDialog].forEach(function (dialog) {
    dialog.addEventListener("click", function (event) { if (event.target === dialog) dialog.close(); });
  });
  leadDialog.addEventListener("close", resetLeadDialog);
  $("#authModeToggle").addEventListener("click", function () { setAuthMode(authMode === "login" ? "signup" : "login"); });
  $("#localMode").addEventListener("click", startLocalOnly);
  authForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!supabase) await initializeAuth();
    if (!supabase) {
      const message = supabaseConfig.url && supabaseConfig.publishableKey
        ? "Não foi possível conectar ao serviço. Confira a internet ou use somente este navegador."
        : "A conexão com o Supabase não está configurada. Use somente este navegador.";
      showAuthMessage(message, true);
      return;
    }
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    const button = $("#authSubmit");
    button.disabled = true;
    showAuthMessage(authMode === "signup" ? "Criando sua conta…" : "Entrando…");
    try {
      if (authMode === "signup") {
        const redirectTo = window.location.origin + window.location.pathname;
        const result = await supabase.auth.signUp({ email: email, password: password, options: { emailRedirectTo: redirectTo } });
        if (result.error) throw result.error;
        if (result.data.session) showAuthMessage("Conta criada. Abrindo seu CRM…");
        else showAuthMessage("Conta criada. Confirme o e-mail enviado para entrar e sincronizar seus dados.");
      } else {
        const result = await supabase.auth.signInWithPassword({ email: email, password: password });
        if (result.error) throw result.error;
        showAuthMessage("Acesso confirmado. Carregando seus dados…");
      }
    } catch (error) {
      showAuthMessage(error.message || "Não foi possível autenticar. Confira e tente novamente.", true);
    } finally {
      button.disabled = false;
    }
  });
  $("#signOut").addEventListener("click", async function () {
    if (localOnly || !supabase) { lockApp(); return; }
    if (syncDirty) await flushCloudSync();
    const result = await supabase.auth.signOut();
    if (result.error) showToast("Não foi possível sair: " + result.error.message);
  });
  window.addEventListener("online", function () { if (syncDirty) flushCloudSync(); else refreshCloudState(); });
  window.addEventListener("focus", refreshCloudState);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") refreshCloudState(); });
  initializeAuth();
  renderAll();
  try { setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === "true"); } catch (_) { setSidebarCollapsed(false); }
})();
