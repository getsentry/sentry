from __future__ import annotations

import contextlib
import copy
import itertools
import re
from collections.abc import Callable, Iterator, Mapping, Sequence
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, cast

from django.core.exceptions import ImproperlyConfigured
from drf_spectacular.generators import SchemaGenerator
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.settings import spectacular_settings
from rest_framework.permissions import OperandHolder, SingleOperandHolder

from sentry.api.api_publish_status import ApiPublishStatus

# Registers the extensions that resolve inline response serializers, including the ones
# this build infers. `sentry.runner.settings` does too, but only under OPENAPIGENERATE.
from sentry.apidocs import extensions  # noqa: F401
from sentry.apidocs.hooks import (
    CustomEndpointEnumerator,
    custom_postprocessing_hook,
    custom_preprocessing_hook,
)
from sentry.apidocs.internal.schema import internal_schema_class
from sentry.apidocs.omission_guard import omissions_disabled
from sentry.apidocs.spectacular_ports import TypeHintPolicy, type_hint_policy

PUBLISH_STATUS_EXTENSION = "x-sentry-publish-status"
PATH_ALIASES_EXTENSION = "x-sentry-path-aliases"
# The class names in the view's `permission_classes`. Absent from `APPEND_PATHS`
# operations, which have no view to read them from.
PERMISSIONS_EXTENSION = "x-sentry-permissions"

INTERNAL_TYPE_HINTS = TypeHintPolicy(
    closed_typed_dicts=True,
    null_only_union_member=True,
    unresolvable_placeholder=True,
)

_TITLE = "Sentry Internal API"
_DESCRIPTION = (
    "Every endpoint method Sentry serves, published or not, for internal consumers such "
    "as frontend type generation. Never published: operations whose "
    f"`{PUBLISH_STATUS_EXTENSION}` is not public carry no compatibility guarantee."
)

# Literal alternations such as `(?:issues|groups)` or `(?:user-feedback|user-reports)`.
_ALTERNATION = re.compile(r"\(\?:([a-z-]+(?:\|[a-z-]+)+)\)")
_VARIABLE = re.compile(r"\{([^}]+)\}")


@dataclass(frozen=True)
class _Admitted:
    """What preprocessing reads off an admitted operation's view class."""

    status: ApiPublishStatus
    permissions: tuple[str, ...]


@dataclass
class _InternalBuild:
    # Each path spelled from a literal alternation, keyed by the spelling kept, listing
    # every path the route answers on (the kept one first).
    path_aliases: dict[str, list[str]] = field(default_factory=dict)
    # The same paths as the published build spells them, with `{var}` for an alternation.
    public_spellings: dict[str, str] = field(default_factory=dict)
    # Each admitted operation, keyed by (path, lowercased method).
    admitted: dict[tuple[str, str], _Admitted] = field(default_factory=dict)
    # The `APPEND_PATHS` setting, which postprocessing appends in drf-spectacular's place.
    append_paths: Mapping[str, Mapping[str, Any]] = field(default_factory=dict)


_current: ContextVar[_InternalBuild] = ContextVar("internal_build")


def _build() -> _InternalBuild:
    try:
        return _current.get()
    except LookupError:
        raise ImproperlyConfigured(
            "The internal OpenAPI build's hooks run only under InternalGenerator."
        ) from None


class InternalEndpointEnumerator(CustomEndpointEnumerator):
    """Spells each literal alternation in a route as its first branch, not `{var}`.

    Rendering them all as `{var}` collapses distinct routes onto one path, such as
    issue notes and issue user reports, and drf-spectacular keeps only one of them.
    The first branch is the one the published build already uses for issues.
    """

    def get_api_endpoints(self, patterns: Any = None, prefix: str = "") -> Any:
        build = _build()
        build.path_aliases.clear()
        build.public_spellings.clear()
        return cast("Callable[..., Any]", super().get_api_endpoints)(patterns, prefix)

    def get_path_from_regex(self, path_regex: str) -> str:
        public = super().get_path_from_regex(path_regex)
        choices = [match.group(1).split("|") for match in _ALTERNATION.finditer(path_regex)]
        if not choices:
            return public
        variants = [self._spelled(path_regex, branches) for branches in itertools.product(*choices)]
        build = _build()
        build.path_aliases[variants[0]] = variants
        build.public_spellings[variants[0]] = public
        return variants[0]

    def _spelled(self, path_regex: str, branches: Sequence[str]) -> str:
        chosen = iter(branches)
        return super().get_path_from_regex(_ALTERNATION.sub(lambda _: next(chosen), path_regex))


class InternalGenerator(SchemaGenerator):
    """Builds the internal spec. See `sentry.apidocs.internal`.

    Not a `CustomGenerator`, whose second build proves the published spec's omissions
    removed only what they declare. This build omits nothing, so there is nothing to
    prove.
    """

    endpoint_inspector_cls = InternalEndpointEnumerator

    def __init__(self, *args: object, **kwargs: object) -> None:
        cast("Callable[..., None]", super().__init__)(*args, **kwargs)

    def get_schema(self, request: Any = None, public: bool = False) -> dict[str, Any]:
        # Omissions keep fields out of the public reference and SDKs. This spec describes
        # what the backend sends, and with closed TypedDicts, an omitted field would be
        # one the spec says cannot exist.
        get_schema = cast("Callable[..., dict[str, Any]]", super().get_schema)
        with _internal_build(), omissions_disabled():
            return get_schema(request, public)

    def create_view(self, callback: Any, method: str, request: Any = None) -> Any:
        view = cast("Callable[..., Any]", super().create_view)(callback, method, request)
        schema = getattr(view, "schema", None)
        if isinstance(schema, AutoSchema):
            schema_class = internal_schema_class(type(schema))
            if schema_class is not type(schema):
                # Assigning through DRF's `ViewInspector` descriptor binds the new schema
                # to `view`, as drf-spectacular's own `create_view` relies on.
                view.schema = schema_class()
        return view


