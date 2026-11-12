/* Jija Studio India address selection + postal PIN verification.
   Location hierarchy: VoiceOfVillage (LGD/GODL-India); PIN lookup: PincodeAPI.in.
   PIN verification checks the postal directory's State/District assignment; it does not prove a street address or a person's residence. */
(() => {
  const LOCATION_API = "https://www.voiceofvillage.com/api/v1";
  const PIN_API = "https://api.pincodeapi.in/api/v1/pincode/";
  const widgets = new Map();
  const requestCache = new Map();
  const PAGE_SIZE = 100;
  const MAX_VILLAGE_PAGES = 10;

  const safeString = value => String(value ?? "").trim();
  const normalize = value => safeString(value)
    .toLocaleLowerCase("en-IN")
    .replace(/&/g, " and ")
    .replace(/\\b(district|dist|taluka|taluk|tehsil|tehsil|subdistrict|sub-district)\\b/g, " ")
    .replace(/[^\\p{L}\\p{N}]+/gu, "");

  const aliases = new Map([
    ["orissa", "odisha"], ["pondicherry", "puducherry"],
    ["ahmednagar", "ahilyanagar"], ["osmanabad", "dharashiv"],
    ["aurangabad", "chhatrapatisambhajinagar"],
    ["jammuandkashmir", "jammuandkashmir"],
    ["andamanandnicobarislands", "andamanandnicobarislands"],
    ["dadraandnagarhavelianddamandiu", "dadraandnagarhavelianddamandiu"]
  ]);
  function canonical(value) { const n = normalize(value); return aliases.get(n) || n; }
  function namesMatch(a, b) {
    const x = canonical(a), y = canonical(b);
    return Boolean(x && y && (x === y || x.startsWith(y) || y.startsWith(x)));
  }

  function objectList(payload, keys) {
    if (Array.isArray(payload)) return payload.filter(v => v && typeof v === "object");
    const root = payload?.data ?? payload?.result ?? payload;
    if (Array.isArray(root)) return root.filter(v => v && typeof v === "object");
    if (root && typeof root === "object") {
      for (const key of keys) {
        if (Array.isArray(root[key])) return root[key].filter(v => v && typeof v === "object");
      }
      for (const value of Object.values(root)) {
        if (Array.isArray(value) && value.some(v => v && typeof v === "object" && ("name" in v || "village_name" in v || "office_name" in v))) {
          return value.filter(v => v && typeof v === "object");
        }
      }
    }
    return [];
  }

  function placeName(item, level) {
    const keys = level === "state"
      ? ["name", "state_name", "stateName", "english_name", "name_en", "title"]
      : level === "district"
        ? ["name", "district_name", "districtName", "english_name", "name_en", "title"]
        : level === "taluka"
          ? ["name", "mandal_name", "subdistrict_name", "sub_district_name", "tehsil_name", "taluka_name", "taluk_name", "english_name", "name_en", "title"]
          : ["name", "village_name", "village", "revenue_village_name", "english_name", "name_en", "title"];
    for (const key of keys) if (safeString(item?.[key])) return safeString(item[key]);
    return "";
  }
  function placeId(item, level) {
    const keys = level === "state"
      ? ["slug", "id", "state_id", "lgd_code", "code", "name"]
      : level === "district"
        ? ["id", "district_id", "lgd_code", "district_code", "code", "slug", "name"]
        : level === "taluka"
          ? ["id", "mandal_id", "subdistrict_id", "sub_district_id", "lgd_code", "code", "slug", "name"]
          : ["id", "lgd_code", "village_id", "village_code", "code", "slug", "name"];
    for (const key of keys) if (item?.[key] !== undefined && item?.[key] !== null && safeString(item[key])) return safeString(item[key]);
    return placeName(item, level);
  }

  async function getJson(url) {
    if (requestCache.has(url)) return requestCache.get(url);
    const pending = fetch(url, { headers: { "Accept": "application/json" }, cache: "force-cache" })
      .then(async response => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.detail || data?.message || data?.error || "Location service returned HTTP " + response.status + ".");
        if (!data) throw new Error("The location service returned an unreadable response.");
        return data;
      });
    requestCache.set(url, pending);
    try { return await pending; }
    catch (error) { requestCache.delete(url); throw error; }
  }

  const getStateRows = payload => objectList(payload, ["states", "state", "results", "items"]);
  const getDistrictRows = payload => objectList(payload, ["districts", "district", "results", "items"]);
  const getTalukaRows = payload => objectList(payload, ["mandals", "talukas", "subdistricts", "sub_districts", "tehsils", "results", "items"]);
  const getVillageRows = payload => objectList(payload, ["villages", "results", "items"]);

  function setOptions(select, rows, level, placeholder) {
    select.replaceChildren(new Option(placeholder, ""));
    rows.forEach(item => {
      const label = placeName(item, level);
      const id = placeId(item, level);
      if (!label || !id) return;
      const option = new Option(label, id);
      option.dataset.label = label;
      select.add(option);
    });
    select.disabled = rows.length === 0;
  }

  function selectedRow(widget, level) {
    const select = widget.elements[level];
    if (!select?.value) return null;
    return widget.rows[level]?.find(row => placeId(row, level) === select.value) || null;
  }
  function selectedLabel(widget, level) {
    const row = selectedRow(widget, level);
    return row ? placeName(row, level) : "";
  }
  function invalidate(widget, message = "Address changed. Verify the PIN code again before continuing.") {
    widget.verified = false;
    const status = widget.elements.status;
    if (status) {
      status.textContent = message;
      status.classList.remove("is-success");
      status.classList.add("is-error");
    }
    updateSubmitButtons(widget);
  }
  function updateSubmitButtons(widget) {
    const id = widget.prefix === "signup" ? "signup-button" : "save-profile";
    const button = document.getElementById(id);
    if (button) button.disabled = !widget.verified;
  }
  function setStatus(widget, message, success = false) {
    const status = widget.elements.status;
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-success", Boolean(success));
    status.classList.toggle("is-error", !success);
  }
  function getField(widget, key) { return widget.elements[key]; }

  function buildAddress(widget) {
    const street = safeString(getField(widget, "street").value).replace(/\\s*\\n\\s*/g, ", ");
    const village = widget.otherVillage ? safeString(getField(widget, "villageOther").value) : selectedLabel(widget, "village");
    const parts = [
      street ? "Street address: " + street : "",
      village ? "Village / locality: " + village : "",
      selectedLabel(widget, "taluka") ? "Taluka / sub-district: " + selectedLabel(widget, "taluka") : "",
      selectedLabel(widget, "district") ? "District: " + selectedLabel(widget, "district") : "",
      selectedLabel(widget, "state") ? "State / UT: " + selectedLabel(widget, "state") : "",
      "Country: India"
    ].filter(Boolean);
    return parts.join("\\n");
  }

  function parseAddress(address) {
    const parsed = { street: "", village: "", taluka: "", district: "", state: "" };
    const lines = safeString(address).split(/\\r?\\n/);
    for (const line of lines) {
      const match = line.match(/^\\s*(Street address|Village\\s*\\/\\s*locality|Village|Taluka\\s*\\/\\s*sub-district|Taluka|District|State\\s*\\/\\s*UT|State)\\s*:\\s*(.*)\\s*$/i);
      if (!match) {
        if (!parsed.street && safeString(line)) parsed.street = safeString(line);
        continue;
      }
      const key = match[1].toLowerCase();
      const value = safeString(match[2]);
      if (key.startsWith("street")) parsed.street = value;
      else if (key.startsWith("village")) parsed.village = value;
      else if (key.startsWith("taluka")) parsed.taluka = value;
      else if (key.startsWith("district")) parsed.district = value;
      else if (key.startsWith("state")) parsed.state = value;
    }
    // Legacy profiles may have one free-text address. Treat it as street text,
    // so the customer can enter the structured address once and verify the PIN.
    if (!parsed.state && !parsed.district && !parsed.taluka && !parsed.village && safeString(address)) {
      parsed.street = safeString(address);
    }
    return parsed;
  }

  async function fillSelect(widget, level, rows, placeholder, wantedName = "") {
    const select = widget.elements[level];
    widget.rows[level] = rows;
    setOptions(select, rows, level, placeholder);
    if (wantedName) {
      const option = [...select.options].find(opt => namesMatch(opt.dataset.label, wantedName));
      if (option) select.value = option.value;
    }
  }

  async function loadStates(widget, wantedName = "") {
    setStatus(widget, "Loading Indian states and Union Territories…", true);
    const payload = await getJson(LOCATION_API + "/states");
    const rows = getStateRows(payload);
    if (!rows.length) throw new Error("The location directory did not return any states. Please reload and try again.");
    await fillSelect(widget, "state", rows, "Select state / Union Territory", wantedName);
    if (widget.elements.state.value) await loadDistricts(widget, "");
    else setStatus(widget, "Select your state or Union Territory first.", true);
  }

  async function loadDistricts(widget, wantedName = "") {
    const state = selectedRow(widget, "state");
    widget.rows.district = []; widget.rows.taluka = []; widget.rows.village = [];
    await fillSelect(widget, "district", [], "Loading districts…");
    await fillSelect(widget, "taluka", [], "Select taluka / sub-district");
    await fillSelect(widget, "village", [], "Select village / locality");
    if (!state) return;
    const slug = safeString(state.slug) || safeString(state.state_slug) || placeId(state, "state");
    const payload = await getJson(LOCATION_API + "/states/" + encodeURIComponent(slug) + "/districts");
    const rows = getDistrictRows(payload);
    if (!rows.length) throw new Error("Districts are not available for this state at the moment.");
    await fillSelect(widget, "district", rows, "Select district", wantedName);
    if (widget.elements.district.value) await loadTalukas(widget, "");
    else setStatus(widget, "Now select your district.", true);
  }

  async function loadTalukas(widget, wantedName = "") {
    const district = selectedRow(widget, "district");
    widget.rows.taluka = []; widget.rows.village = [];
    await fillSelect(widget, "taluka", [], "Loading talukas / sub-districts…");
    await fillSelect(widget, "village", [], "Select village / locality");
    if (!district) return;
    const id = placeId(district, "district");
    const payload = await getJson(LOCATION_API + "/districts/" + encodeURIComponent(id) + "/mandals");
    const rows = getTalukaRows(payload);
    if (!rows.length) throw new Error("Talukas / sub-districts are not available for this district at the moment.");
    await fillSelect(widget, "taluka", rows, "Select taluka / sub-district", wantedName);
    if (widget.elements.taluka.value) await loadVillages(widget, "");
    else setStatus(widget, "Now select your taluka / sub-district.", true);
  }

  async function loadVillages(widget, wantedName = "") {
    const taluka = selectedRow(widget, "taluka");
    widget.rows.village = [];
    await fillSelect(widget, "village", [], "Loading villages…");
    if (!taluka) return;
    const id = placeId(taluka, "taluka");
    const all = [];
    let pagesFetched = 0;
    for (let page = 1; page <= MAX_VILLAGE_PAGES; page++) {
      const payload = await getJson(LOCATION_API + "/mandals/" + encodeURIComponent(id) + "/villages?page=" + page);
      const rows = getVillageRows(payload);
      all.push(...rows);
      pagesFetched = page;
      const data = payload?.data ?? payload?.result ?? payload;
      const meta = payload?.meta || data?.meta || data?.pagination || payload?.pagination || {};
      const totalPages = Number(meta.total_pages || meta.totalPages || meta.pages || meta.last_page || 0);
      if ((totalPages && page >= totalPages) || rows.length < PAGE_SIZE || rows.length === 0) break;
    }
    const deduped = [...new Map(all.map(item => [placeId(item, "village") || placeName(item, "village"), item])).values()];
    if (!deduped.length) {
      await fillSelect(widget, "village", [], "Select village / locality");
      // Urban addresses may not appear in rural village lists; let the customer
      // provide a locality label while the postal check still validates PIN/state/district.
      const option = new Option("Urban town / locality not listed", "__other__");
      option.dataset.label = "Urban town / locality not listed";
      getField(widget, "village").add(option);
      getField(widget, "village").disabled = false;
      if (getField(widget, "villageOtherWrap")) getField(widget, "villageOtherWrap").hidden = true;
      setStatus(widget, "No villages were listed for this taluka. Choose the urban/locality option and enter the place name.", true);
      return;
    }
    await fillSelect(widget, "village", deduped, "Select village / locality", wantedName);
    const other = new Option("Urban town / locality not listed", "__other__");
    other.dataset.label = "Urban town / locality not listed";
    getField(widget, "village").add(other);
    getField(widget, "village").disabled = false;
    if (getField(widget, "villageOtherWrap")) getField(widget, "villageOtherWrap").hidden = true;
    if (getField(widget, "village").value) setStatus(widget, "Location loaded. Enter the street address and six-digit PIN code, then verify it.", true);
    else setStatus(widget, pagesFetched === MAX_VILLAGE_PAGES
      ? "Village list loaded (first " + all.length + " entries). If your place is not listed, choose the urban/locality option."
      : "Now select your village / locality.", true);
  }

  function bindWidget(prefix) {
    if (widgets.has(prefix)) return widgets.get(prefix);
    const $ = suffix => document.getElementById(prefix + "-" + suffix);
    const names = ["state","district","taluka","village","village-other","street","pin","verify-address","address-status"];
    const widget = {
      prefix, verified: false, loading: false, otherVillage: false,
      rows: { state: [], district: [], taluka: [], village: [] },
      elements: {
        state: $("state"), district: $("district"), taluka: $("taluka"), village: $("village"),
        villageOther: $("village-other"), villageOtherWrap: $( "village-other-wrap" ),
        street: $("street"), pin: $("pin"), verify: $("verify-address"), status: $("address-status")
      }
    };
    if (names.some(name => !$(name))) return null;
    widgets.set(prefix, widget);

    widget.elements.state.addEventListener("change", async () => {
      invalidate(widget);
      widget.otherVillage = false;
      if (widget.elements.villageOtherWrap) widget.elements.villageOtherWrap.hidden = true;
      try { await loadDistricts(widget); setStatus(widget, "Select a district, taluka and village.", true); }
      catch (error) { setStatus(widget, error.message || "Could not load districts. Please try again."); }
    });
    widget.elements.district.addEventListener("change", async () => {
      invalidate(widget);
      try { await loadTalukas(widget); }
      catch (error) { setStatus(widget, error.message || "Could not load talukas. Please try again."); }
    });
    widget.elements.taluka.addEventListener("change", async () => {
      invalidate(widget);
      widget.otherVillage = false;
      if (widget.elements.villageOtherWrap) widget.elements.villageOtherWrap.hidden = true;
      try { await loadVillages(widget); }
      catch (error) { setStatus(widget, error.message || "Could not load villages. Please try again."); }
    });
    widget.elements.village.addEventListener("change", () => {
      invalidate(widget);
      widget.otherVillage = widget.elements.village.value === "__other__";
      if (widget.elements.villageOtherWrap) widget.elements.villageOtherWrap.hidden = !widget.otherVillage;
      setStatus(widget, widget.otherVillage
        ? "Enter your town or locality name, then verify the PIN code."
        : "Village selected. Enter the street address and PIN code, then verify.", true);
    });
    ["villageOther","street","pin"].forEach(key => {
      widget.elements[key].addEventListener("input", () => invalidate(widget));
    });
    widget.elements.verify.addEventListener("click", async () => {
      if (widget.loading) return;
      widget.loading = true;
      widget.elements.verify.disabled = true;
      widget.verified = false;
      updateSubmitButtons(widget);
      try {
        const state = selectedLabel(widget, "state");
        const district = selectedLabel(widget, "district");
        const taluka = selectedLabel(widget, "taluka");
        const village = widget.otherVillage ? safeString(widget.elements.villageOther.value) : selectedLabel(widget, "village");
        const street = safeString(widget.elements.street.value);
        const pin = safeString(widget.elements.pin.value);
        if (!state || !district || !taluka || !village) throw new Error("Select the state, district, taluka and village / locality first.");
        if (street.length < 5) throw new Error("Enter a complete street address, such as house number, street, area or landmark.");
        if (!/^[0-9]{6}$/.test(pin)) throw new Error("Enter a valid six-digit Indian PIN code.");
        setStatus(widget, "Checking PIN code against postal records…", true);
        const data = await getJson(PIN_API + encodeURIComponent(pin));
        const records = objectList(data?.data, ["post_offices","postOffices","post_office","offices"]);
        if (!data?.success || !records.length) throw new Error("This PIN code was not found in the postal directory. Check the six digits and try again.");
        const matches = records.filter(record =>
          namesMatch(record.state || record.state_name || record.statename, state) &&
          namesMatch(record.district || record.district_name || record.districtname, district)
        );
        if (!matches.length) {
          const actual = [...new Set(records.map(record => [record.district || record.district_name, record.state || record.state_name].filter(Boolean).join(", ")).filter(Boolean))].slice(0,3);
          throw new Error("PIN " + pin + " does not match the selected " + district + ", " + state + ". Postal records show: " + (actual.join(" / ") || "another location") + ".");
        }
        const villageRow = selectedRow(widget, "village");
        const villagePins = [];
        if (villageRow) {
          for (const [key, value] of Object.entries(villageRow)) {
            if (/pin(code)?s?$|postal.?code|post.?code/i.test(key)) {
              if (Array.isArray(value)) villagePins.push(...value.map(safeString));
              else if (value !== null && value !== undefined) villagePins.push(...String(value).split(/[,;\\s]+/).map(safeString));
            }
          }
        }
        const villageHasPinData = villagePins.some(Boolean);
        if (villageHasPinData && !villagePins.includes(pin)) {
          const officeNameMatch = matches.some(record => namesMatch(record.office_name || record.officeName || record.name, village));
          if (!officeNameMatch) throw new Error("The selected village's postal data does not list PIN " + pin + ". Choose the correct PIN or select the matching village / post office.");
        }
        const matchedOffice = matches.find(record => namesMatch(record.office_name || record.officeName || record.name, village));
        const officeNames = [...new Set(matches.map(record => safeString(record.office_name || record.officeName || record.name)).filter(Boolean))].slice(0,3);
        widget.verified = true;
        updateSubmitButtons(widget);
        setStatus(widget,
          "PIN verified against postal records for " + district + ", " + state +
          (matchedOffice ? " · matching post office: " + (matchedOffice.office_name || matchedOffice.officeName || matchedOffice.name) : "") +
          (officeNames.length && !matchedOffice ? " · postal offices include " + officeNames.join(", ") : "") +
          ". This validates postal coverage, not the exact street / house.", true);
      } catch (error) {
        widget.verified = false;
        updateSubmitButtons(widget);
        setStatus(widget, error.message || "Could not verify this PIN. Please try again.");
      } finally {
        widget.loading = false;
        widget.elements.verify.disabled = false;
      }
    });

    widget.elements.state.disabled = true;
    widget.elements.district.disabled = true;
    widget.elements.taluka.disabled = true;
    widget.elements.village.disabled = true;
    setStatus(widget, "Loading India address list…", true);
    loadStates(widget).catch(error => {
      setStatus(widget, "Could not load the India location directory. Check your internet connection and reload the page. " + (error.message || ""), false);
    });
    updateSubmitButtons(widget);
    return widget;
  }

  async function restore(prefix, address, pin) {
    const widget = bindWidget(prefix);
    if (!widget) return;
    const parsed = parseAddress(address);
    widget.elements.street.value = parsed.street || "";
    widget.elements.pin.value = safeString(pin);
    try {
      // Ensure state data is loaded before attempting to restore dependent selects.
      if (!widget.rows.state.length) {
        const payload = await getJson(LOCATION_API + "/states");
        widget.rows.state = getStateRows(payload);
        setOptions(widget.elements.state, widget.rows.state, "state", "Select state / Union Territory");
      }
      const stateOption = [...widget.elements.state.options].find(option => namesMatch(option.dataset.label, parsed.state));
      if (!stateOption) {
        invalidate(widget, parsed.state ? "Address loaded. Please select the location again and verify the PIN." : "Add the full delivery address and verify the PIN before saving.");
        return;
      }
      widget.elements.state.value = stateOption.value;
      const state = selectedRow(widget, "state");
      const slug = safeString(state?.slug) || safeString(state?.state_slug) || placeId(state, "state");
      const districtPayload = await getJson(LOCATION_API + "/states/" + encodeURIComponent(slug) + "/districts");
      widget.rows.district = getDistrictRows(districtPayload);
      setOptions(widget.elements.district, widget.rows.district, "district", "Select district");
      const districtOption = [...widget.elements.district.options].find(option => namesMatch(option.dataset.label, parsed.district));
      if (!districtOption) { invalidate(widget, "Address loaded. Select your district and verify the PIN code."); return; }
      widget.elements.district.value = districtOption.value;
      const talukaPayload = await getJson(LOCATION_API + "/districts/" + encodeURIComponent(widget.elements.district.value) + "/mandals");
      widget.rows.taluka = getTalukaRows(talukaPayload);
      setOptions(widget.elements.taluka, widget.rows.taluka, "taluka", "Select taluka / sub-district");
      const talukaOption = [...widget.elements.taluka.options].find(option => namesMatch(option.dataset.label, parsed.taluka));
      if (!talukaOption) { invalidate(widget, "Address loaded. Select your taluka and verify the PIN code."); return; }
      widget.elements.taluka.value = talukaOption.value;
      const villageAll = [];
      for (let page = 1; page <= MAX_VILLAGE_PAGES; page++) {
        const payload = await getJson(LOCATION_API + "/mandals/" + encodeURIComponent(widget.elements.taluka.value) + "/villages?page=" + page);
        const rows = getVillageRows(payload);
        villageAll.push(...rows);
        const data = payload?.data ?? payload?.result ?? payload;
        const meta = payload?.meta || data?.meta || data?.pagination || payload?.pagination || {};
        const totalPages = Number(meta.total_pages || meta.totalPages || meta.pages || meta.last_page || 0);
        if ((totalPages && page >= totalPages) || rows.length < PAGE_SIZE || rows.length === 0) break;
      }
      widget.rows.village = [...new Map(villageAll.map(item => [placeId(item, "village") || placeName(item, "village"), item])).values()];
      setOptions(widget.elements.village, widget.rows.village, "village", "Select village / locality");
      const villageOption = [...widget.elements.village.options].find(option => namesMatch(option.dataset.label, parsed.village));
      if (villageOption) widget.elements.village.value = villageOption.value;
      else {
        const other = new Option("Urban town / locality not listed", "__other__");
        other.dataset.label = "Urban town / locality not listed";
        widget.elements.village.add(other);
        widget.elements.village.value = "__other__";
        widget.otherVillage = true;
        widget.elements.villageOther.value = parsed.village || "";
        if (widget.elements.villageOtherWrap) widget.elements.villageOtherWrap.hidden = false;
      }
      invalidate(widget, "Saved address loaded. Click “Verify PIN & location” to confirm the postal code before saving.");
    } catch (error) {
      invalidate(widget, "Saved address loaded, but location choices could not be restored. Select them again and verify the PIN. " + (error.message || ""));
    }
  }

  function init() {
    bindWidget("signup");
    bindWidget("profile");
  }

  window.JijaIndiaAddress = {
    init,
    isVerified: prefix => Boolean(widgets.get(prefix)?.verified),
    getAddress: prefix => {
      const widget = widgets.get(prefix);
      return widget ? buildAddress(widget) : "";
    },
    getPin: prefix => safeString(widgets.get(prefix)?.elements.pin.value),
    parseAddress,
    restore,
    getLocation: prefix => {
      const widget = widgets.get(prefix);
      if (!widget) return {};
      return {
        state: selectedLabel(widget, "state"),
        district: selectedLabel(widget, "district"),
        taluka: selectedLabel(widget, "taluka"),
        village: widget.otherVillage ? safeString(widget.elements.villageOther.value) : selectedLabel(widget, "village"),
        street: safeString(widget.elements.street.value),
        pin: safeString(widget.elements.pin.value),
        verified: Boolean(widget.verified)
      };
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
