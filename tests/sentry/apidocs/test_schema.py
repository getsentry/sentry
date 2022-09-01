from drf_spectacular.utils import extend_schema

from sentry.api.base import Endpoint
from tests.sentry.apidocs import generate_schema


def test_simple():

    op_id = "This is a test"

    class ExampleEndpoint(Endpoint):
        @extend_schema(operation_id=op_id)
        def get(self, request, *args, **kwargs):
            pass

    schema = generate_schema("foo", view=ExampleEndpoint)
    assert schema["paths"]["/foo"]["get"]["operationId"] == op_id
