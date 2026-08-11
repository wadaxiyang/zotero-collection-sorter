(function (scope) {
  "use strict";

  function compare(mode, left, right, localeCompare) {
    if (mode === "asc") {
      return localeCompare(left.name, right.name);
    }
    if (mode === "desc") {
      return localeCompare(right.name, left.name);
    }
    throw new Error("Unsupported sort mode: " + mode);
  }

  function sortChildren(children, mode, localeCompare) {
    if (mode === "default") {
      return children;
    }
    return Array.from(children).sort((left, right) =>
      compare(mode, left, right, localeCompare)
    );
  }

  function shouldInsertBefore(existing, incoming, mode, localeCompare) {
    const comparison = localeCompare(existing.name, incoming.name);
    return mode === "asc" ? comparison > 0 : comparison < 0;
  }

  scope.SortEngine = {
    compare,
    sortChildren,
    shouldInsertBefore
  };
})(this);
