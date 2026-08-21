from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import mock

from django.http import HttpRequest
from django.test import RequestFactory
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint
from sentry.apidocs.response_contracts import (
    OperationContract,
    get_runtime_operation_contract,
    normalize_django_route,
)
from sentry.apidocs.response_validation import (
    _log_violation,
    _ResponseValidator,
    _validate_rendered_response,
    maybe_validate_response_contract,
)
from sentry.testutils.helpers.options import override_options
from tests.sentry.apidocs import generate_schema

_ENABLED_RESPONSE_VALIDATION_OPTIONS = {
    "api.response-schema-validation.rollout-rate": 1.0,
    "api.response-schema-validation.max-response-bytes": 512 * 1024,
    "api.response-schema-validation.excluded-operations": [],
}


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


def test_runtime_response_contract_is_derived_from_endpoint_schema() -> None:
    class ExampleResponseEndpoint(Endpoint):
        permission_classes = ()
        publish_status = {"GET": ApiPublishStatus.PUBLIC}

        @extend_schema(
            operation_id="getExampleResponse",
            responses=inline_serializer(
                name="ExampleResponse",
                fields={"name": serializers.CharField()},
            ),
        )
        def get(self, request):
            return Response({"name": "value"})

    contract = get_runtime_operation_contract(
        ExampleResponseEndpoint.as_view(),
        "/api/0/things/",
        r"^api/0/things/$",
        "GET",
    )

    assert contract is not None
    assert contract["operation_id"] == "getExampleResponse"
    schema = contract["responses"]["200"]
    assert schema is not None
    assert list(_ResponseValidator(schema).iter_errors({"name": "value"})) == []


def test_normalize_django_route() -> None:
    route = r"^api/0/organizations/(?P<organization_id_or_slug>[^/]+)/$"

    assert normalize_django_route(route) == "/api/0/organizations/{organization_id_or_slug}/"


def test_strict_response_validator_classifies_additive_fields() -> None:
    schema = {
        "type": "object",
        "properties": {"name": {"type": "string"}},
        "required": ["name"],
    }
    validator = _ResponseValidator(schema)

    errors = list(validator.iter_errors({"name": "value", "newField": True}))

    assert len(errors) == 1
    assert errors[0].message == "Response contains 1 undocumented properties"


def test_strict_response_validator_preserves_free_form_maps() -> None:
    schema = {
        "type": "object",
        "properties": {"name": {"type": "string"}},
        "additionalProperties": True,
    }
    validator = _ResponseValidator(schema)

    assert list(validator.iter_errors({"name": "value", "dynamic": True})) == []


def test_response_validator_honors_oas30_read_semantics() -> None:
    schema = {
        "type": "object",
        "properties": {
            "nullableValue": {"type": "string", "nullable": True},
            "secret": {"type": "string", "writeOnly": True},
        },
        "required": ["nullableValue", "secret"],
    }
    validator = _ResponseValidator(schema)

    assert list(validator.iter_errors({"nullableValue": None})) == []

    errors = list(validator.iter_errors({"nullableValue": None, "secret": "value"}))
    assert len(errors) == 1
    assert errors[0].message == "Response contains a write-only property"


@mock.patch("sentry.apidocs.response_validation.logger.warning")
def test_violation_is_logged(mock_warning: mock.MagicMock) -> None:
    _log_violation(
        operation_id="listThingsWithViolation",
        owner="test-owner",
        status_code=200,
        category="breaking",
        validator="type",
        schema_path="properties/count/type",
    )

    mock_warning.assert_called_once_with(
        "api.response_schema_validation.violation",
        extra={
            "api_owner": "test-owner",
            "api_operation": "listThingsWithViolation",
            "contract_violation": "breaking",
            "status_code": 200,
            "validator": "type",
            "schema_path": "properties/count/type",
        },
    )


def _render_json_response(data: object) -> Response:
    response = Response(data)
    response.accepted_renderer = JSONRenderer()
    response.accepted_media_type = "application/json"
    response.renderer_context = {}
    response.render()
    return response


@mock.patch("sentry.apidocs.response_validation._log_violation")
def test_validate_rendered_response_logs_breaking_errors(mock_log: mock.MagicMock) -> None:
    response = _render_json_response({"count": "not-an-integer"})
    contract = {
        "operation_id": "listThingsWithCount",
        "responses": {"200": {"type": "object"}},
    }

    _validate_rendered_response(
        response,
        contract=contract,
        owner="test-owner",
        schema={
            "type": "object",
            "properties": {"count": {"type": "integer"}},
            "required": ["count"],
        },
        max_response_bytes=1024,
    )

    assert mock_log.call_args.kwargs["category"] == "breaking"
    assert mock_log.call_args.kwargs["validator"] == "type"


