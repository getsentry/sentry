from drf_spectacular.utils import extend_schema

from sentry.api.base import Endpoint
from tests.sentry.apidocs import generate_schema


def test_simple():

    op_id = "This is a test"

    class ExampleEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(operation_id=op_id)
        def get(self, request, *args, **kwargs):
            pass

    schema = generate_schema("foo", view=ExampleEndpoint)
    assert schema["paths"]["/foo"]["get"]["operationId"] == op_id


def test_description():
    class ExampleEndpoint(Endpoint):
        permission_classes = ()

        def get(self, request, *args, **kwargs):
            """

            Operation ID

            Description Line 1
            Description Line 2

            Description Line 3


            """
            pass

        @extend_schema(operation_id="Ignore Docstring")
        def post(self, request):
            """
            Autoschema Description
            Extended Lines
            """
            pass

        def put(self, request):
            """
            Autoschema Description
            """
            pass

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
