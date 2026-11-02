"""Response shapes read from endpoint handlers' ``Response[T]`` return annotations.

Internal OpenAPI builds describe every endpoint method, including the ones that never
declared ``@extend_schema(responses=...)``. Many of those still state their response
shape in the handler signature, ``def get(...) -> Response[FooResponse]``, so internal
builds read it from there.

``Response[T]`` is erased at runtime (DRF's ``Response.__class_getitem__`` returns the
class itself), so the annotation is read from the handler's source and its type
argument evaluated in the handler's module.
"""

from __future__ import annotations

import ast
import collections.abc
import inspect
import types
import typing
from collections import defaultdict
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, Union, is_typeddict

from drf_spectacular.drainage import warn

from sentry.apidocs.utils import inline_sentry_response_serializer, registered_inline_serializer

# Marks a response whose shape the backend does not declare anywhere. Generated
# frontend types render it as `unknown`.
UNDOCUMENTED_EXTENSION = "x-sentry-undocumented"

_RESPONSE_NAMES = frozenset({"Response"})


@dataclass(frozen=True)
class AnnotatedResponse:
    """The success shapes a handler's return annotation declares."""

    # The type arguments of every success `Response[T]` member, in declaration order.
    # Empty when the only success member is `Response[None]`.
    types: tuple[Any, ...]


def _is_error_arm(node: ast.expr) -> bool:
    """Whether a `Response[...]` type argument names an error body.

    Error arms are told apart by name: `ValidationErrorResponse` is an alias of
    `dict[str, Any]`, so once evaluated it is indistinguishable from a loose
    success shape.
    """
    name = ast.unparse(node)
    return name == "DetailResponse" or name.endswith("ErrorResponse")


def _union_members(node: ast.expr) -> list[ast.expr]:
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
        return _union_members(node.left) + _union_members(node.right)
    return [node]


def _response_argument(node: ast.expr) -> ast.expr | None:
    """The `T` in `Response[T]`, or None for anything else (bare `Response`, ...)."""
    if not isinstance(node, ast.Subscript):
        return None
    value = node.value
    name = value.attr if isinstance(value, ast.Attribute) else getattr(value, "id", None)
    if name not in _RESPONSE_NAMES:
        return None
    return node.slice


def _return_annotation(func: Callable[..., Any]) -> ast.expr | None:
    try:
        source = inspect.getsource(func)
    except (OSError, TypeError):
        return None
    if source[:1].isspace():
        # A method. Dedenting fails on a body holding a string literal that is
        # indented less than the method, so nest the source in a block instead.
        source = "if True:\n" + source
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return node.returns
    return None


def annotated_response(func: Callable[..., Any], context: str) -> AnnotatedResponse | None:
    """The success shapes `func` declares through `Response[T]`, if it declares any.

    Error arms (`Response[DetailResponse]`, `Response[ValidationErrorResponse]`) and
    untyped members (a bare `Response`, `HttpResponse`) are ignored. A type argument
    that cannot be evaluated, such as one imported only under `TYPE_CHECKING`, makes
    the whole annotation unusable, since what remains would understate the response.
    """
    func = inspect.unwrap(func)
    returns = _return_annotation(func)
    if returns is None:
        return None

    arguments = [_response_argument(member) for member in _union_members(returns)]
    success = [node for node in arguments if node is not None and not _is_error_arm(node)]
    if not success:
        return None

    namespace = dict(getattr(func, "__globals__", {}))
    found: list[Any] = []
    for node in success:
        expression = ast.unparse(node)
        try:
            evaluated = eval(expression, namespace)  # noqa: S307 -- our own annotations
        except Exception as exc:
            warn(f"could not evaluate Response[{expression}] for {context}: {exc!r}")
            return None
        if evaluated is not None and evaluated not in found:
            found.append(evaluated)
    return AnnotatedResponse(types=tuple(found))


def response_type(hints: Sequence[Any]) -> Any:
    """A single type hint for the success shapes, as `resolve_type_hint` accepts."""
    if len(hints) == 1:
        return hints[0]
    return Union[tuple(hints)]  # noqa: UP007 -- built from a runtime sequence


_SEQUENCE_ORIGINS = (
    list,
    set,
    frozenset,
    tuple,
    collections.abc.Collection,
    collections.abc.Iterable,
    collections.abc.MutableSequence,
    collections.abc.Sequence,
)
_MAPPING_ORIGINS = (dict, defaultdict, collections.abc.Mapping, collections.abc.MutableMapping)


def _type_name(hint: Any) -> str:
    """A component name for `hint`: `FooResponse`, `ListFooResponse`, `FooOrBar`, ..."""
    origin = typing.get_origin(hint)
    args = typing.get_args(hint)
    if origin is Union or origin is types.UnionType:
        return "Or".join(_type_name(arg) for arg in args if arg is not type(None))
    if origin in _SEQUENCE_ORIGINS:
        return "List" + (_type_name(args[0]) if args else "Any")
    if origin in _MAPPING_ORIGINS:
        return "Dict" + (_type_name(args[1]) if len(args) == 2 else "Any")
    name = getattr(hint, "__name__", None)
    if hint is Any or not isinstance(name, str):
        return "Any"
    name = name.lstrip("_")
    return name[:1].upper() + name[1:]


def inferred_response_serializer(hint: Any) -> type:
    """The inline response serializer describing `hint`, named after it.

    An `@extend_schema` declaration that already describes the same hint under the
    same name is reused, so both describe one component. A different hint that
    happens to share the name gets a distinct one rather than overwriting it.
    """
    base = _type_name(hint)
    if not is_typeddict(hint) and not base.endswith("Response"):
        base = f"{base}Response"
    name = base
    for suffix in range(2, 100):
        existing = registered_inline_serializer(name)
        if existing is None:
            return inline_sentry_response_serializer(name, hint)
        if existing.typeSchema == hint:
            return existing
        name = f"{base}{suffix}"
    raise RuntimeError(f"too many response components named {base}")
