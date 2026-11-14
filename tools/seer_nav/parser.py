"""Parse Sentry's frontend source into the entries of Seer's nav snapshot.

Only runs when regenerating the snapshot (see generate_snapshot), never per request.
Each entry keeps the conditions the frontend renders it under, as data, so the
request-time filter can evaluate them per org instead of baking in one org's view.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

from tools.seer_nav.entries import (
    CRUMB_SEPARATOR,
    PROJECT_PLACEHOLDER,
    TEAM_PLACEHOLDER,
    Condition,
    NavEntry,
)

_SECONDARY_NAV_TOKEN_RE = re.compile(
    r"<SecondaryNavigation\.Link\b(?P<link>.*?)</SecondaryNavigation\.Link>"
    r"|<SecondaryNavigation\.Section\b(?P<section>[^>]*)>"
    r"|(?P<section_close></SecondaryNavigation\.Section>)"
    r"|<Feature\b(?P<feature>[^>]*)>"
    r"|(?P<feature_close></Feature>)"
    r"|\{(?P<cond>[^{}\n]*?)\s*(?P<cond_op>&&|\?)\s*\(",
    re.DOTALL,
)
_LINK_TO_RE = re.compile(r"to=\{`([^`]*)`\}|pathname: `([^`]*)`")
_FEATURES_ATTR_RE = re.compile(r"""features=(\{\[[^\]]*\]\}|"[^"]*"|'[^']*')""")
_LINK_LABEL_RE = re.compile(r"\{t\('([^']+)'\)\}")
_TITLE_ATTR_RE = re.compile(r"title=\{t\('([^']+)'\)\}")
_HEADER_RE = re.compile(
    r"<SecondaryNavigation\.Header>\s*(?:<SecondaryNavigation\.HeaderTitle>\s*)?\{t\('([^']+)'\)\}"
)
_BASE_URL_RE = re.compile(r"const baseUrl = `([^`]*)`")
_FLAG_VAR_RE = re.compile(r"const (\w+) = organization\.features\.includes\(\s*'([^']+)'\s*\)")
_QUOTED_RE = re.compile(r"""['"]([^'"]+)['"]""")
_TEMPLATE_REF_RE = re.compile(r"\$\{(\w+)\}")
_IMPORT_RE = re.compile(r"import \{([^}]*)\} from '(sentry/[^']+)'")
_STRING_CONST_RE = re.compile(r"""^(?:export )?const (\w+) = ['"]([^'"]*)['"]""", re.MULTILINE)
_SETTINGS_SECTION_NAME_RE = re.compile(r"name: t\('([^']+)'\)")
_SETTINGS_ITEM_RE = re.compile(r"path: `([^`]*)`")
_SETTINGS_TITLE_RE = re.compile(r"title: t\('([^']+)'\)")
_SETTINGS_TERNARY_TITLE_RE = re.compile(r"title: ([\w.?!]+) \? t\('([^']+)'\) : t\('([^']+)'\)")
# Hook results and helpers the nav branches on, with the check each one performs.
_KNOWN_ALIASES = {
    # views/settings/useSettingsV3.ts
    "settingsV3": "organization.features.includes('settings-v3')",
    # utils/seer/showNewSeer.ts, with orgHasNewSeerPlan.ts inlined
    "showNewSeer(organization)": (
        "organization.features.includes('seat-based-seer-enabled') || "
        "organization.features.includes('token-billed-seer-enabled') || ("
        "!organization.features.includes('seer-added') && "
        "!organization.features.includes('code-review-beta') && "
        "organization.features.includes('seer-user-billing-launch'))"
    ),
}
# Source files the hand-copied aliases above were written from, with a hash of their code
# (comments and whitespace ignored). A changed file means the alias may be stale.
_ALIAS_SOURCES = {
    "utils/seer/showNewSeer.ts": "96a95fd07e5ce7da",
    "utils/seer/orgHasNewSeerPlan.ts": "ec7683ec625ced39",
    "views/settings/useSettingsV3.ts": "360452eb683738f5",
}
_SETTINGS_FUNCTION_SPLIT_RE = re.compile(r"\n(?:export )?function ")
_SETTINGS_SHOW_RE = re.compile(r"\bshow:\s*")
_TAXONOMY_ENTRY_RE = re.compile(r"\[IssueTaxonomy\.\w+\]: \{(.*?)\n  \},", re.DOTALL)
_TAXONOMY_LABEL_RE = re.compile(r"label: t\('([^']+)'\)")
_TAXONOMY_KEY_RE = re.compile(r"key: '([^']+)'")
_TAXONOMY_FLAGS_RE = re.compile(r"featureFlags: (\w+)")

