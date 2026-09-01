from __future__ import annotations

import logging
from collections.abc import Collection, Iterable, Iterator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from django.conf import settings
from sentry_sdk import capture_message, new_scope

from sentry import options

logger = logging.getLogger(__name__)


@dataclass
class EndpointScopeDeclaration:
    endpoint: str
    method: str
    permission_classes: tuple[str, ...]
    permission_scopes: dict[str, frozenset[str]]
    declared_scopes: frozenset[str]
    effective_scopes: frozenset[str]
    reported_scopes: set[str] = field(default_factory=set)
    audit_enabled: bool | None = None


_endpoint_scope_declaration: ContextVar[EndpointScopeDeclaration | None] = ContextVar(
    "endpoint_scope_declaration", default=None
)


def _qualified_name(value: object) -> str:
    value_type = value if isinstance(value, type) else type(value)
    return f"{value_type.__module__}.{value_type.__qualname__}"


def _expand_scope_hierarchy(scopes: Iterable[str]) -> frozenset[str]:
    return frozenset(
        effective_scope
        for scope in scopes
        for effective_scope in settings.SENTRY_SCOPE_HIERARCHY_MAPPING.get(scope, (scope,))
    )


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
    permission_scopes: dict[str, frozenset[str]] = {}

    for permission_class in permission_classes:
        permission_class_name = _qualified_name(permission_class)
        permission_class_names.append(permission_class_name)
        scope_map: Any = getattr(permission_class, "scope_map", None)
        if isinstance(scope_map, Mapping):
            scopes = frozenset(scope_map.get(method, ()))
            permission_scopes[permission_class_name] = scopes
            declared_scopes.update(scopes)
        else:
            permission_scopes[permission_class_name] = frozenset()

    frozen_declared_scopes = frozenset(declared_scopes)
    token = _endpoint_scope_declaration.set(
        EndpointScopeDeclaration(
            endpoint=endpoint,
            method=method,
            permission_classes=tuple(permission_class_names),
            permission_scopes=permission_scopes,
            declared_scopes=frozen_declared_scopes,
            effective_scopes=_expand_scope_hierarchy(frozen_declared_scopes),
        )
    )
    try:
        yield
    finally:
        _endpoint_scope_declaration.reset(token)


def update_permission_scope_declaration(
    permission_class: object, scope_map: Mapping[str, Collection[str]]
) -> None:
    declaration = _endpoint_scope_declaration.get()
    if declaration is None:
        return

    permission_class_name = _qualified_name(permission_class)
    if permission_class_name not in declaration.permission_scopes:
        return

    declaration.permission_scopes[permission_class_name] = frozenset(
        scope_map.get(declaration.method, ())
    )
    declared_scopes = frozenset(
        scope
        for permission_scopes in declaration.permission_scopes.values()
        for scope in permission_scopes
    )
    declaration.declared_scopes = declared_scopes
    declaration.effective_scopes = _expand_scope_hierarchy(declared_scopes)


def check_scope_declaration(scope: str) -> None:
    declaration = _endpoint_scope_declaration.get()
    if declaration is None or scope in declaration.effective_scopes:
        return
    if scope in declaration.reported_scopes:
        return
    if declaration.audit_enabled is None:
        declaration.audit_enabled = options.get("api.permission-scope-audit.enabled")
    if not declaration.audit_enabled:
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
