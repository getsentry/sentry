#!/usr/bin/env python3
# flake8: noqa: S002
"""
Report which API routes the frontend calls and whether each one declares a
response contract on the backend.

The frontend side is a heuristic scan of ``static/`` for API route literals that
sit next to an API helper (``apiOptions``, ``useApiQuery``, ``getApiUrl``, ...).
The backend side walks the Django URL patterns to the endpoint class and inspects
each HTTP method for an ``@extend_schema`` override or a ``Response[T]`` return
annotation.

Usage:
    python3 -m tools.api_contract_report             # markdown table, all rows
    python3 -m tools.api_contract_report --missing   # only rows without a contract
    python3 -m tools.api_contract_report --json      # machine readable
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import typing
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from typing import Any

from django.urls import URLPattern, URLResolver

from tools.api_urls_to_typescript import EXCLUDED_ROUTE_PREFIXES, regexp_to_routes

FRONTEND_ROOTS = ("static/app", "static/gsApp", "static/gsAdmin")
FRONTEND_EXTENSIONS = (".ts", ".tsx")
FRONTEND_EXCLUDED_PARTS = (".spec.", ".stories.", ".snapshots.", "/__mocks__/", "/__fixtures__/")

# A route literal only counts as an API call when one of these appears on the
# same line or the few lines above it. Router links use the same shapes as API
# routes, so a bare literal is ambiguous.
API_CALL_MARKERS = (
    "apiOptions",
    "useApiQuery",
    "useInfiniteApiQuery",
    "useApiQueries",
    "fetchDataQuery",
    "fetchMutation",
    "getApiUrl",
    "requestPromise",
    "api.request",
    "queryKey",
    "ApiQueryKey",
    "makeQueryKey",
    "endpoint",
    "url:",
    "url =",
)
API_CALL_WINDOW = 3

ROUTE_LITERAL = re.compile(r"""(?P<quote>['`"])(?P<route>/[^'`"\n]*?/)(?P=quote)""")
TEMPLATE_EXPRESSION = re.compile(r"\$\{[^}]*\}")
ROUTE_PARAM = re.compile(r"\$[A-Za-z0-9_]+")
QUERY_STRING = re.compile(r"\?.*$")

HTTP_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE")

# Return annotations that declare a Response but say nothing about its shape.
LOOSE_RESPONSE_TYPES = frozenset({"Any", "dict[str, Any]", "list[Any]", "object", "dict", "list"})


@dataclass
class ContractRow:
    route: str
    method: str
    endpoint: str
    owner: str
    publish_status: str
    contract: str
    detail: str
    call_sites: list[str] = field(default_factory=list)

    @property
    def has_contract(self) -> bool:
        return self.contract in ("extend_schema", "annotation", "extend_schema+annotation")


def canonical_route(route: str) -> str:
    """
    Reduce a route literal to a comparable shape: every path parameter, whether
    written as ``$param`` (known API urls) or ``${expr}`` (template literals),
    becomes ``*`` and any query string is dropped.

    >>> canonical_route("/organizations/${org.slug}/projects/")
    '/organizations/*/projects/'
    >>> canonical_route("/organizations/$organizationIdOrSlug/events/$projectIdOrSlug:$eventId/")
    '/organizations/*/events/*:*/'
    """
    route = QUERY_STRING.sub("", route)
    route = TEMPLATE_EXPRESSION.sub("*", route)
    route = ROUTE_PARAM.sub("*", route)
    return route


def _is_api_call_context(lines: list[str], index: int) -> bool:
    window = lines[max(0, index - API_CALL_WINDOW) : index + 1]
    return any(marker in line for line in window for marker in API_CALL_MARKERS)


def collect_frontend_routes(root: str) -> dict[str, list[str]]:
    """
    Map each canonical route literal found next to an API helper to the
    ``path:line`` locations it appears at.
    """
    routes: dict[str, list[str]] = defaultdict(list)
    for frontend_root in FRONTEND_ROOTS:
        base = os.path.join(root, frontend_root)
        for dirpath, _dirnames, filenames in os.walk(base):
            for filename in filenames:
                if not filename.endswith(FRONTEND_EXTENSIONS):
                    continue
                path = os.path.join(dirpath, filename)
                relative = os.path.relpath(path, root)
                if any(part in f"/{relative}" for part in FRONTEND_EXCLUDED_PARTS):
                    continue
                with open(path, encoding="utf-8") as f:
                    lines = f.read().split("\n")
                for index, line in enumerate(lines):
                    for match in ROUTE_LITERAL.finditer(line):
                        route = match.group("route")
                        if route.startswith("//") or "/api/0/" in route:
                            continue
                        if not _is_api_call_context(lines, index):
                            continue
                        routes[canonical_route(route)].append(f"{relative}:{index + 1}")
    return dict(routes)


def urls_to_route_views(prefix: str, urlpatterns: list[Any]) -> list[tuple[str, Any]]:
    """Like ``api_urls_to_typescript.urls_to_routes`` but keeps the endpoint class."""
    routes: list[tuple[str, Any]] = []
    for urlpattern in urlpatterns:
        if isinstance(urlpattern, URLResolver):
            for child in regexp_to_routes(urlpattern.pattern.regex.pattern):
                routes += urls_to_route_views(prefix + child, urlpattern.url_patterns)
        elif isinstance(urlpattern, URLPattern):
            view_class = getattr(urlpattern.callback, "view_class", None)
            if view_class is None:
                continue
            for variant in regexp_to_routes(urlpattern.pattern.regex.pattern):
                routes.append((prefix + variant, view_class))
        else:
            raise ValueError(f"Unknown pattern type: {type(urlpattern)}")
    return routes


def classify_return_annotation(annotation: Any) -> tuple[str, str]:
    """
    Classify a handler's return annotation.

    Returns ``(kind, detail)`` where ``kind`` is ``"typed"`` for ``Response[T]``
    with a real ``T``, ``"loose"`` for ``Response[Any]``-like escape hatches, and
    ``"none"`` for a bare ``Response`` or no annotation. ``detail`` is the ``T``
    text, if any.

    >>> classify_return_annotation("Response[ProjectSerializerResponse]")
    ('typed', 'ProjectSerializerResponse')
    >>> classify_return_annotation("Response[dict[str, Any]]")
    ('loose', 'dict[str, Any]')
    >>> classify_return_annotation("Response")
    ('none', '')
    """
    if annotation is None:
        return "none", ""
    if isinstance(annotation, str):
        text = annotation.strip()
    else:
        origin = typing.get_origin(annotation)
        args = typing.get_args(annotation)
        if origin is not None and args:
            text = f"{origin.__name__}[{', '.join(_hint_text(a) for a in args)}]"
        else:
            text = _hint_text(annotation)
    inners: list[str] = []
    for part in _split_top_level_union(text):
        match = re.fullmatch(r"Response\[(.+)\]", part)
        if match is None:
            return "none", ""
        inners.append(match.group(1).strip())
    inner = " | ".join(inners)
    if all(i in LOOSE_RESPONSE_TYPES for i in inners):
        return "loose", inner
    return "typed", inner


def _split_top_level_union(text: str) -> list[str]:
    """Split ``A[x | y] | B`` on the pipes outside brackets: ``["A[x | y]", "B"]``."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for char in text:
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
        if char == "|" and depth == 0:
            parts.append("".join(current).strip())
            current = []
            continue
        current.append(char)
    parts.append("".join(current).strip())
    return [part for part in parts if part]


def _hint_text(hint: Any) -> str:
    if isinstance(hint, str):
        return hint
    if hint is type(None):
        return "None"
    if hasattr(hint, "__name__") and typing.get_origin(hint) is None:
        return hint.__name__
    return repr(hint).replace("typing.", "")


def _declares_extend_schema(view_class: type, method: str) -> bool:
    handler = getattr(view_class, method.lower(), None)
    if handler is not None and "schema" in getattr(handler, "kwargs", {}):
        return True
    return any(
        "schema" in vars(cls)
        for cls in view_class.__mro__
        if cls.__module__.startswith(("sentry", "getsentry"))
    )


def describe_method(view_class: type, method: str) -> tuple[str, str]:
    """``(contract, detail)`` for one HTTP method of an endpoint class."""
    handler = getattr(view_class, method.lower(), None)
    annotation = None
    if handler is not None:
        annotation = getattr(handler, "__annotations__", {}).get("return")
    kind, detail = classify_return_annotation(annotation)
    has_schema = _declares_extend_schema(view_class, method)

    if has_schema and kind == "typed":
        return "extend_schema+annotation", detail
    if has_schema:
        return "extend_schema", detail
    if kind == "typed":
        return "annotation", detail
    if kind == "loose":
        return "loose", detail
    return "none", ""


def build_rows(
    route_views: list[tuple[str, Any]], frontend_routes: dict[str, list[str]]
) -> list[ContractRow]:
    rows: list[ContractRow] = []
    seen: set[tuple[str, str]] = set()
    for route, view_class in route_views:
        if route.startswith(EXCLUDED_ROUTE_PREFIXES):
            continue
        call_sites = frontend_routes.get(canonical_route(route))
        if not call_sites:
            continue
        publish_status = getattr(view_class, "publish_status", {}) or {}
        owner = getattr(view_class, "owner", None)
        for method in HTTP_METHODS:
            if method not in publish_status:
                continue
            key = (route, method)
            if key in seen:
                continue
            seen.add(key)
            contract, detail = describe_method(view_class, method)
            rows.append(
                ContractRow(
                    route=route,
                    method=method,
                    endpoint=view_class.__name__,
                    owner=getattr(owner, "value", str(owner)),
                    publish_status=publish_status[method].value,
                    contract=contract,
                    detail=detail,
                    call_sites=sorted(set(call_sites)),
                )
            )
    rows.sort(key=lambda r: (-len(r.call_sites), r.route, r.method))
    return rows


def render_markdown(rows: list[ContractRow]) -> str:
    lines = [
        "| Route | Method | Endpoint | Owner | Status | Contract | Call sites |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for row in rows:
        contract = row.contract if not row.detail else f"{row.contract} (`{row.detail}`)"
        lines.append(
            f"| `{row.route}` | {row.method} | {row.endpoint} | {row.owner} | "
            f"{row.publish_status} | {contract} | {len(row.call_sites)} |"
        )
    total = len(rows)
    covered = sum(1 for r in rows if r.has_contract)
    lines.append("")
    lines.append(f"{covered}/{total} frontend-called endpoint methods declare a response contract.")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="emit JSON instead of markdown")
    parser.add_argument(
        "--missing", action="store_true", help="only list methods without a response contract"
    )
    parser.add_argument("--root", default=".", help="repository root (default: cwd)")
    args = parser.parse_args(argv)

    from sentry.runner import configure

    configure()

    from sentry.api.urls import urlpatterns

    frontend_routes = collect_frontend_routes(args.root)
    rows = build_rows(urls_to_route_views("/", urlpatterns), frontend_routes)
    if args.missing:
        rows = [row for row in rows if not row.has_contract]

    if args.json:
        json.dump([asdict(row) for row in rows], sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        sys.stdout.write(render_markdown(rows) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