_ARROW_PARAMS_RE = re.compile(r"^\([^)]*\)\s*=>\s*")
_FEATURE_CHECK_RE = re.compile(
    r"""(?:organization\??\.)?features\??\.includes\(\s*['"]([^'"]+)['"]\s*\)"""
)
_ORG_ATTR_RE = re.compile(r"organization\??\.(\w+)")
_SCOPE_CHECK_RE = re.compile(r"""access\??\.has\(\s*['"]([^'"]+)['"]\s*\)""")
_DEPLOYMENT_VARS = {
    "isSelfHosted": "self_hosted",
    "isSelfHostedErrorsOnly": "self_hosted_errors_only",
}

# (file, breadcrumb prefix) for settings nav configs, which are data objects rather
# than JSX: sections carry a `name` header and items a `path` and `title`.
_SETTINGS_NAV_CONFIGS = (
    ("views/settings/organization/userOrgNavigationConfiguration.tsx", ["Settings"]),
    (
        "views/settings/project/navigationConfiguration.tsx",
        ["Settings", "Organization", "Projects", PROJECT_PLACEHOLDER],
    ),
)
# getsentry's settings sections live in static/gsApp, a separate tree from static/app; it
# appends them after the configs above (Usage & Billing).
_GSAPP_SETTINGS_NAV_CONFIGS = (("overrides/useBillingNavigationConfig.tsx", ["Settings"]),)
# Settings configs also declare path prefixes inside the builder function.
_LOCAL_STRING_CONST_RE = re.compile(r"""^\s*const (\w+) = ['"]([^'"]*)['"]""", re.MULTILINE)

_NEVER: Condition = {"any": []}


def _flag(name: str) -> Condition:
    return {"flag": name.removeprefix("organizations:")}


def _all_of(conds: list[Condition | None]) -> Condition | None:
    unique: dict[str, Condition] = {}
    for c in conds:
        for part in c["all"] if c is not None and "all" in c else [c]:
            if part is not None:
                unique.setdefault(json.dumps(part, sort_keys=True), part)
    parts = list(unique.values())
    if _NEVER in parts:
        return _NEVER
    return None if not parts else parts[0] if len(parts) == 1 else {"all": parts}


def _any_of(conds: list[Condition | None]) -> Condition | None:
    if any(c is None for c in conds):
        return None
    flat = [
        p for c in conds if c is not None for p in (c["any"] if "any" in c and c != _NEVER else [c])
    ]
    parts = [c for c in flat if c != _NEVER]
    return _NEVER if not parts else parts[0] if len(parts) == 1 else {"any": parts}


def _negate(cond: Condition | None) -> Condition | None:
    if cond is None:
        return _NEVER
    if cond == _NEVER:
        return None
    return {"unknown": f"!{cond['unknown']}"} if "unknown" in cond else {"not": cond}


# --- Minimal JS scanning: skip strings and comments, match brackets, split expressions.


def _skip_string(text: str, i: int) -> int:
    quote = text[i]
    i += 1
    while i < len(text):
        c = text[i]
        if c == "\\":
            i += 2
            continue
        if quote == "`" and text.startswith("${", i):
            i = _match_bracket(text, i + 1)
            continue
        if c == quote:
            return i + 1
        i += 1
    return i


