from __future__ import annotations

import logging
from collections.abc import Collection, Iterable, Iterator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from sentry_sdk import capture_message, new_scope

logger = logging.getLogger(__name__)


@dataclass
class EndpointScopeDeclaration:
    endpoint: str
    method: str
    permission_classes: tuple[str, ...]
    declared_scopes: frozenset[str]
    reported_scopes: set[str] = field(default_factory=set)


_endpoint_scope_declaration: ContextVar[EndpointScopeDeclaration | None] = ContextVar(
    "endpoint_scope_declaration", default=None
)


def _qualified_name(value: object) -> str:
    value_type = value if isinstance(value, type) else type(value)
    return f"{value_type.__module__}.{value_type.__qualname__}"


@contextmanager
def bind_endpoint_scope_declaration(
    *, endpoint: str, method: str, permission_classes: Iterable[object]
) -> Iterator[None]:
    """Bind the permission declarations used for observational scope auditing.

    The audit unions declarations from every permission class, but each ``scope_map``
    remains an any-of token admission list. Adding a scope to resolve a warning can
    therefore broaden endpoint access and requires a separate authorization review.
    """
    method = method.upper()
    declared_scopes: set[str] = set()
    permission_class_names: list[str] = []

    for permission_class in permission_classes:
        permission_class_names.append(_qualified_name(permission_class))
        scope_map: Any = getattr(permission_class, "scope_map", None)
        if isinstance(scope_map, Mapping):
            declared_scopes.update(scope_map.get(method, ()))

    token = _endpoint_scope_declaration.set(
        EndpointScopeDeclaration(
            endpoint=endpoint,
            method=method,
            permission_classes=tuple(permission_class_names),
            declared_scopes=frozenset(declared_scopes),
        )
    )
    try:
        yield
    finally:
        _endpoint_scope_declaration.reset(token)


def check_scope_declaration(scope: str) -> None:
    declaration = _endpoint_scope_declaration.get()
    if declaration is None or scope in declaration.declared_scopes:
        return
    if scope in declaration.reported_scopes:
        return

    declaration.reported_scopes.add(scope)
    event_context = {
        "endpoint": declaration.endpoint,
        "method": declaration.method,
        "scope": scope,
        "declared_scopes": sorted(declaration.declared_scopes),
        "permission_classes": declaration.permission_classes,
    }
    logger.warning(
        "api.permission_scope.undeclared",
        extra=event_context,
    )
    with new_scope() as event_scope:
        event_scope.fingerprint = [
            "api.permission_scope.undeclared",
            declaration.endpoint,
            declaration.method,
            scope,
        ]
        event_scope.set_context("permission_scope", event_context)
        capture_message("api.permission_scope.undeclared", level="warning")


def check_scope_declarations(scopes: Collection[str]) -> None:
    if isinstance(scopes, str):
        check_scope_declaration(scopes)
        return
    for scope in scopes:
        check_scope_declaration(scope)
