from collections.abc import Mapping
from typing import Any, Generic, TypeVar, overload

from django.template.response import SimpleTemplateResponse

T = TypeVar("T", default=Any)

class Response(SimpleTemplateResponse, Generic[T]):
    # `data` is typed as Any to mirror DRF's runtime behavior, where the
    # attribute is freely reassigned by middleware and exception handlers.
    # The TypedDict check still fires at the __init__ call site via the
    # `data: T` parameter overload below — that's where the static guarantee
    # lives. Typing the attribute as T strictly would break legitimate
    # reassignment patterns (e.g. `response.data = ...` in auth flows).
    data: Any
    exception: bool
    content_type: str | None

    @overload
    def __init__(
        self,
        *,
        status: int | None = ...,
        template_name: str | None = ...,
        headers: Mapping[str, str] | None = ...,
        exception: bool = ...,
        content_type: str | None = ...,
    ) -> None: ...
    @overload
    def __init__(
        self,
        data: T,
        status: int | None = ...,
        template_name: str | None = ...,
        headers: Mapping[str, str] | None = ...,
        exception: bool = ...,
        content_type: str | None = ...,
    ) -> None: ...
