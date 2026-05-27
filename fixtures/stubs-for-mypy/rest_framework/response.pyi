from collections.abc import Mapping
from typing import Any, Generic, TypeVar, overload

from django.template.response import SimpleTemplateResponse

T = TypeVar("T", default=Any)

class Response(SimpleTemplateResponse, Generic[T]):
    data: T
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
