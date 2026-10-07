// Markdown renderer for repository READMEs and site documents.
// Written in-house so the site carries no third-party script. It covers the GitHub-flavoured subset that READMEs
// use in practice: headings, lists, tables, fenced code, block quotes, inline HTML, and reference links.
// Output always passes through sanitize(), because README content is fetched from outside this site.
(function (global) {
  "use strict";

  var HTML_BLOCK = /^ {0,3}<\/?(?:address|article|aside|blockquote|center|dd|details|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|picture|section|source|summary|table|tbody|td|tfoot|th|thead|tr|ul)(?=[\s/>]|$)/i;
  var HTML_VERBATIM = /^ {0,3}<(pre|script|style)(?=[\s>]|$)/i;
  var FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
  var HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/;
  var RULE = /^ {0,3}([-*_])(?: *\1){2,} *$/;
  var QUOTE = /^ {0,3}> ?/;
  var ITEM = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(.*)$/;
  var TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
  var REFERENCE = /^ {0,3}\[([^\]]+)\]:\s*<?(\S+?)>?(?:\s+["'(](.*)["')])?\s*$/;

  var ALLOWED_TAGS = new Set(("a abbr b blockquote br center cite code dd del details div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 "
    + "hr i img input ins kbd li mark ol p picture pre q s samp small source span strike strong sub summary sup table tbody "
    + "td tfoot th thead tr tt u ul var").split(" "));
  var DROPPED_TAGS = new Set(("script style iframe object embed svg math template noscript form textarea select button video "
    + "audio canvas link meta base title head").split(" "));
  var ALLOWED_ATTRIBUTES = new Set(("href src srcset alt title width height align valign colspan rowspan open start type checked "
    + "disabled media").split(" "));
  var SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

  function escapeHtml(text) {
    var escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    return escaped;
  }

  function indentOf(line) {
    var width = line.match(/^ */)[0].length;
    return width;
  }

  function slugify(text) {
    var slug = text.toLowerCase().trim().replace(/[^\w\- ]+/g, "").replace(/ +/g, "-");
    return slug;
  }

  // Inline pass. Anything that must survive later substitutions untouched (code, raw tags, generated links) is
  // parked in `stash` and referenced by a NUL-delimited token, then restored at the end.
  function renderInline(source, references) {
    var stash = [];
    function park(html) {
      stash.push(html);
      return "\u0000" + (stash.length - 1) + "\u0000";
    }

    var text = source;
    text = text.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, function (match, ticks, code) {
      return park("<code>" + escapeHtml(code.replace(/^ (.*) $/, "$1")) + "</code>");
    });
    text = text.replace(/<((?:https?:\/\/|mailto:)[^\s<>]+)>/g, function (match, url) {
      return park('<a href="' + escapeHtml(url) + '">' + escapeHtml(url.replace(/^mailto:/, "")) + "</a>");
    });
    text = text.replace(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^<>]*>/g, function (tag) {
      return park(tag);
    });
    text = text.replace(/\\([\\`*_{}\[\]()#+\-.!|~<>])/g, function (match, character) {
      return park(escapeHtml(character));
    });
    text = text.replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    var destination = "\\(\\s*([^\\s()]*(?:\\([^\\s()]*\\)[^\\s()]*)*)(?:\\s+\"([^\"]*)\")?\\s*\\)";
    text = text.replace(new RegExp("!\\[([^\\]]*)\\]" + destination, "g"), function (match, alt, url, title) {
      var titleAttribute = title ? ' title="' + escapeHtml(title) + '"' : "";
      return park('<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '"' + titleAttribute + ">");
    });
    text = text.replace(new RegExp("\\[((?:[^\\[\\]]|\\[[^\\]]*\\])*)\\]" + destination, "g"), function (match, label, url, title) {
      var titleAttribute = title ? ' title="' + escapeHtml(title) + '"' : "";
      return park('<a href="' + escapeHtml(url) + '"' + titleAttribute + ">") + label + park("</a>");
    });
    text = text.replace(/\[([^\[\]]+)\](?:\[([^\[\]]*)\])?/g, function (match, label, id) {
      var reference = references[(id || label).toLowerCase()];
      if (!reference) {
        return match;
      }
      return park('<a href="' + escapeHtml(reference.url) + '">') + label + park("</a>");
    });
    text = text.replace(/(^|[\s(])((?:https?:\/\/)[^\s<\u0000]+)/g, function (match, lead, url) {
      var trailing = (url.match(/[.,;:!?)]+$/) || [""])[0];
      var clean = url.slice(0, url.length - trailing.length);
      return lead + park('<a href="' + clean.replace(/"/g, "&quot;") + '">' + clean + "</a>") + trailing;
    });

    text = text.replace(/\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/(^|[^\w])__(?=\S)([\s\S]+?)(?<=\S)__(?!\w)/g, "$1<strong>$2</strong>");
    text = text.replace(/\*(?=\S)([^*]+?)(?<=\S)\*/g, "<em>$1</em>");
    text = text.replace(/(^|[^\w])_(?=\S)([^_]+?)(?<=\S)_(?!\w)/g, "$1<em>$2</em>");
    text = text.replace(/~~(?=\S)([\s\S]+?)(?<=\S)~~/g, "<del>$1</del>");
    text = text.replace(/(?: {2,}|\\)\n/g, "<br>\n");

    var restored = text;
    // Parked fragments can contain tokens themselves (a link label holding code), so restore until none remain.
    while (/\u0000\d+\u0000/.test(restored)) {
      restored = restored.replace(/\u0000(\d+)\u0000/g, function (match, index) {
        return stash[Number(index)];
      });
    }
    return restored;
  }

  function splitRow(line) {
    var trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    var cells = trimmed.split(/(?<!\\)\|/).map(function (cell) {
      return cell.replace(/\\\|/g, "|").trim();
    });
    return cells;
  }

  function startsBlock(line) {
    var starts = FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || ITEM.test(line)
      || HTML_BLOCK.test(line) || HTML_VERBATIM.test(line);
    return starts;
  }

  function renderBlocks(lines, references) {
    var out = [];
    var index = 0;

    while (index < lines.length) {
      var line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      var fence = line.match(FENCE);
      if (fence) {
        var code = [];
        index += 1;
        while (index < lines.length && !new RegExp("^ {0,3}" + fence[1][0] + "{" + fence[1].length + ",}\\s*$").test(lines[index])) {
          code.push(lines[index]);
          index += 1;
        }
        index += 1;
        var language = fence[2] ? ' class="language-' + escapeHtml(fence[2]) + '"' : "";
        out.push("<pre><code" + language + ">" + escapeHtml(code.join("\n")) + "</code></pre>");
        continue;
      }

      var verbatim = line.match(HTML_VERBATIM);
      if (verbatim) {
        var closing = new RegExp("</" + verbatim[1] + ">", "i");
        var raw = [];
        while (index < lines.length) {
          raw.push(lines[index]);
          index += 1;
          if (closing.test(raw[raw.length - 1])) {
            break;
          }
        }
        out.push(raw.join("\n"));
        continue;
      }

      if (/^ {0,3}<!--/.test(line)) {
        while (index < lines.length && !/-->/.test(lines[index])) {
          index += 1;
        }
        index += 1;
        continue;
      }

      // A block-level HTML line runs to the next blank line, as on GitHub. Markdown resumes after that blank line,
      // which is what lets READMEs wrap Markdown in <div align="center"> or table cells.
      if (HTML_BLOCK.test(line)) {
        var html = [];
        while (index < lines.length && lines[index].trim()) {
          html.push(lines[index]);
          index += 1;
        }
        out.push(html.join("\n"));
        continue;
      }

      var heading = line.match(HEADING);
      if (heading) {
        out.push("<h" + heading[1].length + ">" + renderInline(heading[2] || "", references) + "</h" + heading[1].length + ">");
        index += 1;
        continue;
      }

      if (RULE.test(line)) {
        out.push("<hr>");
        index += 1;
        continue;
      }

      if (QUOTE.test(line)) {
        var quoted = [];
        while (index < lines.length && lines[index].trim() && (QUOTE.test(lines[index]) || !startsBlock(lines[index]))) {
          quoted.push(lines[index].replace(QUOTE, ""));
          index += 1;
        }
        out.push("<blockquote>" + renderBlocks(quoted, references) + "</blockquote>");
        continue;
      }

      var item = line.match(ITEM);
      if (item) {
        var list = renderList(lines, index, references);
        out.push(list.html);
        index = list.next;
        continue;
      }

      if (line.indexOf("|") !== -1 && index + 1 < lines.length && TABLE_RULE.test(lines[index + 1])
          && lines[index + 1].indexOf("-") !== -1 && splitRow(line).length === splitRow(lines[index + 1]).length) {
        var aligns = splitRow(lines[index + 1]).map(function (cell) {
          var align = /^:.*:$/.test(cell) ? "center" : /:$/.test(cell) ? "right" : /^:/.test(cell) ? "left" : "";
          return align ? ' align="' + align + '"' : "";
        });
        var head = splitRow(line).map(function (cell, column) {
          return "<th" + aligns[column] + ">" + renderInline(cell, references) + "</th>";
        });
        var body = [];
        index += 2;
        while (index < lines.length && lines[index].trim() && lines[index].indexOf("|") !== -1) {
          var cells = splitRow(lines[index]).slice(0, aligns.length).map(function (cell, column) {
            return "<td" + aligns[column] + ">" + renderInline(cell, references) + "</td>";
          });
          body.push("<tr>" + cells.join("") + "</tr>");
          index += 1;
        }
        out.push("<table><thead><tr>" + head.join("") + "</tr></thead><tbody>" + body.join("") + "</tbody></table>");
        continue;
      }

      var paragraph = [line.trim()];
      index += 1;
      var setext = 0;
      while (index < lines.length && lines[index].trim()) {
        if (/^ {0,3}=+\s*$/.test(lines[index])) {
          setext = 1;
          index += 1;
          break;
        }
        if (/^ {0,3}-+\s*$/.test(lines[index])) {
          setext = 2;
          index += 1;
          break;
        }
        if (startsBlock(lines[index])) {
          break;
        }
        paragraph.push(lines[index].replace(/^ +/, ""));
        index += 1;
      }
      var content = renderInline(paragraph.join("\n"), references);
      out.push(setext ? "<h" + setext + ">" + content + "</h" + setext + ">" : "<p>" + content + "</p>");
    }

    return out.join("\n");
  }

  function renderList(lines, start, references) {
    var first = lines[start].match(ITEM);
    var base = first[1].length;
    var ordered = /\d/.test(first[2]);
    var items = [];
    var index = start;

    while (index < lines.length) {
      var match = lines[index].match(ITEM);
      if (!match || match[1].length > base + 1 || match[1].length < base || /\d/.test(match[2]) !== ordered) {
        break;
      }
      var contentIndent = base + match[2].length + Math.min(match[3].length, 4);
      var body = [match[4]];
      index += 1;

      while (index < lines.length) {
        var line = lines[index];
        if (!line.trim()) {
          var ahead = index + 1;
          while (ahead < lines.length && !lines[ahead].trim()) {
            ahead += 1;
          }
          if (ahead < lines.length && indentOf(lines[ahead]) >= base + 2) {
            body.push("");
            index += 1;
            continue;
          }
          break;
        }
        if (indentOf(line) >= base + 2) {
          body.push(line.slice(Math.min(indentOf(line), contentIndent)));
          index += 1;
          continue;
        }
        if (startsBlock(line)) {
          break;
        }
        body.push(line.trim());
        index += 1;
      }
      items.push(body);

      // A blank line between two items of the same list does not end the list.
      var skip = index;
      while (skip < lines.length && !lines[skip].trim()) {
        skip += 1;
      }
      var following = skip < lines.length ? lines[skip].match(ITEM) : null;
      if (skip > index && following && following[1].length === base && /\d/.test(following[2]) === ordered) {
        index = skip;
      }
    }

    var rendered = items.map(function (body) {
      var task = body[0].match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        body[0] = task[2];
      }
      var html = renderBlocks(body, references);
      if (html.indexOf("<p>") === 0 && html.indexOf("<p>", 3) === -1) {
        html = html.replace("<p>", "").replace("</p>", "");
      }
      if (task) {
        var checked = task[1] === " " ? "" : " checked";
        return '<li class="task"><input type="checkbox" disabled' + checked + "> " + html + "</li>";
      }
      return "<li>" + html + "</li>";
    });
    var tag = ordered ? "ol" : "ul";
    var startAttribute = ordered && parseInt(first[2], 10) !== 1 ? ' start="' + parseInt(first[2], 10) + '"' : "";
    return { html: "<" + tag + startAttribute + ">" + rendered.join("") + "</" + tag + ">", next: index };
  }

  function toHtml(markdown) {
    var lines = markdown.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
    var references = {};
    var inFence = null;
    var kept = lines.filter(function (line) {
      var fence = line.match(FENCE);
      if (fence && (!inFence || fence[1][0] === inFence)) {
        inFence = inFence ? null : fence[1][0];
        return true;
      }
      var reference = !inFence && line.match(REFERENCE);
      if (reference) {
        references[reference[1].toLowerCase()] = { url: reference[2] };
        return false;
      }
      return true;
    });
    var html = renderBlocks(kept, references);
    return html;
  }

  function resolveUrl(value, base) {
    try {
      var url = new URL(value, base);
      if (!SAFE_PROTOCOLS.has(url.protocol)) {
        return null;
      }
      return url.href;
    } catch (error) {
      return null;
    }
  }

  // Whitelist sanitizer. Unknown elements are unwrapped so their text survives; active content is removed outright.
  function sanitize(root, options) {
    var elements = Array.prototype.slice.call(root.querySelectorAll("*"));
    elements.forEach(function (element) {
      var tag = element.tagName.toLowerCase();
      if (DROPPED_TAGS.has(tag)) {
        element.remove();
        return;
      }
      if (!ALLOWED_TAGS.has(tag)) {
        element.replaceWith.apply(element, Array.prototype.slice.call(element.childNodes));
        return;
      }
      Array.prototype.slice.call(element.attributes).forEach(function (attribute) {
        var name = attribute.name.toLowerCase();
        var keepClass = name === "class" && (/^language-[\w+#.-]+$/.test(attribute.value) || attribute.value === "task");
        if (!ALLOWED_ATTRIBUTES.has(name) && !keepClass) {
          element.removeAttribute(attribute.name);
        }
      });
      if (tag === "input" && element.getAttribute("type") !== "checkbox") {
        element.remove();
        return;
      }
      if (tag === "input") {
        element.setAttribute("disabled", "");
      }
      if (element.hasAttribute("src")) {
        var source = resolveUrl(element.getAttribute("src"), options.imageBase);
        if (source) {
          element.setAttribute("src", source);
          element.setAttribute("loading", "lazy");
        } else {
          element.removeAttribute("src");
        }
      }
      if (element.hasAttribute("srcset")) {
        var candidates = element.getAttribute("srcset").split(",").map(function (candidate) {
          var parts = candidate.trim().split(/\s+/);
          var resolved = resolveUrl(parts[0], options.imageBase);
          return resolved ? [resolved].concat(parts.slice(1)).join(" ") : null;
        }).filter(Boolean);
        element.setAttribute("srcset", candidates.join(", "));
      }
      if (tag === "a" && element.hasAttribute("href")) {
        var href = element.getAttribute("href");
        if (href.charAt(0) === "#") {
          element.dataset.anchor = href.slice(1).toLowerCase();
          return;
        }
        var target = resolveUrl(href, options.linkBase);
        if (!target) {
          element.removeAttribute("href");
          return;
        }
        element.setAttribute("href", target);
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }
    });
  }

  // Returns { fragment, headings }. Headings carry a slug so the viewer can build an outline and resolve #anchors.
  function render(markdown, options) {
    var template = document.createElement("template");
    template.innerHTML = toHtml(markdown);
    sanitize(template.content, options);
    var seen = {};
    var headings = [];
    template.content.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(function (heading) {
      var slug = slugify(heading.textContent) || "section";
      seen[slug] = (seen[slug] || 0) + 1;
      if (seen[slug] > 1) {
        slug += "-" + (seen[slug] - 1);
      }
      heading.dataset.slug = slug;
      headings.push({ level: Number(heading.tagName.charAt(1)), text: heading.textContent.trim(), slug: slug });
    });
    return { fragment: template.content, headings: headings };
  }

  global.Markdown = { render: render, toHtml: toHtml };
})(window);
