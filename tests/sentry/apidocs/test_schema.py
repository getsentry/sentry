from datetime import datetime, timezone
from urllib.parse import urlencode

import pytest
from django.http import HttpRequest
from django.test import RequestFactory
from drf_spectacular.utils import extend_schema
from jsonschema.exceptions import ValidationError
from openapi_schema_validator import OAS30Validator
from rest_framework.request import Request

import sentry.apidocs.extensions  # noqa: F401
from sentry.api.base import Endpoint
from sentry.api.endpoints.organization_events import OrganizationEventsEndpoint
from sentry.api.endpoints.organization_events_timeseries import OrganizationEventsTimeseriesEndpoint
from sentry.api.endpoints.organization_trace_item_attributes import (
    OrganizationTraceItemAttributesEndpoint,
)
from sentry.api.endpoints.timeseries import BucketBoundaries
from sentry.api.helpers.timeseries_transformations import (
    FillTransformation,
    SmaSmoothTransformation,
    get_transformations,
)
from sentry.apidocs.hooks import dereference_schema
from sentry.dashboards.endpoints.organization_dashboards import OrganizationDashboardsEndpoint
from sentry.explore.endpoints.explore_saved_queries import ExploreSavedQueriesEndpoint
from sentry.explore.endpoints.explore_saved_query_detail import ExploreSavedQueryDetailEndpoint
from sentry.explore.endpoints.serializers import QuerySerializer
from sentry.replays.endpoints.organization_replay_index import OrganizationReplayIndexEndpoint
from sentry.snuba.rpc_dataset_common import ProcessedTimeseries, TimeseriesTransformationFlags
from sentry.utils.snuba import SnubaTSResult
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


def test_timeseries_query_parameter_serialization() -> None:
    path = "/api/0/organizations/{organization_id_or_slug}/events-timeseries/"
    schema = generate_schema(
        path.removeprefix("/").replace(
            "{organization_id_or_slug}", "<str:organization_id_or_slug>"
        ),
        view=OrganizationEventsTimeseriesEndpoint,
    )
    parameters = {p["name"]: p for p in schema["paths"][path]["get"]["parameters"]}
    for name in ("yAxis", "transformations[0]"):
        assert parameters[name]["style"] == "form"
        assert parameters[name]["explode"] is True
        assert parameters[name]["schema"]["type"] == "array"
        assert parameters[name]["schema"]["items"]["type"] == "string"
        assert parameters[name]["schema"].get("uniqueItems", False) is False
        assert parameters[name].get("required", False) is False

    interval_validator = OAS30Validator(parameters["interval"]["schema"])
    interval_validator.validate("1m")
    with pytest.raises(ValidationError):
        interval_validator.validate(60)

    query = urlencode(
        [
            (parameters["yAxis"]["name"], ["count()", "count()"]),
            (parameters["interval"]["name"], "1m"),
            (parameters["transformations[0]"]["name"], ["smooth(sma,3)", "fill(locf)"]),
            ("transformations[1]", ["fill(zero)", "smooth(sma,2)"]),
        ],
        doseq=True,
    )
    request = Request(RequestFactory().get(f"/events-timeseries/?{query}"))
    assert request.GET.getlist("yAxis") == ["count()", "count()"]
    assert request.GET["interval"] == "1m"
    assert get_transformations(request) == {
        0: [SmaSmoothTransformation(mode="sma", window_size=3), FillTransformation(mode="locf")],
        1: [FillTransformation(mode="zero"), SmaSmoothTransformation(mode="sma", window_size=2)],
    }
    request_without_transformations = Request(
        RequestFactory().get("/events-timeseries/", {"yAxis": ["count()", "count()"]})
    )
    assert get_transformations(request_without_transformations) == {}