def internal_preprocessing_hook(endpoints: Any) -> Any:
    """The published build's preprocessing, admitting every method whatever its status."""
    build = _build()
    admitted = custom_preprocessing_hook(
        endpoints,
        admit=lambda status: True,
        public_path=lambda path: build.public_spellings.get(path, path),
    )
    build.admitted = {
        (path, method.lower()): _Admitted(
            status=callback.view_class.publish_status[method],
            permissions=_permission_class_names(callback.view_class),
        )
        for path, _path_regex, method, callback in admitted
    }
    return admitted


def _permission_class_names(view_class: type) -> tuple[str, ...]:
    names: set[str] = set()
    for permission in getattr(view_class, "permission_classes", ()):
        names |= _composed_names(permission)
    return tuple(sorted(names))


def _composed_names(permission: Any) -> set[str]:
    """The classes a `permission_classes` entry guards on.

    DRF composes permissions with `&`, `|` and `~` into holders rather than classes, and
    naming a holder would lose the classes it composes."""
    if isinstance(permission, OperandHolder):
        return _composed_names(permission.op1_class) | _composed_names(permission.op2_class)
    if isinstance(permission, SingleOperandHolder):
        return _composed_names(permission.op1_class)
    return {permission.__name__}


def internal_postprocessing_hook(result: Any, generator: Any, **kwargs: Any) -> Any:
    """Stamp what preprocessing read and each path's aliases, then postprocess as published."""
    build = _build()
    paths = result["paths"]
    # drf-spectacular appends `APPEND_PATHS` over whole path items, which drops the methods
    # a view serves beyond the hand-written ones. The hand-written ones still win.
    for path, operations in build.append_paths.items():
        paths.setdefault(path, {}).update(copy.deepcopy(operations))
    # Before the published build's postprocessing, which can rewrite path keys.
    for path, operations in paths.items():
        aliases = build.path_aliases.get(path)
        # Issue endpoints declare a `var` parameter for the published build's `{var}`
        # spelling of `(?:issues|groups)`, which it drops along with the `{var}`.
        spelled_out = _variables(build.public_spellings.get(path, path)) - _variables(path)
        for method, operation in operations.items():
            admitted = build.admitted.get((path, method))
            if admitted is not None:
                operation[PUBLISH_STATUS_EXTENSION] = admitted.status.value
                operation[PERMISSIONS_EXTENSION] = list(admitted.permissions)
            if aliases is not None:
                operation[PATH_ALIASES_EXTENSION] = list(aliases)
            if spelled_out and "parameters" in operation:
                operation["parameters"] = [
                    parameter
                    for parameter in operation["parameters"]
                    if not (parameter.get("in") == "path" and parameter.get("name") in spelled_out)
                ]
    return custom_postprocessing_hook(result, generator, in_reference=_in_reference, **kwargs)


def _variables(path: str) -> set[str]:
    return set(_VARIABLE.findall(path))


def _in_reference(operation: Mapping[str, Any]) -> bool:
    """Whether the published reference would carry the operation.

    `APPEND_PATHS` operations bypass enumeration and carry no status; they are public."""
    status = operation.get(PUBLISH_STATUS_EXTENSION)
    return status is None or ApiPublishStatus(status).is_published


@contextlib.contextmanager
def _internal_build() -> Iterator[None]:
    token = _current.set(_InternalBuild(append_paths=spectacular_settings.APPEND_PATHS))
    try:
        with (
            _spectacular_settings(
                TITLE=_TITLE,
                DESCRIPTION=_DESCRIPTION,
                APPEND_PATHS={},
                PREPROCESSING_HOOKS=_swapped(
                    spectacular_settings.PREPROCESSING_HOOKS,
                    custom_preprocessing_hook,
                    internal_preprocessing_hook,
                ),
                POSTPROCESSING_HOOKS=_swapped(
                    spectacular_settings.POSTPROCESSING_HOOKS,
                    custom_postprocessing_hook,
                    internal_postprocessing_hook,
                ),
            ),
            type_hint_policy(INTERNAL_TYPE_HINTS),
        ):
            yield
    finally:
        _current.reset(token)


def _swapped(
    hooks: Sequence[Callable[..., Any]],
    published: Callable[..., Any],
    internal: Callable[..., Any],
) -> list[Callable[..., Any]]:
    """`hooks`, with the published build's hook replaced by the internal one wrapping it.

    Settings without Sentry's hooks (tests) still get the internal one, first."""
    swapped = [internal if hook is published else hook for hook in hooks]
    return swapped if internal in swapped else [internal, *swapped]


@contextlib.contextmanager
def _spectacular_settings(**patches: Any) -> Iterator[None]:
    """Patch drf-spectacular's settings, then restore exactly what was there.

    Unlike `drf_spectacular.settings.patched_settings`, this nests inside it, which the
    `spectacular` command uses for `--custom-settings`."""
    original = {name: getattr(spectacular_settings, name) for name in patches}
    for name, value in patches.items():
        setattr(spectacular_settings, name, value)
    try:
        yield
    finally:
        for name, value in original.items():
            setattr(spectacular_settings, name, value)
