#!/usr/bin/env python3
"""Audit script for `type-seer-rpc-coverage`.

Walks the three Seer RPC registries and classifies each registered function's
return annotation as `typed` (subclass of `pydantic.BaseModel`, `None`, or a
union of those) or `untyped` (anything else — `dict`, `dict[str, Any]`, `Any`,
`list[T]`, `dict[str, T]`, etc.).

Outputs JSON to stdout (default) or a markdown summary table (`--format md`).
Exits cleanly regardless of bucket counts; this is a measurement tool, not a
gate.

Usage:
    .venv/bin/python -m tools.seer_rpc.audit_rpc_coverage
    .venv/bin/python -m tools.seer_rpc.audit_rpc_coverage --format md
"""

from __future__ import annotations

import argparse
import inspect
import json
import typing
from collections.abc import Callable
from dataclasses import asdict, dataclass
from types import UnionType


@dataclass(frozen=True)
class MethodAudit:
    method_name: str
    registries: tuple[str, ...]
    function_module_and_name: str
    return_annotation_repr: str
    classification: str  # "typed" | "untyped"


def _unwrap_to_function(fn: Callable) -> Callable:
    """Peel back closure-style wrappers like `map_org_id_param` and
    `accept_organization_id_param`, which do not use `functools.wraps` so
    `inspect.unwrap` cannot follow them. Each such wrapper closes over a
    `func` nonlocal pointing at the underlying registered function.
    """
    seen: set[int] = set()
    current = fn
    while id(current) not in seen:
        seen.add(id(current))
        try:
            nonlocals = inspect.getclosurevars(current).nonlocals
        except TypeError:
            return current
        inner = nonlocals.get("func")
        if inner is None or not callable(inner):
            return current
        current = inner
    return current


def _is_basemodel_subclass(t: object) -> bool:
    from pydantic import BaseModel

    return isinstance(t, type) and issubclass(t, BaseModel)


def _classify_return_type(ret: object) -> str:
    """Return "typed" if `ret` is `BaseModel` subclass, `NoneType`, or a
    union of those. Return "untyped" for anything else.
    """
    if ret is type(None):
        return "typed"
    if _is_basemodel_subclass(ret):
        return "typed"

    origin = typing.get_origin(ret)
    if origin is typing.Union or origin is UnionType:
        args = typing.get_args(ret)
        if all(arg is type(None) or _is_basemodel_subclass(arg) for arg in args):
            return "typed"
    return "untyped"


def _resolve_return_annotation(fn: Callable) -> object:
    """Get the function's resolved return annotation. Returns the special
    sentinel `_MISSING` if no annotation, or `_UNRESOLVABLE` if resolution
    fails.
    """
    try:
        hints = typing.get_type_hints(fn)
    except Exception:
        return _UNRESOLVABLE
    return hints.get("return", _MISSING)


class _Sentinel:
    def __init__(self, name: str) -> None:
        self._name = name

    def __repr__(self) -> str:
        return self._name


_MISSING = _Sentinel("<no return annotation>")
_UNRESOLVABLE = _Sentinel("<unresolvable>")


def audit_registry(name: str, registry: dict[str, Callable]) -> list[MethodAudit]:
    audits: list[MethodAudit] = []
    for method_name, fn in registry.items():
        underlying = _unwrap_to_function(fn)
        ret = _resolve_return_annotation(underlying)
        if ret is _MISSING or ret is _UNRESOLVABLE:
            classification = "untyped"
            ret_repr = repr(ret)
        else:
            classification = _classify_return_type(ret)
            ret_repr = _format_type(ret)
        audits.append(
            MethodAudit(
                method_name=method_name,
                registries=(name,),
                function_module_and_name=f"{underlying.__module__}.{underlying.__qualname__}",
                return_annotation_repr=ret_repr,
                classification=classification,
            )
        )
    return audits


def _format_type(t: object) -> str:
    """Pretty-print a type annotation for human-readable output."""
    if t is type(None):
        return "None"
    if isinstance(t, type):
        return t.__qualname__
    origin = typing.get_origin(t)
    if origin is typing.Union or origin is UnionType:
        args = typing.get_args(t)
        return " | ".join(_format_type(a) for a in args)
    return repr(t)


def merge_by_method_name(audit_lists: list[list[MethodAudit]]) -> list[MethodAudit]:
    """Combine audits across registries: methods registered in multiple
    registries collapse into one row with a `registries` tuple containing
    each registry name. Classification is based on the underlying function,
    which should be identical across registries pointing at the same target.
    """
    merged: dict[str, MethodAudit] = {}
    for audit_list in audit_lists:
        for audit in audit_list:
            existing = merged.get(audit.method_name)
            if existing is None:
                merged[audit.method_name] = audit
                continue
            combined_registries = tuple(sorted(set(existing.registries + audit.registries)))
            merged[audit.method_name] = MethodAudit(
                method_name=audit.method_name,
                registries=combined_registries,
                function_module_and_name=audit.function_module_and_name,
                return_annotation_repr=audit.return_annotation_repr,
                classification=audit.classification,
            )
    return sorted(merged.values(), key=lambda a: a.method_name)


def collect_all_audits() -> list[MethodAudit]:
    from sentry.seer.endpoints.organization_seer_rpc import (
        public_org_seer_method_registry,
        public_project_seer_method_registry,
    )
    from sentry.seer.endpoints.seer_rpc import seer_method_registry

    return merge_by_method_name(
        [
            audit_registry("internal", seer_method_registry),
            audit_registry("public_org", public_org_seer_method_registry),
            audit_registry("public_project", public_project_seer_method_registry),
        ]
    )


def emit_json(audits: list[MethodAudit]) -> str:
    typed = sum(1 for a in audits if a.classification == "typed")
    untyped = sum(1 for a in audits if a.classification == "untyped")
    payload = {
        "summary": {
            "total": len(audits),
            "typed": typed,
            "untyped": untyped,
        },
        "methods": [asdict(a) for a in audits],
    }
    return json.dumps(payload, indent=2)


def emit_markdown(audits: list[MethodAudit]) -> str:
    typed = sum(1 for a in audits if a.classification == "typed")
    untyped = sum(1 for a in audits if a.classification == "untyped")
    lines = [
        f"# Seer RPC typing coverage ({typed}/{len(audits)} typed, {untyped} untyped)",
        "",
        "| Method | Registries | Return annotation | Class |",
        "|---|---|---|---|",
    ]
    for a in audits:
        registries = ",".join(a.registries)
        ret = a.return_annotation_repr.replace("|", "\\|")
        lines.append(f"| `{a.method_name}` | {registries} | `{ret}` | {a.classification} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--format",
        choices=("json", "md"),
        default="json",
        help="Output format (default: json)",
    )
    args = parser.parse_args()

    from sentry.runner import configure

    configure()

    audits = collect_all_audits()

    if args.format == "json":
        print(emit_json(audits))
    else:
        print(emit_markdown(audits))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
