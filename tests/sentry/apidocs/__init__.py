from drf_spectacular.validation import validate_schema


def generate_schema(route, viewset=None, view=None, view_function=None, patterns=None):
    """
    Taken from drf_spectacular tests
    https://github.com/tfranzel/drf-spectacular/blob/590a2f7f053fbe83446aa453cb4d4a3025410609/tests/__init__.py#L64
    """
    from django.urls import path
    from drf_spectacular.generators import SchemaGenerator
    from rest_framework import routers
    from rest_framework.viewsets import ViewSetMixin

    if viewset:
        assert issubclass(viewset, ViewSetMixin)
        router = routers.SimpleRouter()
        router.register(route, viewset, basename=route)
        patterns = router.urls
    elif view:
        patterns = [path(route, view.as_view())]
    elif view_function:
        patterns = [path(route, view_function)]
    else:
        assert route is None and isinstance(patterns, list)

    generator = SchemaGenerator(patterns=patterns)
    schema = generator.get_schema(request=None, public=True)
    validate_schema(schema)  # make sure generated schemas are always valid
    return schema
