from __future__ import annotations

import importlib
import os
import typing
from contextlib import contextmanager
from typing import Any, Generator

from drf_spectacular.plumbing import UnableToProceedError

from sentry.api.serializers import Serializer


class _RawSchema:
    """
    Basic class that simply stores a type that is parsed into Open API Schema.
    Used by `utils.inline_sentry_response_serializer`
    """

    def __init__(self, t: type) -> None:
        self.typeSchema = t


def inline_sentry_response_serializer(name: str, t: type) -> type:
    """
    Function for documenting an API response with python types.
    You may use existing types, and likely serializer response types.
    Be sure to pass the type, and not the serializer itself.

    .. code-block::

        @extend_schema(
            response=inline_sentry_response_serializer('ListMemberResponse',List[SCIMAPIMemberSerializerResponse])
        )

    :param name: the name of the component, used in the OpenAPIJson
    :param t: the type of the response
    """

    if isinstance(t, Serializer):
        raise TypeError(
            "Please use the type of the `serialize` function instead of the serializer itself."
        )

    serializer_class = type(name, (_RawSchema,), {"typeSchema": t})
    return serializer_class


class SentryApiBuildError(UnableToProceedError):  # type: ignore
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
    def _patch_type_checking_const() -> Generator[None, None, None]:
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
