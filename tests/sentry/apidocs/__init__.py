from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import TYPE_CHECKING, Any, cast

from drf_spectacular.validation import validate_schema

if TYPE_CHECKING:
    from django.http import HttpResponse
    from django.urls import URLPattern, URLResolver
    from rest_framework.views import APIView
    from rest_framework.viewsets import ViewSetMixin


def generate_schema(
    route: str | None,
    viewset: type[ViewSetMixin] | None = None,
    view: type[APIView] | None = None,
    view_function: Callable[..., HttpResponse] | None = None,
    patterns: Sequence[URLPattern | URLResolver] | None = None,
) -> dict[str, Any]:
    """
    Taken from drf-spectacular tests
    https://github.com/tfranzel/drf-spectacular/blob/590a2f7f053fbe83446aa453cb4d4a3025410609/tests/__init__.py#L64
    """
    from django.urls import path
    from drf_spectacular.generators import SchemaGenerator
    from rest_framework import routers
    from rest_framework.viewsets import ViewSetMixin

    if viewset:
        assert route is not None
        assert issubclass(viewset, ViewSetMixin)
        router = routers.SimpleRouter()
        router.register(route, viewset, basename=route)
        patterns = router.urls
    elif view:
        assert route is not None
        patterns = [path(route, view.as_view())]
    elif view_function:
        assert route is not None
        patterns = [path(route, view_function)]
    else:
        assert route is None and isinstance(patterns, list)

    assert patterns is not None
    generator_cls = cast("Callable[..., SchemaGenerator]", SchemaGenerator)
    generator = generator_cls(patterns=patterns)
    get_schema = cast("Callable[..., dict[str, Any]]", generator.get_schema)
    schema = get_schema(request=None, public=True)
    assert schema is not None
    validate = cast("Callable[[dict[str, Any]], None]", validate_schema)
    validate(schema)  # make sure generated schemas are always valid
    return schema