def _match_bracket(text: str, i: int) -> int:
    """Index just past the bracket matching text[i], skipping strings and comments."""
    pairs = {"{": "}", "[": "]", "(": ")"}
    stack = [pairs[text[i]]]
    i += 1
    while i < len(text) and stack:
        c = text[i]
        if c in "'\"`":
            i = _skip_string(text, i)
            continue
        if text.startswith("//", i):
            i = text.find("\n", i) if text.find("\n", i) != -1 else len(text)
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i)
            i = len(text) if end == -1 else end + 2
            continue
        if c in pairs:
            stack.append(pairs[c])
        elif stack and c == stack[-1]:
            stack.pop()
        i += 1
    return i


def _strip_comments(text: str) -> str:
    """Blank out comments, keeping offsets and newlines, so commented-out JSX isn't parsed."""
    out: list[str] = []
    i = 0
    while i < len(text):
        c = text[i]
        if c in "'\"`":
            end = _skip_string(text, i)
            out.append(text[i:end])
            i = end
            continue
        if text.startswith("//", i):
            end = text.find("\n", i)
            end = len(text) if end == -1 else end
        elif text.startswith("/*", i):
            end = text.find("*/", i)
            end = len(text) if end == -1 else end + 2
        else:
            out.append(c)
            i += 1
            continue
        out.append(re.sub(r"[^\n]", " ", text[i:end]))
        i = end
    return "".join(out)


def _read_source(root: str, rel: str) -> str | None:
    path = Path(root, rel)
    return _strip_comments(path.read_text()) if path.is_file() else None


def _split_top_level(body: str, separator: str = ",") -> list[str]:
    """Split on `separator` wherever it is outside brackets and strings."""
    parts: list[str] = []
    start = i = 0
    while i < len(body):
        c = body[i]
        if c in "'\"`":
            i = _skip_string(body, i)
            continue
        if c in "{[(":
            i = _match_bracket(body, i)
            continue
        if body.startswith(separator, i):
            parts.append(body[start:i])
            i += len(separator)
            start = i
            continue
        i += 1
    parts.append(body[start:])
    return [p.strip() for p in parts if p.strip()]


def _expression_at(text: str, i: int) -> str:
    """The JS expression starting at text[i], up to its top-level `,` or closing bracket."""
    start = i
    while i < len(text):
        c = text[i]
        if c in "'\"`":
            i = _skip_string(text, i)
            continue
        if text.startswith("//", i):
            break
        if c in "{[(":
            i = _match_bracket(text, i)
            continue
        if c in ",}])":
            break
        i += 1
    return text[start:i].strip()


def _js_condition(expr: str) -> Condition | None:
    """Translate a frontend visibility expression into a snapshot condition."""
    expr = expr.strip()
    alternatives = _split_top_level(expr, "||")
    if len(alternatives) > 1:
        return _any_of([_js_condition(a) for a in alternatives])
    terms = _split_top_level(expr, "&&")
    if len(terms) > 1:
        return _all_of([_js_condition(t) for t in terms])
    if expr.startswith("(") and _match_bracket(expr, 0) == len(expr):
        return _js_condition(expr[1:-1])
    if expr.startswith("!!"):
        return _js_condition(expr[2:])
    if expr.startswith("!"):
        return _negate(_js_condition(expr[1:]))
    if expr in ("true", "organization"):
        return None
    if expr == "false":
        return _NEVER
    if expr in _DEPLOYMENT_VARS:
        return {"deployment": _DEPLOYMENT_VARS[expr]}
    if m := _FEATURE_CHECK_RE.fullmatch(expr):
        return _flag(m.group(1))
    if m := _SCOPE_CHECK_RE.fullmatch(expr):
        return {"scope": m.group(1)}
    if m := _ORG_ATTR_RE.fullmatch(expr):
        return {"org": m.group(1)}
    if expr in _KNOWN_ALIASES:
        return _js_condition(_KNOWN_ALIASES[expr])
    return {"unknown": expr}