def test_timeseries_response_serialization_matches_schema() -> None:
    path = "/api/0/organizations/{organization_id_or_slug}/events-timeseries/"
    schema = generate_schema(
        path.removeprefix("/").replace(
            "{organization_id_or_slug}", "<str:organization_id_or_slug>"
        ),
        view=OrganizationEventsTimeseriesEndpoint,
    )
    response_schema = schema["components"]["schemas"]["OrganizationEventsTimeseriesResponse"]
    series_schema = response_schema["properties"]["timeSeries"]["items"]
    row_schema = series_schema["properties"]["values"]["items"]
    assert row_schema["properties"]["value"]["nullable"] is True
    assert row_schema["properties"]["comparisonValue"]["nullable"] is True
    assert "comparisonValue" not in row_schema["required"]
    assert series_schema["properties"]["meta"]["properties"]["valueUnit"]["nullable"] is True
    for name in ("filled", "smoothed", "comparisonFilled", "comparisonSmoothed"):
        assert row_schema["properties"][name] == {"type": "boolean"}
        assert name not in row_schema["required"]

    axis = "avg(span.duration)"
    result = SnubaTSResult(
        data={
            "data": [{"time": 0, axis: None, "transformed": 0.0}],
            "meta": {"fields": {axis: "duration"}},
            "processed_timeseries": ProcessedTimeseries(
                transformation_aliases={0: "transformed"},
                transformation_flags={
                    0: TimeseriesTransformationFlags(filled=[True], smoothed=[False])
                },
            ),
        },
        start=datetime.fromtimestamp(0, tz=timezone.utc),
        end=datetime.fromtimestamp(60, tz=timezone.utc),
        rollup=60,
    )
    endpoint = OrganizationEventsTimeseriesEndpoint()
    boundaries = BucketBoundaries(now=1000, complete_through=1000)
    series = endpoint.serialize_result(result, [axis, axis], 60, boundaries)
    assert series == [
        {
            "yAxis": "avg(span.duration)",
            "meta": {"valueType": "duration", "valueUnit": "millisecond", "interval": 60000},
            "values": [
                {
                    "timestamp": 0,
                    "value": 0.0,
                    "incomplete": False,
                    "filled": True,
                    "smoothed": False,
                }
            ],
        },
        {
            "yAxis": "avg(span.duration)",
            "meta": {"valueType": "duration", "valueUnit": "millisecond", "interval": 60000},
            "values": [{"timestamp": 0, "value": None, "incomplete": False}],
        },
    ]
    OAS30Validator(response_schema).validate({"timeSeries": series})

    comparison_result = SnubaTSResult(
        data={
            "data": [{"time": 0, "count()": None, "comparisonCount": None}],
            "meta": {"fields": {"count()": "integer"}},
            "processed_timeseries": ProcessedTimeseries(
                transformation_flags={
                    0: TimeseriesTransformationFlags(filled=[False], smoothed=[False])
                },
                comparison_transformation_flags=TimeseriesTransformationFlags(
                    filled=[False], smoothed=[True]
                ),
            ),
        },
        start=result.start,
        end=result.end,
        rollup=60,
    )
    comparison_series = endpoint.serialize_result(comparison_result, ["count()"], 60, boundaries)
    assert comparison_series == [
        {
            "yAxis": "count()",
            "meta": {"valueType": "integer", "valueUnit": None, "interval": 60000},
            "values": [
                {
                    "timestamp": 0,
                    "value": None,
                    "incomplete": False,
                    "comparisonValue": None,
                    "filled": False,
                    "smoothed": False,
                    "comparisonFilled": False,
                    "comparisonSmoothed": True,
                }
            ],
        }
    ]
    OAS30Validator(response_schema).validate({"timeSeries": comparison_series})


@pytest.mark.parametrize(
    "route,view,method,status_code",
    [
        (
            "api/0/organizations/<str:organization_id_or_slug>/explore/saved/",
            ExploreSavedQueriesEndpoint,
            "post",
            "201",
        ),
        (
            "api/0/organizations/<str:organization_id_or_slug>/explore/saved/<int:id>/",
            ExploreSavedQueryDetailEndpoint,
            "put",
            "200",
        ),
    ],
)
@pytest.mark.parametrize("visualization_field", ["visualize", "aggregateField"])
def test_saved_query_transformation_schemas(
    route: str,
    view: type[Endpoint],
    method: str,
    status_code: str,
    visualization_field: str,
) -> None:
    schema = generate_schema(route, view=view)
    path = "/" + route.replace(
        "<str:organization_id_or_slug>", "{organization_id_or_slug}"
    ).replace("<int:id>", "{id}")
    operation = schema["paths"][path][method]
    components = schema["components"]["schemas"]
    request_schema = dereference_schema(
        operation["requestBody"]["content"]["application/json"]["schema"], components
    )
    query_schema = dereference_schema(request_schema["properties"]["query"]["items"], components)
    visualization_schema = dereference_schema(
        query_schema["properties"][visualization_field]["items"], components
    )
    response_schema = dereference_schema(
        operation["responses"][status_code]["content"]["application/json"]["schema"], components
    )
    response_visualization_schema = response_schema["properties"]["query"]["items"]["properties"][
        visualization_field
    ]["items"]
    entries = [
        {"yAxes": ["count()"]},
        {"yAxes": ["count()"], "transformations": []},
        {
            "yAxes": ["count()"],
            "transformations": ["smooth( ema , 7 , 0.25 )", "fill( linear )"],
        },
    ]
    serializer = QuerySerializer(data={"mode": "aggregate", visualization_field: entries})
    assert serializer.is_valid(), serializer.errors
    assert serializer.data[visualization_field] == entries

    for entry_schema in (visualization_schema, response_visualization_schema):
        transformations = entry_schema["properties"]["transformations"]
        assert transformations["type"] == "array"
        assert transformations["items"]["type"] == "string"
        assert "transformations" not in entry_schema.get("required", [])
        validator = OAS30Validator(entry_schema)
        for entry in serializer.data[visualization_field]:
            validator.validate(entry)
        with pytest.raises(ValidationError):
            validator.validate({"yAxes": ["count()"], "transformations": None})
