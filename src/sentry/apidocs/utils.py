from __future__ import annotations

import importlib
import os
import types
import typing
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

from drf_spectacular.plumbing import UnableToProceedError

from sentry.api.serializers import Serializer

# A response shape expressed as a type hint, as accepted by drf-spectacular's
# (untyped) ``resolve_type_hint``: a class/TypedDict or generic alias such as
# ``list[Foo]`` / ``dict[str, Foo]`` (all of which are ``type`` at the type level),
# or a PEP-604 union of those such as ``Foo | dict[str, Foo]`` (``types.UnionType``)
# for endpoints whose success response is one of several shapes. This is the most
# specific annotation possible — the type system has no name for "a wire-describable
# shape", so the real per-endpoint contract lives in the argument passed here and the
# OpenAPI schema it generates, not in this alias.
ResponseTypeHint: typing.TypeAlias = type | types.UnionType


class _RawSchema:
    """
    Basic class that simply stores a type that is parsed into Open API Schema.
    Used by `utils.inline_sentry_response_serializer`
    """

    def __init__(self, t: ResponseTypeHint) -> None:
        self.typeSchema = t


def inline_sentry_response_serializer(name: str, t: ResponseTypeHint) -> type:
    """
    Function for documenting an API response with python types.
    You may use existing types, and likely serializer response types.
    Be sure to pass the type, and not the serializer itself.

    .. code-block::

        @extend_schema(
            response=inline_sentry_response_serializer('ListMemberResponse',List[SCIMAPIMemberSerializerResponse])
        )

    :param name: the name of the component, used in the OpenAPIJson
    :param t: the response shape as a type hint (see ``ResponseTypeHint``): a
        class/TypedDict, a generic alias (``list[Foo]`` / ``dict[str, Foo]``), or
        a union (``Foo | dict[str, Foo]``).
    """

    if isinstance(t, Serializer):
        raise TypeError(
            "Please use the type of the `serialize` function instead of the serializer itself."
        )

    serializer_class = type(name, (_RawSchema,), {"typeSchema": t})
    return serializer_class


class SentryApiBuildError(UnableToProceedError):
    def __init__(self, msg: str = "", *args: Any, **kwargs: Any) -> None:
        super().__init__(
            msg
            + "\nSee https://develop.sentry.dev/api/public/#how-to-make-an-endpoint-public for more information.",
            *args,
            **kwargs,
        )


# TODO: extend schema wrapper method here?

# below inspired by https://stackoverflow.com/a/54766405


def reload_module_with_type_checking_enabled(module_name: str) -> None:
    @contextmanager
    def _patch_type_checking_const() -> Generator[None]:
        try:
            setattr(typing, "TYPE_CHECKING", True)
            yield
        finally:
            setattr(typing, "TYPE_CHECKING", False)

    if not os.environ.get("OPENAPIGENERATE", False):
        raise RuntimeError("This function can only be ran when generating API docs.")

    module = importlib.import_module(module_name)

    with _patch_type_checking_const():
        importlib.reload(module)