def _imported_string_consts(frontend_dir: str, content: str) -> dict[str, str]:
    """Resolve string constants a file imports (e.g. a route sub-path) from their source."""
    consts: dict[str, str] = {}
    for names, module in _IMPORT_RE.findall(content):
        wanted = {n.strip() for n in names.split(",") if n.strip()}
        rel = module.removeprefix("sentry/")
        for ext in (".ts", ".tsx"):
            source = _read_source(frontend_dir, rel + ext)
            if source is not None:
                consts.update(
                    (name, value)
                    for name, value in _STRING_CONST_RE.findall(source)
                    if name in wanted
                )
                break
    return consts


def _org_relative_path(path: str) -> str | None:
    """Turn a frontend route path into the path under the org's customer domain."""
    path = path.replace("/organizations/${organization.slug}", "").replace("/:orgId", "")
    path = path.replace(":projectId", "{project_slug}")
    if "${" in path or re.search(r"/:\w", path):
        return None
    return path


def _secondary_nav_entries(frontend_dir: str) -> list[NavEntry]:
    entries: list[NavEntry] = []
    sections_root = os.path.join(frontend_dir, "views/navigation/secondary/sections")
    if not os.path.isdir(sections_root):
        return entries
    for section_dir in sorted(os.listdir(sections_root)):
        rel = f"views/navigation/secondary/sections/{section_dir}/{section_dir}SecondaryNavigation.tsx"
        content = _read_source(frontend_dir, rel)
        if content is None:
            continue
        header_match = _HEADER_RE.search(content)
        base_match = _BASE_URL_RE.search(content)
        if not header_match or not base_match:
            continue
        header = header_match.group(1)
        consts = {"baseUrl": base_match.group(1), **_imported_string_consts(frontend_dir, content)}
        flag_vars = {
            var: f"organization.features.includes('{flag}')"
            for var, flag in _FLAG_VAR_RE.findall(content)
        }

        feature_stack: list[Condition | None] = []
        # (start, end, condition) of each `{cond && (...)}` block and each branch of a
        # `{cond ? (...) : ...}`. Ends come from bracket matching, since a bare `)}` also ends
        # every `{t('...')}` label.
        cond_blocks: list[tuple[int, int, Condition | None]] = []
        section_stack: list[str | None] = []
        for m in _SECONDARY_NAV_TOKEN_RE.finditer(content):
            if m.group("feature") is not None:
                attr = _FEATURES_ATTR_RE.search(m.group("feature"))
                flags = _QUOTED_RE.findall(attr.group(1)) if attr else []
                feature_stack.append(_all_of([_flag(f) for f in flags]))
            elif m.group("feature_close") is not None:
                if feature_stack:
                    feature_stack.pop()
            elif m.group("cond") is not None:
                expr = m.group("cond").strip()
                for var, check in flag_vars.items():
                    expr = re.sub(rf"\b{var}\b", check, expr)
                cond = _js_condition(expr)
                then_end = _match_bracket(content, m.end() - 1)
                cond_blocks.append((m.start(), then_end, cond))
                if m.group("cond_op") == "?":
                    # The else branch runs from the first branch to the `}` closing the expression.
                    else_end = _match_bracket(content, m.start())
                    cond_blocks.append((then_end, else_end, _negate(cond)))
            elif m.group("section") is not None:
                title = _TITLE_ATTR_RE.search(m.group("section"))
                section_stack.append(title.group(1) if title else None)
            elif m.group("section_close") is not None:
                if section_stack:
                    section_stack.pop()
            elif m.group("link") is not None:
                body = m.group("link")
                to_match = _LINK_TO_RE.search(body)
                labels = _LINK_LABEL_RE.findall(body)
                if not to_match or not labels:
                    continue
                path = _TEMPLATE_REF_RE.sub(
                    lambda r: consts.get(r.group(1), r.group(0)),
                    to_match.group(1) or to_match.group(2),
                )
                org_path = _org_relative_path(path)
                if org_path is None:
                    continue
                crumbs = [header, *(s for s in section_stack if s), labels[-1]]
                entries.append(
                    NavEntry(
                        crumbs=CRUMB_SEPARATOR.join(crumbs),
                        path=org_path,
                        when=_all_of(
                            [
                                *feature_stack,
                                *(c for start, end, c in cond_blocks if start < m.start() < end),
                            ]
                        ),
                    )
                )
    return entries


