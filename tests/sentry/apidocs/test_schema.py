import pytest
from drf_spectacular.utils import extend_schema

from sentry.api.base import Endpoint
from sentry.api.endpoints.organization_events import OrganizationEventsEndpoint
from sentry.api.endpoints.organization_trace_item_attributes import (
    OrganizationTraceItemAttributesEndpoint,
)
from sentry.dashboards.endpoints.organization_dashboards import OrganizationDashboardsEndpoint
from sentry.replays.endpoints.organization_replay_index import OrganizationReplayIndexEndpoint
from sentry.workflow_engine.endpoints.organization_detector_index import (
    OrganizationDetectorIndexEndpoint,
)
from sentry.workflow_engine.endpoints.organization_workflow_index import (
    OrganizationWorkflowIndexEndpoint,
)
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


@pytest.mark.parametrize(
    ("path", "view", "operation_id", "expected_names", "array_names"),
    [
        pytest.param(
            "/api/0/organizations/{organization_id_or_slug}/events/",
            OrganizationEventsEndpoint,
            "listOrganizationEvents",
            {"referrer"},
            set(),
            id="events",
        ),
        pytest.param(
            "/api/0/organizations/{organization_id_or_slug}/replays/",
            OrganizationReplayIndexEndpoint,
            "listOrganizationReplays",
            {"environment", "queryReferrer"},
            {"environment"},
            id="replays",
        ),
        pytest.param(
            "/api/0/organizations/{organization_id_or_slug}/detectors/",
            OrganizationDetectorIndexEndpoint,
            "listOrganizationDetectors",
            {"cursor", "per_page"},
            set(),
            id="detectors",
        ),
        pytest.param(
            "/api/0/organizations/{organization_id_or_slug}/dashboards/",
            OrganizationDashboardsEndpoint,
            "listOrganizationDashboards",
            {"filter", "pin", "query", "sort"},
            {"filter"},
            id="dashboards",
        ),
        pytest.param(
            "/api/0/organizations/{organization_id_or_slug}/workflows/",
            OrganizationWorkflowIndexEndpoint,
            "listOrganizationWorkflows",
            {"cursor", "detector", "per_page"},
            {"detector"},
            id="workflows",
        ),
        pytest.param(
            "/api/0/organizations/{organization_id_or_slug}/trace-items/attributes/",
            OrganizationTraceItemAttributesEndpoint,
            "listOrganizationTraceItemAttributes",
            {"environment", "project"},
            {"environment", "project"},
            id="trace-item-attributes",
        ),
    ],
)
def test_public_endpoint_query_parameters(
    path: str,
    view: type[Endpoint],
    operation_id: str,
    expected_names: set[str],
    array_names: set[str],
) -> None:
    route = path.removeprefix("/").replace(
        "{organization_id_or_slug}", "<str:organization_id_or_slug>"
    )
    schema = generate_schema(route, view=view)
    operation = schema["paths"][path]["get"]

    assert operation["operationId"] == operation_id
    query_parameters = {
        parameter["name"]: parameter
        for parameter in operation["parameters"]
        if parameter["in"] == "query"
    }
    assert expected_names <= query_parameters.keys()
    for name in array_names:
        assert query_parameters[name]["schema"]["type"] == "array"