@mock.patch("sentry.apidocs.response_validation._log_violation")
def test_validate_rendered_response_logs_additive_fields(mock_log: mock.MagicMock) -> None:
    response = _render_json_response({"name": "value", "newField": True})
    contract = {
        "operation_id": "listThingsWithName",
        "responses": {"200": {"type": "object"}},
    }

    _validate_rendered_response(
        response,
        contract=contract,
        owner="test-owner",
        schema={"type": "object", "properties": {"name": {"type": "string"}}},
        max_response_bytes=1024,
    )

    assert mock_log.call_args.kwargs["category"] == "additive"
    assert mock_log.call_args.kwargs["validator"] == "additionalProperties"


@mock.patch("sentry.apidocs.response_validation._log_violation")
def test_validate_rendered_response_uses_wire_json(mock_log: mock.MagicMock) -> None:
    response = _render_json_response(
        {"created": datetime(2026, 8, 17, 12, 30, tzinfo=timezone.utc)}
    )
    contract = {
        "operation_id": "listThingsWithCreatedDate",
        "responses": {"200": {"type": "object"}},
    }

    _validate_rendered_response(
        response,
        contract=contract,
        owner="test-owner",
        schema={
            "type": "object",
            "properties": {"created": {"type": "string", "format": "date-time"}},
            "required": ["created"],
        },
        max_response_bytes=1024,
    )

    assert not mock_log.called


def _contract_request(
    status: ApiPublishStatus = ApiPublishStatus.PUBLIC,
) -> HttpRequest:
    request = RequestFactory().get("/api/0/things/")
    endpoint_class = SimpleNamespace(
        publish_status={"GET": status},
        owner=SimpleNamespace(value="test-owner"),
    )
    request.resolver_match = SimpleNamespace(
        route=r"^api/0/things/$",
        func=SimpleNamespace(cls=endpoint_class),
    )
    return request


def _operation_contract(schema: dict[str, object]) -> OperationContract:
    return {
        "operation_id": "listThings",
        "responses": {"200": schema},
    }


@mock.patch("sentry.apidocs.response_validation.get_runtime_operation_contract")
def test_response_validation_disabled_does_not_build_contract(mock_get: mock.MagicMock) -> None:
    response = _render_json_response({"name": "value"})

    with override_options({"api.response-schema-validation.rollout-rate": 0.0}):
        maybe_validate_response_contract(_contract_request(), response)

    assert not mock_get.called


@mock.patch("sentry.apidocs.response_validation.get_runtime_operation_contract")
def test_response_validation_skips_private_endpoints(mock_get: mock.MagicMock) -> None:
    response = _render_json_response({"name": "value"})

    with override_options(_ENABLED_RESPONSE_VALIDATION_OPTIONS):
        maybe_validate_response_contract(_contract_request(ApiPublishStatus.PRIVATE), response)

    assert not mock_get.called


@mock.patch("sentry.apidocs.response_validation._log_violation")
@mock.patch("sentry.apidocs.response_validation.get_runtime_operation_contract")
def test_response_validation_validates_selected_operation(
    mock_get: mock.MagicMock,
    mock_log: mock.MagicMock,
) -> None:
    mock_get.return_value = _operation_contract(
        {"type": "object", "properties": {"name": {"type": "string"}}}
    )
    response = _render_json_response({"name": "value"})

    with override_options(_ENABLED_RESPONSE_VALIDATION_OPTIONS):
        maybe_validate_response_contract(_contract_request(), response)

    assert not mock_log.called


@mock.patch("sentry.apidocs.response_validation._log_violation")
@mock.patch("sentry.apidocs.response_validation.get_runtime_operation_contract")
def test_response_validation_logs_undocumented_success_status(
    mock_get: mock.MagicMock,
    mock_log: mock.MagicMock,
) -> None:
    mock_get.return_value = _operation_contract({"type": "object"})
    response = _render_json_response({"name": "value"})
    response.status_code = 201

    with override_options(_ENABLED_RESPONSE_VALIDATION_OPTIONS):
        maybe_validate_response_contract(_contract_request(), response)

    assert mock_log.call_args.kwargs["owner"] == "test-owner"
    assert mock_log.call_args.kwargs["category"] == "breaking"
    assert mock_log.call_args.kwargs["validator"] == "status"


@mock.patch(
    "sentry.apidocs.response_validation._ResponseValidator.iter_errors",
    side_effect=RuntimeError("validator failed"),
)
def test_validator_failure_does_not_affect_response(mock_iter_errors: mock.MagicMock) -> None:
    response = _render_json_response({"name": "value"})
    contract = {
        "operation_id": "listThingsWithValidatorFailure",
        "responses": {"200": {"type": "object"}},
    }

    _validate_rendered_response(
        response,
        contract=contract,
        owner="test-owner",
        schema={"type": "object"},
        max_response_bytes=1024,
    )

    assert response.status_code == 200
    assert response.data == {"name": "value"}