def _issue_taxonomy_entries(frontend_dir: str) -> list[NavEntry]:
    """Issue type nav items are rendered from ISSUE_TAXONOMY_CONFIG, not literal JSX links."""
    content = _read_source(frontend_dir, "views/issueList/taxonomies.tsx")
    if content is None:
        return []
    entries: list[NavEntry] = []
    for body in _TAXONOMY_ENTRY_RE.findall(content):
        label = _TAXONOMY_LABEL_RE.search(body)
        key = _TAXONOMY_KEY_RE.search(body)
        if not label or not key:
            continue
        when = None
        flags_ref = _TAXONOMY_FLAGS_RE.search(body)
        if flags_ref:
            array = re.search(rf"const {flags_ref.group(1)}[^=]*= \[(.*?)\]", content, re.DOTALL)
            flags = _QUOTED_RE.findall(array.group(1)) if array else []
            # A taxonomy shows when any of its flags is on.
            when = _any_of([_flag(f) for f in flags]) if flags else None
        entries.append(
            NavEntry(
                crumbs=f"Issues{CRUMB_SEPARATOR}{label.group(1)}",
                path=f"/issues/{key.group(1)}/",
                when=when,
            )
        )
    return entries


def _settings_item_condition(segment: str) -> Condition | None:
    show = _SETTINGS_SHOW_RE.search(segment)
    if not show:
        return None
    expr = _ARROW_PARAMS_RE.sub("", _expression_at(segment, show.end()))
    return _js_condition(expr)


def _settings_nav_entries(frontend_dir: str, gsapp_dir: str | None = None) -> list[NavEntry]:
    entries: list[NavEntry] = []
    configs = [(frontend_dir, rel, prefix) for rel, prefix in _SETTINGS_NAV_CONFIGS]
    if gsapp_dir:
        configs += [(gsapp_dir, rel, prefix) for rel, prefix in _GSAPP_SETTINGS_NAV_CONFIGS]
    for root, rel, prefix in configs:
        content = _read_source(root, rel)
        if content is None:
            continue
        file_consts = dict(_STRING_CONST_RE.findall(content))
        for function_body in _SETTINGS_FUNCTION_SPLIT_RE.split(content)[1:]:
            consts = {**file_consts, **dict(_LOCAL_STRING_CONST_RE.findall(function_body))}
            names = [
                (m.start(), m.group(1)) for m in _SETTINGS_SECTION_NAME_RE.finditer(function_body)
            ]
            if not names:
                continue
            items = list(_SETTINGS_ITEM_RE.finditer(function_body))
            for i, item in enumerate(items):
                end = items[i + 1].start() if i + 1 < len(items) else len(function_body)
                segment = function_body[item.start() : end]
                # A title can depend on a flag (`settingsV3 ? t('General') : t('...')`);
                # emit one entry per label, each under its branch's condition.
                titles: list[tuple[str, Condition | None]]
                if ternary := _SETTINGS_TERNARY_TITLE_RE.search(segment):
                    branch = _js_condition(ternary.group(1))
                    titles = [(ternary.group(2), branch), (ternary.group(3), _negate(branch))]
                elif title := _SETTINGS_TITLE_RE.search(segment):
                    titles = [(title.group(1), None)]
                else:
                    continue
                when = _settings_item_condition(segment)
                if when == _NEVER:
                    continue
                # Items belong to the nearest section header before them; a section that
                # builds its items array first (Developer Settings) has its header after.
                before = [n for pos, n in names if pos < item.start()]
                section = before[-1] if before else names[0][1]
                path = _TEMPLATE_REF_RE.sub(
                    lambda r: consts.get(r.group(1), r.group(0)), item.group(1)
                )
                org_path = _org_relative_path(path)
                if org_path is None:
                    continue
                for label, label_when in titles:
                    entries.append(
                        NavEntry(
                            crumbs=CRUMB_SEPARATOR.join([*prefix, section, label]),
                            path=org_path,
                            when=_all_of([when, label_when]),
                        )
                    )
    return entries


