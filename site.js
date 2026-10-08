// Desktop shell: window manager, taskbar, themes, and the four programs (About, Repositories, Documents, Links).
// Content lives in config.js. Documents are discovered from the repository tree at runtime, so adding a Markdown
// file under the docs folder is the only step needed to publish it.
(function () {
  "use strict";

  var SITE = window.SITE;
  var API = "https://api.github.com";
  var RAW = "https://raw.githubusercontent.com";
  var REPO_CACHE_MINUTES = 60;
  var DOCS_CACHE_MINUTES = 10;
  var SEARCH_RESULT_LIMIT = 200;
  var THEMES = [
    { id: "day", label: "Day", note: "Windows 98 look with present-day reading comforts" },
    { id: "night", label: "Night", note: "The same interface in a dark scheme" },
    { id: "classic", label: "Classic", note: "Plain Windows 98, nothing added" }
  ];
  var narrow = matchMedia("(max-width: 760px)");

  var ICONS = {
    tree: ["......GG......", "......GG......", ".....GGGG.....", ".....GGGG.....", "....GGGGGG....", "...GGGGGGGG...", ".....GGGG.....", "....GGGGGG....", "...GGGGGGGG...", "..GGGGGGGGGG..", "....GGGGGG....", "...GGGGGGGG...", ".GGGGGGGGGGGG.", "GGGGGGGGGGGGGG", "......TT......", "......TT......"],
    folder: ["...............", "...............", ".KKKKK.........", "KFFFFFK........", "KFFFFFFKKKKKKK.", "KFFFFFFFFFFFFFK", "KFFFFFFFFFFFFFK", "KFFFFFFFFFFFFFK", "KFFFFFFFFFFFFFK", "KFFFFFFFFFFFFFK", "KFFFFFFFFFFFFFK", "KFFFFFFFFFFFFFK", "KFFFFFFFFFFFFFK", ".KKKKKKKKKKKKK.", "...............", "..............."],
    doc: ["KKKKKKKK...", "KWWWWWWKK..", "KWWWWWWKWK.", "KWWWWWWKKKK", "KWWWWWWWWWK", "KWSSSSSSWWK", "KWWWWWWWWWK", "KWSSSSSSWWK", "KWWWWWWWWWK", "KWSSSSSSWWK", "KWWWWWWWWWK", "KWSSSSWWWWK", "KWWWWWWWWWK", "KWWWWWWWWWK", "KKKKKKKKKKK", "..........."],
    app: ["..............", "KKKKKKKKKKKKKK", "KBBBBBBBBBBBBK", "KBBBBBBBBBBBBK", "KKKKKKKKKKKKKK", "KWWWWWWWWWWWWK", "KWWWWWWWWWWWWK", "KWWWWWWWWWWWWK", "KWWWWWWWWWWWWK", "KWWWWWWWWWWWWK", "KWWWWWWWWWWWWK", "KWWWWWWWWWWWWK", "KWWWWWWWWWWWWK", "KKKKKKKKKKKKKK", "..............", ".............."],
    monitor: ["..............", "KKKKKKKKKKKKKK", "KSSSSSSSSSSSSK", "KSBBBBBBBBBBSK", "KSBBBBBBBBBBSK", "KSBBBBBBBBBBSK", "KSBBBBBBBBBBSK", "KSBBBBBBBBBBSK", "KSBBBBBBBBBBSK", "KSSSSSSSSSSSSK", "KKKKKKKKKKKKKK", ".....KSSK.....", "...KKKSSKKK...", "..KSSSSSSSSK..", "..KKKKKKKKKK..", ".............."],
    globe: [".....KKKKKK.....", "...KKBBGGBBKK...", "..KBBGGGGBBBBK..", ".KBBGGGGGBBBBBK.", ".KBGGGGGBBBGGBK.", "KBBGGGGBBBGGGGBK", "KBBBGGBBBBGGGGBK", "KBBBBGBBBBBGGBBK", "KBBBBBBBBBBGBBBK", "KBGGBBBBBBBBBBBK", "KBGGGBBBBBBBGBBK", ".KGGGGBBBBBGGBK.", ".KBGGBBBBBGGGBK.", "..KBBBBBBBGGBK..", "...KKBBBBBBKK...", ".....KKKKKK....."],
    min: ["......", "......", "......", "......", "CCCCCC", "CCCCCC"],
    max: ["CCCCCCCCC", "CCCCCCCCC", "C.......C", "C.......C", "C.......C", "C.......C", "C.......C", "C.......C", "CCCCCCCCC"],
    close: ["CC....CC", ".CC..CC.", "..CCCC..", "...CC...", "..CCCC..", ".CC..CC.", "CC....CC"]
  };

  // ---------------------------------------------------------------- helpers

  function el(tag, attributes, children) {
    var node = document.createElement(tag);
    Object.keys(attributes || {}).forEach(function (key) {
      var value = attributes[key];
      if (key === "class") {
        node.className = value;
      } else if (key === "text") {
        node.textContent = value;
      } else if (key.indexOf("on") === 0) {
        node.addEventListener(key.slice(2), value);
      } else if (value !== false && value !== null && value !== undefined) {
        node.setAttribute(key, value === true ? "" : value);
      }
    });
    (children || []).forEach(function (child) {
      if (child) {
        node.append(child);
      }
    });
    return node;
  }

  function icon(name, scale) {
    var rows = ICONS[name];
    var size = scale || 1;
    var rects = [];
    rows.forEach(function (row, y) {
      var x = 0;
      while (x < row.length) {
        var end = x;
        while (end < row.length && row[end] === row[x]) {
          end += 1;
        }
        if (row[x] !== ".") {
          rects.push('<rect class="px-' + row[x] + '" x="' + x + '" y="' + y + '" width="' + (end - x) + '" height="1"/>');
        }
        x = end;
      }
    });
    var holder = document.createElement("span");
    holder.innerHTML = '<svg class="px" aria-hidden="true" viewBox="0 0 ' + rows[0].length + " " + rows.length + '" width="'
      + rows[0].length * size + '" height="' + rows.length * size + '">' + rects.join("") + "</svg>";
    return holder.firstChild;
  }

  // Storage is a convenience only. Private windows and blocked site data make it throw, and the site must still work.
  function readStore(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (error) {
      return null;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      return;
    }
  }

  function fetchJson(url) {
    return fetch(url, { headers: { Accept: "application/vnd.github+json" } }).then(function (response) {
      if (!response.ok) {
        throw new Error("Request failed with status " + response.status);
      }
      return response.json();
    });
  }

  // Serves a fresh cache without a request, refreshes when stale, and falls back to a stale copy when the API fails
  // (the unauthenticated GitHub API allows 60 requests per hour per address).
  function cachedJson(key, minutes, load) {
    var entry = readStore(key);
    if (entry && Date.now() - entry.time < minutes * 60000) {
      return Promise.resolve({ data: entry.data, live: true });
    }
    return load().then(function (data) {
      writeStore(key, { time: Date.now(), data: data });
      return { data: data, live: true };
    }).catch(function () {
      return { data: entry ? entry.data : null, live: false };
    });
  }

  function formatSize(kilobytes) {
    var text = kilobytes < 1024 ? kilobytes + " KB" : (kilobytes / 1024).toFixed(1) + " MB";
    return text;
  }

  function prettyName(fileName) {
    var name = fileName.replace(/\.md$/i, "").replace(/^\d+[-_. ]+/, "").replace(/[-_]+/g, " ");
    return name || fileName;
  }

  function naturalCompare(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  }

  // ---------------------------------------------------------------- themes

  function currentTheme() {
    return document.documentElement.dataset.theme;
  }

  function setTheme(id) {
    document.documentElement.dataset.theme = id;
    try {
      localStorage.setItem("theme", id);
    } catch (error) {
      /* storage unavailable: the theme still applies for this visit */
    }
    var theme = THEMES.filter(function (entry) { return entry.id === id; })[0];
    var button = document.getElementById("themebtn");
    button.textContent = theme.label;
    button.title = "Theme: " + theme.label + ". Click to change.";
    document.querySelectorAll('input[name="theme"]').forEach(function (radio) {
      radio.checked = radio.value === id;
    });
  }

  function cycleTheme() {
    var index = THEMES.findIndex(function (entry) { return entry.id === currentTheme(); });
    setTheme(THEMES[(index + 1) % THEMES.length].id);
  }

  // ---------------------------------------------------------------- window manager

  var windows = new Map();
  var topLayer = 10;
  var layer = document.getElementById("windows");
  var desktop = document.getElementById("desktop");

  function activeWindow() {
    var best = null;
    windows.forEach(function (entry) {
      if (!entry.node.classList.contains("min") && (!best || entry.z > best.z)) {
        best = entry;
      }
    });
    return best;
  }

  function renderTasks() {
    var bar = document.getElementById("tasks");
    var active = activeWindow();
    bar.textContent = "";
    windows.forEach(function (entry) {
      var on = entry === active && entry.node.classList.contains("active");
      bar.append(el("button", {
        class: "btn" + (on ? " on" : ""), type: "button", role: "tab", "aria-selected": String(on), title: entry.title,
        onclick: function () {
          if (on) {
            entry.node.classList.add("min");
            focusWindow(activeWindow());
          } else {
            focusWindow(entry);
          }
        }
      }, [icon(entry.icon), el("span", { text: entry.title })]));
    });
  }

  function focusWindow(entry) {
    windows.forEach(function (other) {
      other.node.classList.remove("active");
    });
    if (entry) {
      topLayer += 1;
      entry.z = topLayer;
      entry.node.style.zIndex = topLayer;
      entry.node.style.order = -topLayer;
      entry.node.classList.remove("min");
      entry.node.classList.add("active");
      history.replaceState(null, "", entry.route ? "#/" + entry.route : location.pathname + location.search);
    }
    renderTasks();
  }

  function closeWindow(entry) {
    entry.node.remove();
    windows.delete(entry.id);
    focusWindow(activeWindow());
  }

  function dragBehaviour(handle, entry, apply) {
    handle.addEventListener("pointerdown", function (event) {
      if (event.target.closest("button") || narrow.matches || entry.node.classList.contains("max")) {
        return;
      }
      var box = entry.node.getBoundingClientRect();
      var origin = { x: event.clientX, y: event.clientY, left: entry.node.offsetLeft, top: entry.node.offsetTop, width: box.width, height: box.height };
      handle.setPointerCapture(event.pointerId);
      function move(moveEvent) {
        apply(origin, moveEvent.clientX - origin.x, moveEvent.clientY - origin.y);
      }
      function stop() {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", stop);
        handle.removeEventListener("pointercancel", stop);
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", stop);
      handle.addEventListener("pointercancel", stop);
    });
  }

  // spec: { id, title, icon, route, width, height, x, y, body, status, fixed }
  function openWindow(spec) {
    var existing = windows.get(spec.id);
    if (existing) {
      focusWindow(existing);
      return existing;
    }

    var entry = { id: spec.id, title: spec.title, icon: spec.icon, route: spec.route, z: 0 };
    var titleText = el("span", { class: "ttext", text: spec.title });
    var controls = el("div", { class: "tctl" }, [
      el("button", { class: "minb", type: "button", "aria-label": "Minimize", onclick: function () {
        entry.node.classList.add("min");
        focusWindow(activeWindow());
      } }, [icon("min")]),
      spec.fixed ? null : el("button", { class: "maxb", type: "button", "aria-label": "Maximize", onclick: function () {
        entry.node.classList.toggle("max");
      } }, [icon("max")]),
      el("button", { class: "close", type: "button", "aria-label": "Close", onclick: function () { closeWindow(entry); } }, [icon("close")])
    ]);
    var titlebar = el("header", { class: "titlebar" }, [icon(spec.icon), titleText, controls]);
    var statusCells = (spec.status || []).map(function (text) { return el("span", { text: text }); });
    var grip = spec.fixed ? null : el("div", { class: "grip" });

    entry.node = el("section", { class: "window", role: "dialog", "aria-label": spec.title }, [
      titlebar, spec.body, statusCells.length ? el("footer", { class: "statusbar" }, statusCells) : null, grip
    ]);
    entry.setTitle = function (text) {
      entry.title = text;
      titleText.textContent = text;
      entry.node.setAttribute("aria-label", text);
      renderTasks();
    };
    entry.setStatus = function (index, text) {
      if (statusCells[index]) {
        statusCells[index].textContent = text;
      }
    };

    var bounds = desktop.getBoundingClientRect();
    var width = Math.min(spec.width, bounds.width - 8);
    var height = spec.height ? Math.min(spec.height, bounds.height - 8) : null;
    var offset = (windows.size % 8) * 22;
    var left = spec.x !== undefined ? spec.x : 110 + offset;
    var top = spec.y !== undefined ? spec.y : 14 + offset;
    entry.node.style.width = width + "px";
    if (height) {
      entry.node.style.height = height + "px";
    }
    entry.node.style.left = Math.max(0, Math.min(left, bounds.width - width - 4)) + "px";
    entry.node.style.top = Math.max(0, Math.min(top, bounds.height - (height || 200) - 4)) + "px";

    dragBehaviour(titlebar, entry, function (origin, dx, dy) {
      var area = desktop.getBoundingClientRect();
      entry.node.style.left = Math.max(60 - origin.width, Math.min(origin.left + dx, area.width - 60)) + "px";
      entry.node.style.top = Math.max(0, Math.min(origin.top + dy, area.height - 20)) + "px";
    });
    if (grip) {
      dragBehaviour(grip, entry, function (origin, dx, dy) {
        entry.node.style.width = Math.max(240, origin.width + dx) + "px";
        entry.node.style.height = Math.max(120, origin.height + dy) + "px";
      });
      titlebar.addEventListener("dblclick", function (event) {
        if (!event.target.closest("button")) {
          entry.node.classList.toggle("max");
        }
      });
    }
    entry.node.addEventListener("pointerdown", function () {
      if (!entry.node.classList.contains("active")) {
        focusWindow(entry);
      }
    }, true);
    entry.node.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && spec.fixed) {
        closeWindow(entry);
      }
    });

    windows.set(spec.id, entry);
    layer.append(entry.node);
    focusWindow(entry);
    return entry;
  }

  // ---------------------------------------------------------------- shared widgets

  function linkButton(label, url) {
    return el("a", { class: "btn", href: url, target: "_blank", rel: "noopener noreferrer", text: label });
  }

  // Builds a details list. columns: [{ key, label, width }]. rows: [{ cells, icon, dim, data }].
  function listView(columns, handlers) {
    var body = el("tbody");
    var head = el("tr", {}, columns.map(function (column) {
      return el("th", { style: column.width ? "width:" + column.width : null }, [
        el("button", { type: "button", text: column.label, onclick: function () {
          if (handlers.onSort) {
            handlers.onSort(column.key);
          }
        } })
      ]);
    }));
    var table = el("table", { class: "list" }, [el("thead", {}, [head]), body]);
    var pane = el("div", { class: "field scroll pane" }, [table]);

    function setRows(rows, selectedKey, emptyText) {
      body.textContent = "";
      rows.forEach(function (row) {
        var cells = row.cells.map(function (text, index) {
          if (index === 0) {
            return el("td", { class: "name" }, [icon(row.icon), el("span", { text: text })]);
          }
          return el("td", { text: text });
        });
        var line = el("tr", { tabindex: "0", class: (row.key === selectedKey ? "sel" : "") + (row.dim ? " dim" : "") }, cells);
        line.addEventListener("click", function () {
          body.querySelectorAll("tr.sel").forEach(function (selected) { selected.classList.remove("sel"); });
          line.classList.add("sel");
          handlers.onSelect(row);
        });
        line.addEventListener("dblclick", function () { handlers.onOpen(row); });
        line.addEventListener("keydown", function (event) {
          if (event.key === "Enter") {
            handlers.onOpen(row);
          } else if (event.key === "ArrowDown" && line.nextElementSibling) {
            event.preventDefault();
            line.nextElementSibling.focus();
            line.nextElementSibling.click();
          } else if (event.key === "ArrowUp" && line.previousElementSibling) {
            event.preventDefault();
            line.previousElementSibling.focus();
            line.previousElementSibling.click();
          }
        });
        body.append(line);
      });
      if (!rows.length) {
        body.append(el("tr", {}, [el("td", { class: "empty", colspan: String(columns.length), text: emptyText || "This folder is empty." })]));
      }
    }

    return { node: pane, setRows: setRows };
  }

  // ---------------------------------------------------------------- repositories

  function normaliseRepo(repo) {
    var record = {
      name: repo.name, description: repo.description || "", language: repo.language, fork: repo.fork,
      stars: repo.stargazers_count, forks: repo.forks_count, issues: repo.open_issues_count, size: formatSize(repo.size),
      license: repo.license ? repo.license.spdx_id : "None", branch: repo.default_branch,
      created: repo.created_at.slice(0, 10), pushed: repo.pushed_at.slice(0, 10), topics: repo.topics || []
    };
    return record;
  }

  function fetchAllRepos(page, collected) {
    var url = API + "/users/" + SITE.owner + "/repos?per_page=100&page=" + page;
    return fetchJson(url).then(function (batch) {
      var all = collected.concat(batch.map(normaliseRepo));
      if (batch.length === 100) {
        return fetchAllRepos(page + 1, all);
      }
      return all;
    });
  }

  var repoRequest = null;
  function loadRepos() {
    if (!repoRequest) {
      repoRequest = cachedJson("repos", REPO_CACHE_MINUTES, function () { return fetchAllRepos(1, []); }).then(function (result) {
        var repos = (result.data || SITE.snapshot).filter(function (repo) { return SITE.hidden.indexOf(repo.name) === -1; });
        return { repos: repos, live: result.live };
      });
    }
    return repoRequest;
  }

  function repoGroups(repos) {
    var byName = {};
    repos.forEach(function (repo) { byName[repo.name] = repo; });
    var placed = {};
    var groups = SITE.groups.map(function (group) {
      var members = group.repos.filter(function (name) { return byName[name]; }).map(function (name) {
        placed[name] = true;
        return byName[name];
      });
      return { title: group.title, repos: members };
    }).filter(function (group) { return group.repos.length; });
    var unsorted = repos.filter(function (repo) { return !placed[repo.name]; });
    if (unsorted.length) {
      groups.push({ title: "Unsorted", repos: unsorted });
    }
    return groups;
  }

  function repoLabel(repo) {
    return SITE.labels[repo.name] || (repo.fork ? "Fork" : repo.language || "");
  }

  function openRepos(selectName) {
    var existing = windows.get("repos");
    if (existing) {
      focusWindow(existing);
      if (selectName) {
        existing.select(selectName);
      }
      return;
    }

    var state = { groups: [], group: null, sort: null, descending: false, selected: null };
    var tree = el("ul", { class: "tree" });
    var props = el("div", { class: "group props" });
    var columns = [
      { key: "name", label: "Name" }, { key: "label", label: "Type", width: "90px" },
      { key: "stars", label: "Stars", width: "52px" }, { key: "pushed", label: "Updated", width: "84px" }
    ];
    var list = listView(columns, {
      onSelect: function (row) { showRepo(row.data); },
      onOpen: function (row) { openReadme(row.data); },
      onSort: function (key) {
        state.descending = state.sort === key ? !state.descending : key === "stars" || key === "pushed";
        state.sort = key;
        renderList();
      }
    });
    var body = el("div", { class: "wbody" }, [
      el("div", { class: "explorer" }, [
        el("div", { class: "side" }, [el("div", { class: "field scroll pane" }, [tree])]),
        el("div", { class: "main" }, [list.node, props])
      ])
    ]);
    var bounds = desktop.getBoundingClientRect();
    var entry = openWindow({
      id: "repos", title: "Repositories", icon: "folder", body: body, status: ["Loading...", ""],
      x: 372, y: 10, width: Math.max(420, Math.min(720, bounds.width - 380)), height: Math.min(500, bounds.height - 20)
    });

    function visibleRepos() {
      var repos = state.group ? state.group.repos.slice() : [].concat.apply([], state.groups.map(function (group) { return group.repos; }));
      if (state.sort) {
        repos.sort(function (a, b) {
          var left = state.sort === "label" ? repoLabel(a) : a[state.sort];
          var right = state.sort === "label" ? repoLabel(b) : b[state.sort];
          var order = typeof left === "number" ? left - right : naturalCompare(String(left), String(right));
          return state.descending ? -order : order;
        });
      }
      return repos;
    }

    function renderList() {
      var repos = visibleRepos();
      list.setRows(repos.map(function (repo) {
        return { key: repo.name, icon: repo.fork ? "doc" : "app", data: repo, cells: [repo.name, repoLabel(repo), String(repo.stars), repo.pushed] };
      }), state.selected);
      entry.setStatus(0, repos.length + " object(s)");
    }

    function renderTree() {
      tree.textContent = "";
      function node(label, group) {
        return el("li", {}, [el("div", { class: "node" }, [
          icon("folder"),
          el("button", { class: "label" + (state.group === group ? " sel" : ""), type: "button", text: label, onclick: function () {
            state.group = group;
            renderTree();
            renderList();
          } })
        ])]);
      }
      var children = el("ul", {}, state.groups.map(function (group) { return node(group.title, group); }));
      var root = node("All repositories", null);
      root.append(children);
      tree.append(root);
    }

    function showRepo(repo) {
      state.selected = repo.name;
      var facts = [
        ["Type", repo.fork ? "Fork" : "Original"], ["License", repo.license], ["Branch", repo.branch], ["Open issues", repo.issues],
        ["Forks", repo.forks], ["Size", repo.size], ["Created", repo.created], ["Last push", repo.pushed]
      ];
      if (repo.topics.length) {
        facts.push(["Topics", repo.topics.join(", ")]);
      }
      var base = "https://github.com/" + SITE.owner + "/" + repo.name;
      var extras = (SITE.extraLinks[repo.name] || []).map(function (pair) { return linkButton(pair[0], pair[1]); });
      props.textContent = "";
      props.append(
        el("span", { class: "legend", text: repo.name }),
        el("p", { text: repo.description || "No description published." }),
        el("dl", {}, facts.map(function (fact) {
          return el("div", {}, [el("dt", { text: fact[0] + ":" }), el("dd", { text: String(fact[1]), title: String(fact[1]) })]);
        })),
        el("div", { class: "row" }, [
          el("button", { class: "btn default", type: "button", text: "Open README", onclick: function () { openReadme(repo); } }),
          linkButton("Repository", base), linkButton("Issues", base + "/issues")
        ].concat(extras))
      );
    }

    entry.select = function (name) {
      var repo = visibleRepos().filter(function (candidate) { return candidate.name === name; })[0];
      if (!repo) {
        state.group = null;
        repo = visibleRepos().filter(function (candidate) { return candidate.name === name; })[0];
      }
      if (repo) {
        showRepo(repo);
        renderTree();
        renderList();
      }
    };

    props.append(el("span", { class: "legend", text: "Details" }), el("p", { class: "muted", text: "Select a repository to see its details. Double-click to open its README." }));
    loadRepos().then(function (result) {
      state.groups = repoGroups(result.repos);
      renderTree();
      renderList();
      entry.setStatus(1, result.live ? "Live from GitHub" : "Saved snapshot (GitHub API unavailable)");
      if (selectName) {
        entry.select(selectName);
      }
    });
  }

  function openReadme(repo) {
    var rawBase = RAW + "/" + SITE.owner + "/" + repo.name + "/" + (repo.branch || "HEAD") + "/";
    var pageBase = "https://github.com/" + SITE.owner + "/" + repo.name;
    var candidates = ["README.md", "readme.md", "Readme.md", "README.MD", "README", "README.txt", "README.rst"];

    function attempt(index) {
      if (index >= candidates.length) {
        return Promise.reject(new Error("This repository has no README."));
      }
      return fetch(rawBase + candidates[index]).then(function (response) {
        if (!response.ok) {
          return attempt(index + 1);
        }
        return response.text().then(function (text) {
          var plain = !/\.md$/i.test(candidates[index]);
          return { markdown: plain ? "```\n" + text + "\n```" : window.Markdown.frontMatter(text).body };
        });
      });
    }

    openViewer({
      id: "repo:" + repo.name, route: "repo/" + repo.name, title: repo.name + " - README",
      source: pageBase + "#readme", sourceLabel: "View on GitHub",
      imageBase: rawBase, linkBase: pageBase + "/blob/" + (repo.branch || "HEAD") + "/",
      load: function () { return attempt(0); }
    });
  }

  // ---------------------------------------------------------------- documents

  function docsBaseUrl() {
    var base = new URL(SITE.docsDir + "/", document.baseURI);
    return base;
  }

  var docsRequest = null;
  function loadDocs() {
    if (docsRequest) {
      return docsRequest;
    }
    var prefix = SITE.docsDir + "/";
    function fromTree() {
      var url = API + "/repos/" + SITE.owner + "/" + SITE.siteRepo + "/git/trees/HEAD?recursive=1";
      return fetchJson(url).then(function (result) {
        var paths = result.tree.filter(function (item) {
          return item.type === "blob" && item.path.indexOf(prefix) === 0 && /\.md$/i.test(item.path);
        }).map(function (item) { return item.path.slice(prefix.length); });
        return paths;
      });
    }
    // docs/index.json is an optional hand-kept list of paths, used for local preview and when the API is unreachable.
    function fromIndex() {
      return fetch(new URL("index.json", docsBaseUrl())).then(function (response) {
        if (!response.ok) {
          throw new Error("No index file");
        }
        return response.json();
      });
    }
    docsRequest = cachedJson("docs", DOCS_CACHE_MINUTES, fromTree).then(function (result) {
      if (result.data) {
        return { paths: result.data, source: result.live ? "Live from GitHub" : "Saved copy" };
      }
      return fromIndex().then(function (paths) {
        return { paths: paths, source: "Local index" };
      }).catch(function () {
        return { paths: [], source: "Document list unavailable" };
      });
    });
    return docsRequest;
  }

  function buildDocTree(paths) {
    var root = { name: SITE.docsDir, path: "", folders: {}, files: [], open: true };
    paths.forEach(function (path) {
      var parts = path.split("/");
      var folder = root;
      parts.slice(0, -1).forEach(function (part) {
        if (!folder.folders[part]) {
          folder.folders[part] = { name: part, path: (folder.path ? folder.path + "/" : "") + part, folders: {}, files: [], open: false, parent: folder };
        }
        folder = folder.folders[part];
      });
      folder.files.push({ name: parts[parts.length - 1], path: path });
    });
    return root;
  }

  function openDocs() {
    var existing = windows.get("docs");
    if (existing) {
      focusWindow(existing);
      return;
    }

    var state = { root: null, folder: null, paths: [], query: "" };
    var tree = el("ul", { class: "tree" });
    var address = el("input", { class: "field grow", readonly: true, "aria-label": "Current folder" });
    var search = el("input", { class: "field", type: "search", placeholder: "Find a document", "aria-label": "Find a document", style: "width:150px" });
    var upButton = el("button", { class: "btn", type: "button", text: "Up", onclick: function () {
      if (state.folder && state.folder.parent) {
        go(state.folder.parent);
      }
    } });
    var list = listView([{ key: "name", label: "Name" }, { key: "where", label: "In folder", width: "40%" }], {
      onSelect: function (row) { activate(row); },
      onOpen: function () { return; }
    });
    var body = el("div", { class: "wbody" }, [
      el("div", { class: "toolbar" }, [upButton, address, search]),
      el("div", { class: "explorer" }, [el("div", { class: "side" }, [el("div", { class: "field scroll pane" }, [tree])]), el("div", { class: "main" }, [list.node])])
    ]);
    var bounds = desktop.getBoundingClientRect();
    var entry = openWindow({
      id: "docs", title: "Documents", icon: "folder", body: body, status: ["Loading...", ""],
      width: Math.min(640, bounds.width - 120), height: Math.min(420, bounds.height - 40)
    });

    function activate(row) {
      if (row.folder) {
        go(row.folder);
      } else {
        openDocument(row.data.path);
      }
    }

    function go(folder) {
      state.folder = folder;
      state.query = "";
      search.value = "";
      var ancestor = folder;
      while (ancestor) {
        ancestor.open = true;
        ancestor = ancestor.parent;
      }
      renderTree();
      renderList();
    }

    function sortedFolders(folder) {
      var names = Object.keys(folder.folders).sort(naturalCompare);
      return names.map(function (name) { return folder.folders[name]; });
    }

    // Only expanded branches are built, so a large library costs nothing until a folder is opened.
    function renderBranch(folder) {
      var children = sortedFolders(folder);
      var twist = el("button", {
        class: "twist" + (children.length ? "" : " none"), type: "button", text: folder.open ? "-" : "+",
        "aria-label": (folder.open ? "Collapse " : "Expand ") + folder.name,
        onclick: function () {
          folder.open = !folder.open;
          renderTree();
        }
      });
      var item = el("li", {}, [el("div", { class: "node" }, [
        twist, icon("folder"),
        el("button", { class: "label" + (state.folder === folder && !state.query ? " sel" : ""), type: "button", text: prettyName(folder.name), onclick: function () { go(folder); } })
      ])]);
      if (folder.open && children.length) {
        item.append(el("ul", {}, children.map(renderBranch)));
      }
      return item;
    }

    function renderTree() {
      tree.textContent = "";
      tree.append(renderBranch(state.root));
    }

    function renderList() {
      var rows;
      if (state.query) {
        var needle = state.query.toLowerCase();
        var matches = state.paths.filter(function (path) { return path.toLowerCase().indexOf(needle) !== -1; });
        rows = matches.slice(0, SEARCH_RESULT_LIMIT).map(function (path) {
          var parts = path.split("/");
          return { key: path, icon: "doc", data: { path: path }, cells: [prettyName(parts[parts.length - 1]), parts.slice(0, -1).join("\\") || "\\"] };
        });
        address.value = 'Search results for "' + state.query + '"';
        entry.setStatus(0, matches.length + " match(es)" + (matches.length > SEARCH_RESULT_LIMIT ? ", first " + SEARCH_RESULT_LIMIT + " shown" : ""));
        list.setRows(rows, null, "No documents match.");
        return;
      }
      var folder = state.folder;
      var where = folder.path ? folder.path.replace(/\//g, "\\") : "\\";
      rows = sortedFolders(folder).map(function (child) {
        return { key: "dir:" + child.path, icon: "folder", folder: child, cells: [prettyName(child.name), where] };
      }).concat(folder.files.slice().sort(function (a, b) { return naturalCompare(a.name, b.name); }).map(function (file) {
        return { key: file.path, icon: "doc", data: file, cells: [prettyName(file.name), where] };
      }));
      address.value = SITE.docsDir + (folder.path ? "\\" + folder.path.replace(/\//g, "\\") : "");
      upButton.disabled = !folder.parent;
      entry.setStatus(0, rows.length + " object(s)");
      list.setRows(rows, null, state.paths.length ? "This folder is empty." : "No documents yet. Add Markdown files to the " + SITE.docsDir + " folder of the site repository.");
    }

    search.addEventListener("input", function () {
      state.query = search.value.trim();
      renderTree();
      renderList();
    });
    search.addEventListener("keydown", function (event) { event.stopPropagation(); });

    loadDocs().then(function (result) {
      state.paths = result.paths.slice().sort(naturalCompare);
      state.root = buildDocTree(state.paths);
      state.folder = state.root;
      renderTree();
      renderList();
      entry.setStatus(1, state.paths.length + " document(s). " + result.source);
    });
  }

  function compactName(name) {
    var compact = name.replace(/\.md$/i, "").replace(/^\d+[-_. ]+/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    return compact;
  }

  // A document copied from a repository README keeps that README's relative image paths. Those files live in the
  // source repository, not in this site, so the document needs to know which repository it came from.
  // "repo: Name" in the document's front matter states it outright. Without that, the file name is matched
  // against the public repository list (UNIVERSAL_ARMOR_CORE.md -> Universal-Armor), longest match first.
  function sourceRepoFor(path, meta) {
    return loadRepos().then(function (result) {
      var fileName = compactName(path.split("/").pop());
      var best = null;
      result.repos.forEach(function (repo) {
        var candidate = compactName(repo.name);
        var matches = meta.repo ? repo.name.toLowerCase() === meta.repo.toLowerCase() : fileName.indexOf(candidate) === 0;
        if (matches && (!best || candidate.length > compactName(best.name).length)) {
          best = repo;
        }
      });
      if (!best && meta.repo) {
        best = { name: meta.repo, branch: meta.branch || "HEAD" };
      }
      return best;
    });
  }

  function openDocument(path) {
    var encoded = path.split("/").map(encodeURIComponent).join("/");
    var url = new URL(encoded, docsBaseUrl());
    var folderUrl = new URL(".", url).href;
    var parts = path.split("/");
    openViewer({
      id: "doc:" + path, route: "doc/" + path, title: prettyName(parts[parts.length - 1]),
      source: "https://github.com/" + SITE.owner + "/" + SITE.siteRepo + "/blob/HEAD/" + SITE.docsDir + "/" + encoded, sourceLabel: "View source",
      imageBase: url.href, linkBase: url.href,
      load: function () {
        return fetch(url).then(function (response) {
          if (!response.ok) {
            throw new Error("The document could not be found.");
          }
          return response.text();
        }).then(function (text) {
          var parsed = window.Markdown.frontMatter(text);
          return sourceRepoFor(path, parsed.meta).then(function (repo) {
            var result = { markdown: parsed.body, title: parsed.meta.title };
            if (!repo) {
              return result;
            }
            var rawBase = RAW + "/" + SITE.owner + "/" + repo.name + "/" + (parsed.meta.branch || repo.branch || "HEAD") + "/";
            if (parsed.meta.repo) {
              result.imageBase = rawBase;
              return result;
            }
            // A guessed repository is only a fallback: an image that exists in this site always wins.
            result.imageFallback = function (source) {
              return source.indexOf(folderUrl) === 0 ? rawBase + source.slice(folderUrl.length) : null;
            };
            return result;
          });
        });
      }
    });
  }

  // ---------------------------------------------------------------- document viewer

  // spec: { id, route, title, source, sourceLabel, imageBase, linkBase, load() }
  // load() resolves to { markdown, title?, imageBase?, imageFallback?(source) -> url or null }
  function openViewer(spec) {
    if (windows.get(spec.id)) {
      focusWindow(windows.get(spec.id));
      return;
    }
    var doc = el("div", { class: "field scroll doc pane", tabindex: "0" }, [el("p", { class: "muted", text: "Loading..." })]);
    var outline = el("div", { class: "field scroll outline pane" });
    var frame = el("div", { class: "viewer no-outline" }, [outline, doc]);
    var contentsButton = el("button", { class: "btn", type: "button", text: "Contents", disabled: true, onclick: function () {
      contentsButton.classList.toggle("on", !frame.classList.toggle("no-outline"));
    } });
    var body = el("div", { class: "wbody" }, [
      el("div", { class: "toolbar" }, [contentsButton, linkButton(spec.sourceLabel, spec.source)]),
      frame
    ]);
    var bounds = desktop.getBoundingClientRect();
    var entry = openWindow({
      id: spec.id, route: spec.route, title: spec.title, icon: "doc", body: body, status: ["", ""],
      width: Math.min(760, bounds.width - 60), height: Math.min(560, bounds.height - 30)
    });

    function scrollToSlug(slug) {
      var target = doc.querySelector('[data-slug="' + CSS.escape(slug) + '"]');
      if (target) {
        doc.scrollTop = target.offsetTop - doc.offsetTop - 6;
      }
    }

    // Links to other site documents open in a viewer window instead of leaving the page; #anchors scroll in place.
    doc.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (!link) {
        return;
      }
      if (link.dataset.anchor !== undefined) {
        event.preventDefault();
        scrollToSlug(link.dataset.anchor);
        return;
      }
      var docsRoot = docsBaseUrl().href;
      var href = link.href.split("#")[0];
      if (href.indexOf(docsRoot) === 0 && /\.md$/i.test(href)) {
        event.preventDefault();
        openDocument(decodeURIComponent(href.slice(docsRoot.length)));
      }
    });

    spec.load().then(function (result) {
      var rendered = window.Markdown.render(result.markdown, { imageBase: result.imageBase || spec.imageBase, linkBase: spec.linkBase });
      if (result.title) {
        entry.setTitle(result.title);
      }
      if (result.imageFallback) {
        rendered.fragment.querySelectorAll("img[src]").forEach(function (image) {
          image.addEventListener("error", function () {
            var alternative = result.imageFallback(image.src);
            if (alternative) {
              image.src = alternative;
            }
          }, { once: true });
        });
      }
      doc.textContent = "";
      doc.append(rendered.fragment);
      // Meters fill when they first scroll into view, or when the panel holding them is opened. The stylesheet
      // keeps them fully visible if this never runs (Classic theme, reduced motion, or no observer support).
      // The meter's parent is observed, not the meter: a meter waiting to fill is clipped to nothing, and a fully
      // clipped element never counts as intersecting.
      var meters = Array.prototype.slice.call(doc.querySelectorAll("progress"));
      if (window.IntersectionObserver) {
        var meterWatcher = new IntersectionObserver(function (seen) {
          seen.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.querySelectorAll(":scope > progress").forEach(function (meter) {
                meter.classList.add("shown");
              });
              meterWatcher.unobserve(entry.target);
            }
          });
        }, { root: doc, threshold: 0.2 });
        meters.forEach(function (meter) {
          meterWatcher.observe(meter.parentElement);
        });
      } else {
        meters.forEach(function (meter) {
          meter.classList.add("shown");
        });
      }
      var entries = rendered.headings.filter(function (heading) { return heading.level <= 3; });
      outline.textContent = "";
      entries.forEach(function (heading) {
        outline.append(el("button", { class: "l" + heading.level, type: "button", text: heading.text, title: heading.text, onclick: function () { scrollToSlug(heading.slug); } }));
      });
      // The outline is offered only when a document is long enough to need one, and starts open on wide windows.
      if (entries.length >= 4) {
        contentsButton.disabled = false;
        if (!narrow.matches) {
          frame.classList.remove("no-outline");
          contentsButton.classList.add("on");
        }
      }
      var words = result.markdown.split(/\s+/).length;
      entry.setStatus(0, entries.length + " section(s)");
      entry.setStatus(1, "About " + Math.max(1, Math.round(words / 220)) + " min read");
    }).catch(function (error) {
      doc.textContent = "";
      doc.append(el("p", { text: error.message || "The document could not be loaded." }), el("p", {}, [linkButton(spec.sourceLabel, spec.source)]));
    });
  }

  // ---------------------------------------------------------------- small programs

  function openAbout() {
    var body = el("div", { class: "wbody pad about" }, [
      el("div", { class: "about-head" }, [
        el("div", { class: "field logo" }, [icon("tree", 3)]),
        el("div", {}, [el("b", { text: SITE.name })].concat(SITE.roles.map(function (role) { return el("div", { text: role }); })))
      ]),
      el("div", {}, SITE.about.map(function (paragraph) { return el("p", { text: paragraph }); })),
      el("div", { class: "row end", style: "margin-top:12px" }, [
        el("button", { class: "btn", type: "button", text: "Repositories", onclick: function () { openRepos(); } }),
        el("button", { class: "btn", type: "button", text: "Documents", onclick: openDocs }),
        el("button", { class: "btn default", type: "button", text: "OK", onclick: function () { closeWindow(windows.get("about")); } })
      ])
    ]);
    openWindow({ id: "about", title: "About " + SITE.name, icon: "tree", body: body, fixed: true, x: 92, y: 10, width: 272 });
  }

  function openLinks() {
    var items = SITE.links.map(function (link) {
      return el("li", {}, [el("a", { href: link.url, target: "_blank", rel: "noopener noreferrer", title: link.description }, [
        icon("globe"), el("b", { text: link.name }), el("span", { text: link.description })
      ])]);
    });
    var body = el("div", { class: "wbody" }, [el("div", { class: "field scroll pane" }, [el("ul", { class: "linklist" }, items)])]);
    openWindow({ id: "links", title: "Links", icon: "globe", body: body, status: [SITE.links.length + " object(s)"], width: 420, height: 230 });
  }

  function openDisplay() {
    var options = THEMES.map(function (theme) {
      var radio = el("input", { type: "radio", name: "theme", value: theme.id, id: "theme-" + theme.id, onchange: function () { setTheme(theme.id); } });
      radio.checked = currentTheme() === theme.id;
      return el("label", { class: "radio", for: "theme-" + theme.id }, [radio, el("span", { text: theme.label }), el("small", { text: theme.note })]);
    });
    var body = el("div", { class: "wbody pad" }, [
      el("div", { class: "group" }, [el("span", { class: "legend", text: "Theme" })].concat(options)),
      el("div", { class: "row end", style: "margin-top:12px" }, [
        el("button", { class: "btn default", type: "button", text: "OK", onclick: function () { closeWindow(windows.get("display")); } })
      ])
    ]);
    openWindow({ id: "display", title: "Display Properties", icon: "monitor", body: body, fixed: true, width: 330 });
  }

  var PROGRAMS = [
    { label: "About", icon: "tree", run: openAbout },
    { label: "Repositories", icon: "folder", run: function () { openRepos(); } },
    { label: "Documents", icon: "doc", run: openDocs },
    { label: "Links", icon: "globe", run: openLinks },
    { label: "Display", icon: "monitor", run: openDisplay }
  ];

  // ---------------------------------------------------------------- shell

  function buildShell() {
    var icons = document.getElementById("icons");
    PROGRAMS.forEach(function (program) {
      icons.append(el("button", { class: "dicon", type: "button", onclick: program.run }, [icon(program.icon, 2), el("span", { text: program.label })]));
    });

    var start = document.getElementById("start");
    var menu = document.getElementById("startmenu");
    start.querySelector(".ico").append(icon("tree"));
    function toggleMenu(show) {
      menu.hidden = !show;
      start.classList.toggle("on", show);
      start.setAttribute("aria-expanded", String(show));
    }
    var items = PROGRAMS.map(function (program) {
      return el("button", { type: "button", role: "menuitem", onclick: function () {
        toggleMenu(false);
        program.run();
      } }, [icon(program.icon), el("span", { text: program.label })]);
    });
    items.push(el("hr"), el("a", { role: "menuitem", href: "https://github.com/" + SITE.owner, target: "_blank", rel: "noopener noreferrer" }, [icon("globe"), el("span", { text: "GitHub profile" })]));
    menu.append(el("div", { class: "band", text: SITE.name }), el("div", { class: "items" }, items));
    start.addEventListener("click", function () { toggleMenu(menu.hidden); });
    document.addEventListener("pointerdown", function (event) {
      if (!menu.hidden && !event.target.closest("#startmenu, #start")) {
        toggleMenu(false);
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        toggleMenu(false);
      }
    });

    document.getElementById("themebtn").addEventListener("click", cycleTheme);
    setTheme(currentTheme());

    var clock = document.getElementById("clock");
    function tick() {
      clock.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    tick();
    setInterval(tick, 15000);
  }

  // Routes: #/repo/<name> opens a README, #/doc/<path> opens a document. A bare #<name> is the address format the
  // previous version of this site used, so it still selects that repository.
  function openRoute() {
    var hash = decodeURIComponent(location.hash.slice(1));
    if (hash.indexOf("/repo/") === 0) {
      var name = hash.slice(6);
      loadRepos().then(function (result) {
        var repo = result.repos.filter(function (candidate) { return candidate.name === name; })[0];
        if (repo) {
          openReadme(repo);
        }
      });
      return true;
    }
    if (hash.indexOf("/doc/") === 0) {
      openDocument(hash.slice(5));
      return true;
    }
    if (hash && hash.charAt(0) !== "/") {
      openRepos(hash);
      return true;
    }
    return false;
  }

  buildShell();
  var routed = openRoute();
  if (!routed) {
    openRepos();
    // On a phone the windows stack in one column, so only the main program opens and About stays one tap away.
    if (!narrow.matches) {
      openAbout();
    }
  }
  addEventListener("hashchange", openRoute);
})();
