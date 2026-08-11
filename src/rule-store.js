(function (scope) {
  "use strict";

  const VALID_MODES = new Set(["asc", "desc"]);

  scope.createRuleStore = function createRuleStore({ prefs, prefKey, debug, logError }) {
    const rules = new Map();

    function makeKey(collection) {
      return `${collection.libraryID}:${collection.key}`;
    }

    function load() {
      rules.clear();
      let raw = prefs.get(prefKey);
      if (typeof raw !== "string" || !raw) {
        raw = "{}";
      }

      try {
        const parsed = JSON.parse(raw);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          throw new TypeError("Rule preference must contain a JSON object");
        }
        for (const [key, mode] of Object.entries(parsed)) {
          if (VALID_MODES.has(mode)) {
            rules.set(key, mode);
          }
          else {
            debug(`Ignored invalid stored mode for ${key}`);
          }
        }
      }
      catch (error) {
        debug("Invalid rule preference; using empty in-memory rules");
        logError(error);
      }
    }

    function save() {
      prefs.set(prefKey, JSON.stringify(Object.fromEntries(rules)));
    }

    function getMode(collection) {
      return rules.get(makeKey(collection)) || "default";
    }

    function setMode(collection, mode) {
      const key = makeKey(collection);
      if (mode === "default") {
        rules.delete(key);
      }
      else if (VALID_MODES.has(mode)) {
        rules.set(key, mode);
      }
      else {
        throw new Error(`Invalid sort mode: ${mode}`);
      }
      save();
      debug(`Parent ${key} -> ${mode}`);
    }

    return {
      load,
      save,
      getMode,
      setMode,
      makeKey,
      snapshot: () => new Map(rules)
    };
  };
})(this);