# --- Sub-pages (create forms, detail tabs) aren't nav items, but every one has a route in
# router/routes.tsx, usually with a `name` label. Parse the route tree and emit each nav
# page's direct children.

_ROUTE_CONST_RE = re.compile(r"\bconst (\w+)(?:\s*:\s*[^=;]+?)?\s*=\s*(?=[\[{])")
# Route params the URL can be filled in for: (route param, URL placeholder, breadcrumb label).
_ROUTE_PARAMS = (
    (":projectId", "{project_slug}", PROJECT_PLACEHOLDER),
    (":teamId", "{team_slug}", TEAM_PLACEHOLDER),
)
_PARAM_PLACEHOLDER_LABELS = {placeholder: label for _, placeholder, label in _ROUTE_PARAMS}


def _parse_route_tree(content: str) -> list[tuple[str, str | None]]:
    """Return (full route path, route name) for every route reachable from an absolute path."""
    consts: dict[str, str] = {}
    for m in _ROUTE_CONST_RE.finditer(content):
        start = m.end()
        consts.setdefault(m.group(1), content[start : _match_bracket(content, start)])

    def entries(value: str, depth: int) -> list[str]:
        value = value.strip().removesuffix("!")
        if depth > 40:
            return []
        if value.startswith("["):
            out: list[str] = []
            for item in _split_top_level(value[1:-1]):
                out.extend(entries(item.removeprefix("..."), depth + 1))
            return out
        if value.startswith("{"):
            return [value]
        ref = value.split(".")[0]
        if ref in consts:
            target = consts[ref]
            if value.endswith(".children") and target.startswith("{"):
                children = _object_field(target, "children")
                return entries(children, depth + 1) if children else []
            return entries(target, depth + 1)
        return []

    results: list[tuple[str, str | None]] = []

    def walk(obj: str, prefix: str, depth: int) -> None:
        if depth > 40:
            return
        path = _object_string_field(obj, "path")
        # A computed path's URL is unknown; skip its subtree rather than guess a parent's URL.
        if _object_field(obj, "redirectTo") is not None or (
            path is None and _object_field(obj, "path") is not None
        ):
            return
        full = prefix
        if path is not None:
            full = path if path.startswith("/") else prefix.rstrip("/") + "/" + path
            name_value = _object_field(obj, "name")
            name = _LINK_LABEL_RE.search("{" + name_value + "}") if name_value else None
            results.append((full, name.group(1) if name else None))
        children = _object_field(obj, "children")
        if children:
            for child in entries(children, depth + 1):
                walk(child, full, depth + 1)

    for obj_text in consts.values():
        for obj in entries(obj_text, 0):
            if (_object_string_field(obj, "path") or "").startswith("/"):
                walk(obj, "", 0)
    return results


def _object_field(obj: str, key: str) -> str | None:
    for part in _split_top_level(obj.strip()[1:-1]):
        if part.startswith(f"{key}:"):
            return part[len(key) + 1 :].strip()
    return None


def _object_string_field(obj: str, key: str) -> str | None:
    value = _object_field(obj, key)
    if value and value[0] in "'\"`" and "${" not in value:
        return value[1:-1]
    return None


def _routes(frontend_dir: str) -> list[tuple[str, str | None]]:
    content = _read_source(frontend_dir, "router/routes.tsx")
    if content is None:
        return []
    # Feature route trees (e.g. detectorRoutes) live in their own `*/routes` modules.
    for _names, module in _IMPORT_RE.findall(content):
        if module.endswith("/routes"):
            rel = module.removeprefix("sentry/")
            for ext in (".tsx", ".ts"):
                extra = _read_source(frontend_dir, rel + ext)
                if extra is not None:
                    content += "\n" + extra
                    break
    return _parse_route_tree(content)


