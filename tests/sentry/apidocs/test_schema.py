from urllib.parse import urlencode

import pytest
from django.http import HttpRequest
from django.test import RequestFactory
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.api.endpoints.organization_events import OrganizationEventsEndpoint
from sentry.api.endpoints.organization_events_timeseries import OrganizationEventsTimeseriesEndpoint
from sentry.api.endpoints.organization_trace_item_attributes import (
    OrganizationTraceItemAttributesEndpoint,
)
from sentry.api.helpers.timeseries_transformations import (
    FillTransformation,
    SmaSmoothTransformation,
    get_transformations,
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
        def get(self, request: HttpRequest, *args: object, **kwargs: object) -> None:
            pass

    schema = generate_schema("foo", view=ExampleEndpoint)
    assert schema["paths"]["/foo"]["get"]["operationId"] == op_id


def test_description() -> None:
    class ExampleEndpoint(Endpoint):
        permission_classes = ()

        def get(self, request: HttpRequest, *args: object, **kwargs: object) -> None:
            """

            Operation ID

            Description Line 1
            Description Line 2

            Description Line 3


            """

        @extend_schema(operation_id="Ignore Docstring")
        def post(self, request: HttpRequest) -> None:
            """
            Autoschema Description
            Extended Lines
            """

        def put(self, request: HttpRequest) -> None:
            """
            Autoschema Description
            """

        # Should not result in an error when generating a schema
        def delete(self, request: HttpRequest) -> None:
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
            {"environment", "expand", "project"},
            {"environment", "expand", "project"},
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


def test_trace_item_attributes_expand_is_experimental() -> None:
    path = "/api/0/organizations/{organization_id_or_slug}/trace-items/attributes/"
    route = path.removeprefix("/").replace(
        "{organization_id_or_slug}", "<str:organization_id_or_slug>"
    )
    schema = generate_schema(route, view=OrganizationTraceItemAttributesEndpoint)
    operation = schema["paths"][path]["get"]

    # The endpoint itself stays PUBLIC; only `expand` is experimental.
    assert "x-sentry-experimental" not in operation
    assert "expand=context" in operation["description"]

    (expand,) = [p for p in operation["parameters"] if p["name"] == "expand"]
    assert expand["x-sentry-experimental"] is True
    assert expand["description"].startswith("**Experimental:**")


def test_timeseries_transformation_parameter_serialization() -> None:
    path = "/api/0/organizations/{organization_id_or_slug}/events-timeseries/"
    schema = generate_schema(
        "api/0/organizations/<str:organization_id_or_slug>/events-timeseries/",
        view=OrganizationEventsTimeseriesEndpoint,
    )
    parameters = {p["name"]: p for p in schema["paths"][path]["get"]["parameters"]}
    parameter = parameters["transformations[0]"]
    assert parameter["style"] == "form"
    assert parameter["explode"] is True
    assert parameter["schema"] == {"type": "array", "items": {"type": "string"}}
    assert parameter.get("required", False) is False

    query = urlencode(
        [
            ("yAxis", ["count()", "count()"]),
            (parameter["name"], ["smooth(sma,3)", "fill(locf)"]),
            ("transformations[1]", ["fill(zero)"]),
        ],
        doseq=True,
    )
    request = Request(RequestFactory().get(f"/events-timeseries/?{query}"))
    assert get_transformations(request) == {
        0: [SmaSmoothTransformation(mode="sma", window_size=3), FillTransformation(mode="locf")],
        1: [FillTransformation(mode="zero")],
    }
