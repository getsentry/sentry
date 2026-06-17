from datetime import UTC, datetime

from drf_spectacular.utils import extend_schema

from sentry.api.base import Endpoint
from sentry.api.helpers.deprecation import deprecated
from tests.sentry.apidocs import generate_schema


def test_simple() -> None:
    op_id = "This is a test"

    class ExampleEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(operation_id=op_id)
        def get(self, request, *args, **kwargs):
            pass

    schema = generate_schema("foo", view=ExampleEndpoint)
    assert schema["paths"]["/foo"]["get"]["operationId"] == op_id


def test_description() -> None:
    class ExampleEndpoint(Endpoint):
        permission_classes = ()

        def get(self, request, *args, **kwargs):
            """

            Operation ID

            Description Line 1
            Description Line 2

            Description Line 3


            """

        @extend_schema(operation_id="Ignore Docstring")
        def post(self, request):
            """
            Autoschema Description
            Extended Lines
            """

        def put(self, request):
            """
            Autoschema Description
            """

        # Should not result in an error when generating a schema
        def delete(self, request):
            pass

    schema = generate_schema("foo", view=ExampleEndpoint)
    assert schema["paths"]["/foo"]["get"]["operationId"] == "Operation ID"
    assert (
        schema["paths"]["/foo"]["get"]["description"]
        == "Operation ID\n\nDescription Line 1\nDescription Line 2\n\nDescription Line 3"
    )

    assert schema["paths"]["/foo"]["post"]["operationId"] == "Ignore Docstring"
    assert (
        schema["paths"]["/foo"]["post"]["description"] == "Autoschema Description\nExtended Lines"
    )

    assert schema["paths"]["/foo"]["put"]["operationId"] != "Autoschema Description"
    assert schema["paths"]["/foo"]["put"]["description"] == "Autoschema Description"


def test_deprecated_decorator_marks_openapi_operation() -> None:
    class ExampleEndpoint(Endpoint):
        permission_classes = ()

        @deprecated(datetime(2020, 1, 1, tzinfo=UTC))
        def get(self, request, *args, **kwargs):
            pass

        def post(self, request, *args, **kwargs):
            pass

    schema = generate_schema("foo", view=ExampleEndpoint)
    assert schema["paths"]["/foo"]["get"]["deprecated"] is True
    assert "deprecated" not in schema["paths"]["/foo"]["post"]


def test_deprecated_decorator_does_not_mark_url_name_specific_operation() -> None:
    class ExampleEndpoint(Endpoint):
        permission_classes = ()

        @deprecated(datetime(2020, 1, 1, tzinfo=UTC), url_names=["deprecated-route"])
        def get(self, request, *args, **kwargs):
            pass

    schema = generate_schema("foo", view=ExampleEndpoint)

    assert "deprecated" not in schema["paths"]["/foo"]["get"]