def _humanize_segment(segment: str) -> str:
    words = segment.replace("-", " ").split()
    if words and words[0] == "new":
        return "Create New" + ("".join(f" {w.capitalize()}" for w in words[1:]))
    return " ".join(w.capitalize() for w in words)


def _sub_page_entries(frontend_dir: str, pages: list[NavEntry]) -> list[NavEntry]:
    """Direct child routes of each nav page; they inherit the page's visibility."""
    entries: list[NavEntry] = []
    nav_paths = {p.path for p in pages}
    seen_paths: set[str] = set()
    routes = _routes(frontend_dir)
    for page in pages:
        # Other nav pages live under a section root (/settings/, /issues/), so its child
        # routes are mostly sibling or legacy pages; keep only its create forms.
        is_section_root = any(p != page.path and p.startswith(page.path) for p in nav_paths)
        for route_path, name in routes:
            rel = route_path.replace("/organizations/:orgId", "").replace("/:orgId", "")
            for param, placeholder, _ in _ROUTE_PARAMS:
                rel = rel.replace(param, placeholder)
            rel = rel if rel.endswith("/") else rel + "/"
            if not rel.startswith(page.path) or rel in nav_paths or rel in seen_paths:
                continue
            if is_section_root and not rel[len(page.path) :].startswith("new"):
                continue
            segments = rel[len(page.path) :].strip("/").split("/")
            extra_crumbs: list[str] = []
            url_segments: list[str] = []
            if len(segments) == 2 and segments[0] in _PARAM_PLACEHOLDER_LABELS:
                extra_crumbs.append(_PARAM_PLACEHOLDER_LABELS[segments[0]])
                url_segments.append(segments[0])
                segments = segments[1:]
            if len(segments) != 1 or segments[0].startswith((":", "{")):
                continue
            seen_paths.add(rel)
            url_segments.append(segments[0])
            leaf = name or _humanize_segment(segments[0])
            entries.append(
                NavEntry(
                    crumbs=CRUMB_SEPARATOR.join([page.crumbs, *extra_crumbs, leaf]),
                    path=page.path + "/".join(url_segments) + "/",
                    when=page.when,
                    sub_page=True,
                )
            )
    return entries


def _code_hash(source: str) -> str:
    return hashlib.sha256(" ".join(_strip_comments(source).split()).encode()).hexdigest()[:16]


def check_alias_sources(frontend_dir: str) -> None:
    """Fail if a file an alias in `_KNOWN_ALIASES` was copied from has changed or moved."""
    for rel, expected in _ALIAS_SOURCES.items():
        path = os.path.join(frontend_dir, rel)
        if not os.path.isfile(path) or _code_hash(Path(path).read_text()) != expected:
            raise SystemExit(
                f"{rel} changed or moved since its nav alias was written. Update the alias in "
                "_KNOWN_ALIASES to match it, then the hash in _ALIAS_SOURCES."
            )


def parse_nav_entries(frontend_dir: str, gsapp_dir: str | None = None) -> list[NavEntry]:
    """Every nav destination in the frontend source, with its visibility conditions.

    `gsapp_dir` is getsentry's `static/gsApp` tree, which adds SaaS-only settings pages.
    """
    pages = [
        *_secondary_nav_entries(frontend_dir),
        *_issue_taxonomy_entries(frontend_dir),
        *_settings_nav_entries(frontend_dir, gsapp_dir),
    ]
    seen: set[str] = set()
    unique: list[NavEntry] = []
    for entry in [*pages, *_sub_page_entries(frontend_dir, pages)]:
        key = json.dumps(entry.to_dict(), sort_keys=True)
        if key not in seen:
            seen.add(key)
            unique.append(entry)
    return unique
