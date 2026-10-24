from typing import Any, get_type_hints

from drf_spectacular.extensions import (
    OpenApiAuthenticationExtension,
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.plumbing import build_basic_type
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import Direction

from sentry.api.serializers.rest_framework.base import snake_to_camel_case
from sentry.apidocs.spectacular_ports import resolve_type_hint
from sentry.conf.server import GRANULAR_SCOPES


def _json_schema_to_openapi(schema: dict[str, Any]) -> dict[str, Any]:
    """Convert the JSON Schema features used by workflow handlers to OpenAPI 3.0."""

    def convert(value: Any) -> Any:
        if isinstance(value, list):
            return [convert(item) for item in value]
        if not isinstance(value, dict):
            return value

        result = {
            key: convert(item)
            for key, item in value.items()
            if key not in {"$schema", "if", "then", "else", "optional"}
        }
        if isinstance(properties := value.get("properties"), dict):
            result["properties"] = {
                snake_to_camel_case(name): convert(spec)
                for name, spec in properties.items()
                if not (name == "additionalProperties" and spec is False)
            }
        if "const" in result:
            result["enum"] = [result.pop("const")]
        if isinstance(required := value.get("required"), list):
            result["required"] = [snake_to_camel_case(field) for field in required]
        if isinstance(schema_types := result.get("type"), list):
            non_null_types = [schema_type for schema_type in schema_types if schema_type != "null"]
            if "null" in schema_types:
                result["nullable"] = True
            if len(non_null_types) == 1:
                result["type"] = non_null_types[0]
            elif len(non_null_types) > 1:
                result.pop("type")
                result["oneOf"] = [{"type": schema_type} for schema_type in non_null_types]
            elif not non_null_types:
                result.pop("type")

        if isinstance(all_of := result.get("allOf"), list):
            if converted_all_of := [item for item in all_of if item]:
                result["allOf"] = converted_all_of
            else:
                result.pop("allOf")
        return result

    return convert(schema)


def _map_camel_case_serializer(
    target: Any, auto_schema: AutoSchema, direction: Direction
) -> dict[str, Any]:
    schema = auto_schema._map_serializer(target, direction, bypass_extensions=True)
    schema["properties"] = {
        snake_to_camel_case(name): value for name, value in schema.get("properties", {}).items()
    }
    if required := schema.get("required"):
        schema["required"] = [snake_to_camel_case(name) for name in required]
    return schema


def _condition_schema(group: Any) -> dict[str, Any]:
    from sentry.workflow_engine.models.data_condition import LEGACY_CONDITIONS, Condition
    from sentry.workflow_engine.registry import condition_handler_registry

    variants = []
    for registered_type, handler in sorted(condition_handler_registry.registrations.items()):
        condition_type = Condition(registered_type)
        if condition_type in LEGACY_CONDITIONS or handler.group != group:
            continue
        variants.append(
            {
                "title": f"{condition_type.value.replace('_', ' ').title()} Condition",
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "type": {"type": "string", "enum": [condition_type.value]},
                    "comparison": _json_schema_to_openapi(handler.comparison_json_schema),
                    "conditionResult": _json_schema_to_openapi(handler.condition_result_schema),
                },
                "required": ["type", "comparison", "conditionResult"],
            }
        )
    return {"oneOf": variants, "discriminator": {"propertyName": "type"}}


def _metric_condition_schema() -> dict[str, Any]:
    from sentry.workflow_engine.models.data_condition import Condition
    from sentry.workflow_engine.registry import condition_handler_registry
    from sentry.workflow_engine.types import DetectorPriorityLevel

    condition_results = [
        DetectorPriorityLevel.OK.value,
        DetectorPriorityLevel.MEDIUM.value,
        DetectorPriorityLevel.HIGH.value,
    ]
    operator_types = [
        Condition.GREATER.value,
        Condition.LESS.value,
        Condition.GREATER_OR_EQUAL.value,
        Condition.LESS_OR_EQUAL.value,
    ]
    anomaly_handler = condition_handler_registry.get(Condition.ANOMALY_DETECTION)
    common_properties: dict[str, Any] = {
        "id": {"type": "integer"},
        "conditionResult": {"type": "integer", "enum": condition_results},
    }
    return {
        "oneOf": [
            {
                "title": "Threshold Condition",
                "type": "object",
                "properties": {
                    **common_properties,
                    "type": {"type": "string", "enum": operator_types},
                    "comparison": {"type": "number"},
                },
                "required": ["type", "comparison", "conditionResult"],
            },
            {
                "title": "Anomaly Detection Condition",
                "type": "object",
                "properties": {
                    **common_properties,
                    "type": {"type": "string", "enum": [Condition.ANOMALY_DETECTION.value]},
                    "comparison": _json_schema_to_openapi(anomaly_handler.comparison_json_schema),
                },
                "required": ["type", "comparison", "conditionResult"],
            },
        ],
        "discriminator": {"propertyName": "type"},
    }


def _metric_config_schema(schema: dict[str, Any]) -> dict[str, Any]:
    from sentry.incidents.models.alert_rule import AlertRuleDetectionType

    base_schema = _json_schema_to_openapi(schema)
    variants = []
    for detection_type in AlertRuleDetectionType:
        properties = dict(base_schema["properties"])
        properties["detectionType"] = {"type": "string", "enum": [detection_type.value]}
        variants.append(
            {
                **base_schema,
                "title": f"{detection_type.value.title()} Detection Config",
                "properties": properties,
            }
        )
    return {"oneOf": variants, "discriminator": {"propertyName": "detectionType"}}


def _snuba_query_schema(auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
    from sentry.snuba.models import ExtrapolationMode, SnubaQuery, SnubaQueryEventType
    from sentry.snuba.snuba_query_validator import (
        QUERY_TYPE_VALID_DATASETS,
        QUERY_TYPE_VALID_EVENT_TYPES,
        SnubaQueryValidator,
    )

    schema = _map_camel_case_serializer(SnubaQueryValidator(), auto_schema, direction)
    properties = schema["properties"]
    properties.pop("groupBy", None)
    properties["queryType"]["enum"] = [query_type.value for query_type in SnubaQuery.Type]
    properties["timeWindow"]["description"] = "Aggregation window in seconds."
    properties["eventTypes"]["items"]["enum"] = [
        event_type.name.lower() for event_type in SnubaQueryEventType.EventType
    ]
    properties["extrapolationMode"]["enum"] = [
        ExtrapolationMode.UNKNOWN.name.lower(),
        ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.name.lower(),
    ]
    variants = []
    for query_type, datasets in QUERY_TYPE_VALID_DATASETS.items():
        variant_properties: dict[str, Any] = {
            "queryType": {"type": "integer", "enum": [query_type.value]},
            "dataset": {"type": "string", "enum": sorted(dataset.value for dataset in datasets)},
        }
        event_types = QUERY_TYPE_VALID_EVENT_TYPES.get(query_type)
        if event_types is not None:
            variant_properties["eventTypes"] = {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": sorted(event_type.name.lower() for event_type in event_types),
                },
            }
        else:
            variant_properties["eventTypes"] = {"type": "array", "maxItems": 0}
        variants.append(
            {
                "title": f"{query_type.name.title()} Query",
                "type": "object",
                "properties": variant_properties,
            }
        )
    schema["oneOf"] = variants
    return schema


def _detector_schema(auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
    from sentry.incidents.grouptype import MetricIssue
    from sentry.incidents.metric_issue_detector import MetricIssueConditionGroupValidator
    from sentry.workflow_engine.endpoints.validators.base.detector import BaseDetectorTypeValidator
    from sentry.workflow_engine.registry import detector_settings_registry

    is_update = auto_schema.method == "PUT"
    base_schema = _map_camel_case_serializer(BaseDetectorTypeValidator(), auto_schema, direction)
    if is_update:
        base_schema.pop("required", None)
    variants = []
    for detector_type, settings in sorted(detector_settings_registry.registrations.items()):
        if settings.validator is None or (not is_update and detector_type == "error"):
            continue

        schema = _map_camel_case_serializer(settings.validator(), auto_schema, direction)
        schema["title"] = f"{detector_type.replace('_', ' ').title()} Monitor"
        schema["properties"]["type"] = {"type": "string", "enum": [detector_type]}
        schema["properties"]["config"] = (
            _metric_config_schema(settings.config_schema)
            if detector_type == MetricIssue.slug
            else _json_schema_to_openapi(settings.config_schema) or {"type": "object"}
        )

        if detector_type == MetricIssue.slug:
            condition_group = _map_camel_case_serializer(
                MetricIssueConditionGroupValidator(), auto_schema, direction
            )
            condition_group["properties"]["conditions"]["items"] = _metric_condition_schema()
            schema["properties"]["conditionGroup"] = condition_group
            schema["properties"]["dataSources"]["items"] = _snuba_query_schema(
                auto_schema, direction
            )
            if not is_update:
                schema["required"] = sorted(
                    set(schema.get("required", []))
                    | {"name", "type", "dataSources", "conditionGroup"}
                )

        if is_update:
            schema.pop("required", None)
        variants.append(schema)

    combiner = "anyOf" if is_update else "oneOf"
    result: dict[str, Any] = {**base_schema, combiner: variants}
    if not is_update:
        result["discriminator"] = {"propertyName": "type"}
    return result


def _workflow_action_schema() -> dict[str, Any]:
    # These imports are deferred because action handlers import API serializers while registering.
    from sentry.workflow_engine.endpoints.validators.base.action import DEPRECATED_ACTION_TYPES
    from sentry.workflow_engine.models import Action
    from sentry.workflow_engine.registry import action_handler_registry

    variants = []
    for registered_type, handler in sorted(action_handler_registry.registrations.items()):
        action_type = Action.Type(registered_type)
        if action_type in DEPRECATED_ACTION_TYPES:
            continue

        transformer = handler.get_config_transformer()
        config_schema = transformer.api_schema if transformer is not None else handler.config_schema
        properties: dict[str, Any] = {
            "id": {"type": "string"},
            "type": {"type": "string", "enum": [action_type.value]},
            "data": _json_schema_to_openapi(handler.data_schema) or {"type": "object"},
            "config": _json_schema_to_openapi(config_schema),
            "status": {"type": "string"},
        }
        required = ["type", "data", "config"]
        if action_type.is_integration():
            properties["integrationId"] = {"type": "string"}
            required.append("integrationId")

        if action_type == Action.Type.EMAIL:
            properties["config"]["properties"]["targetIdentifier"]["description"] = (
                "The stringified Sentry User.id or Team.id. Resolve users with the organization "
                "members endpoint and teams with the organization teams endpoint. Member IDs, "
                "email addresses, team slugs, and 'me' are not accepted. Omit this field when "
                "targetType is issue_owners."
            )

        variants.append(
            {
                "title": f"{action_type.name.title()} Workflow Action",
                "type": "object",
                "properties": properties,
                "required": required,
            }
        )

    return {
        "oneOf": variants,
        "discriminator": {"propertyName": "type"},
    }


class TokenAuthExtension(OpenApiAuthenticationExtension):
    """
    Extension that adds what scopes are needed to access an endpoint to the
    OpenAPI Schema.
    """

    target_class = "sentry.api.authentication.UserAuthTokenAuthentication"
    name = "auth_token"

    def get_security_requirement(self, auto_schema: AutoSchema) -> dict[str, list[Any]]:
        scopes = set()
        for permission in auto_schema.view.get_permissions():
            for s in permission.scope_map.get(auto_schema.method, []):
                scopes.add(s)

        scope_list = sorted(scopes - GRANULAR_SCOPES)
        return {self.name: scope_list}

    def get_security_definition(
        self, auto_schema: AutoSchema
    ) -> dict[str, Any] | list[dict[str, Any]]:
        return {"type": "http", "scheme": "bearer"}


class SentryResponseSerializerExtension(OpenApiSerializerExtension):
    """
    This extension will register any Sentry Response Serializer as a component that can be used
    in an OpenAPI schema. To have the serializer schema be mapped, you must type the
    `serialize` function with a TypedDict / List.
    """

    priority = 0
    target_class = "sentry.api.serializers.base.Serializer"
    match_subclasses = True

    def get_name(self, auto_schema: AutoSchema, direction: Direction) -> str | None:
        return self.target.__name__

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> Any:
        type_hints = get_type_hints(self.target.serialize)
        if "return" not in type_hints:
            raise TypeError("Please type the return value of the serializer with a TypedDict")

        return resolve_type_hint(type_hints["return"])


class SentryInlineResponseSerializerExtension(OpenApiSerializerExtension):
    """
    This extension is used for the `inline_sentry_response_serializer` utils function
    and will simply resolve the type passed into the function to an OpenAPI schema.
    """

    priority = 0
    target_class = "sentry.apidocs.utils._RawSchema"
    match_subclasses = True

    def get_name(self, auto_schema: AutoSchema, direction: Direction) -> str | None:
        return self.target.__name__

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> Any:
        return resolve_type_hint(self.target.typeSchema)


class SentryAppIssueActionSerializerExtension(OpenApiSerializerExtension):
    target_class = "sentry.sentry_apps.api.endpoints.installation_external_issue_actions.SentryAppInstallationExternalIssueActionsSerializer"

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        schema = auto_schema._map_serializer(self.target, direction, bypass_extensions=True)
        schema["properties"]["action"]["enum"] = ["link", "create"]
        # Apps define additional form fields at the top level of the request.
        schema["additionalProperties"] = True
        return schema


class WorkflowActionSerializerExtension(OpenApiSerializerExtension):
    target_class = "sentry.workflow_engine.endpoints.validators.base.action.BaseActionValidator"

    def get_name(self, auto_schema: AutoSchema, direction: Direction) -> str:
        return "WorkflowAction"

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        return _workflow_action_schema()


class WorkflowValidatorSerializerExtension(OpenApiSerializerExtension):
    target_class = "sentry.workflow_engine.endpoints.validators.base.workflow.WorkflowValidator"

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        from sentry.workflow_engine.types import DataConditionHandler

        schema = _map_camel_case_serializer(self.target, auto_schema, direction)
        trigger_group = schema["properties"]["triggers"]
        trigger_group["allOf"] = [
            {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "logicType": {"type": "string", "enum": ["any-short"]},
                    "conditions": {
                        "type": "array",
                        "items": _condition_schema(DataConditionHandler.Group.WORKFLOW_TRIGGER),
                    },
                },
                "required": ["logicType"],
            }
        ]
        return schema


class ActionFilterValidatorSerializerExtension(OpenApiSerializerExtension):
    target_class = "sentry.workflow_engine.endpoints.validators.base.workflow.ActionFilterValidator"

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        from sentry.workflow_engine.endpoints.validators.base.action import BaseActionValidator
        from sentry.workflow_engine.types import DataConditionHandler

        schema = _map_camel_case_serializer(self.target, auto_schema, direction)
        action_component = auto_schema.resolve_serializer(BaseActionValidator(), direction)
        schema["properties"]["actions"]["items"] = action_component.ref
        schema["properties"]["conditions"]["items"] = _condition_schema(
            DataConditionHandler.Group.ACTION_FILTER
        )
        return schema


class DataConditionGroupValidatorSerializerExtension(OpenApiSerializerExtension):
    target_class = "sentry.workflow_engine.endpoints.validators.base.data_condition_group.BaseDataConditionGroupValidator"

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        return _map_camel_case_serializer(self.target, auto_schema, direction)


class DetectorValidatorSerializerExtension(OpenApiSerializerExtension):
    target_class = (
        "sentry.workflow_engine.endpoints.validators.base.detector.BaseDetectorTypeValidator"
    )

    def get_name(self, auto_schema: AutoSchema, direction: Direction) -> str:
        return "DetectorUpdateRequest" if auto_schema.method == "PUT" else "DetectorCreateRequest"

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        return _detector_schema(auto_schema, direction)


class RestrictedJsonFieldExtension(OpenApiSerializerFieldExtension):
    """
    This extension restricts Sentry's use of the JSONField to mimic a DictField.
    It comes from a change in drf-spectacular because rest_framework's JSONField actually accepts
    primative, strings, numbers and arrays. drf-spectacular patched this, but in Sentry, we want to
    ensure those fields are always given the correct type of 'object'.

    issue: https://github.com/tfranzel/drf-spectacular/issues/1095
    suggested patch: https://github.com/tfranzel/drf-spectacular/issues/1242#issuecomment-2123492057
    """

    target_class = "rest_framework.fields.JSONField"

    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.OBJECT)


# TODO: extension to do default error codes on responses.
# https://github.com/tfranzel/drf-spectacular/issues/334


class InvestigationRequestSerializerExtension(OpenApiSerializerExtension):
    """Expose the wire names without changing opaque JSON keys or runtime validation."""

    target_class = "sentry.investigations.endpoints.validators.base.StrictCamelSnakeValidator"
    match_subclasses = True

    def map_serializer(self, auto_schema: AutoSchema, direction: Direction) -> dict[str, Any]:
        schema = auto_schema._map_serializer(self.target, direction, bypass_extensions=True)
        schema["properties"] = {
            snake_to_camel_case(name): field for name, field in schema["properties"].items()
        }
        # These validators do not treat PATCH as partial: resume requires both
        # inputId and responseData, including when the latter is null.
        schema["required"] = [
            snake_to_camel_case(name)
            for name, field in self.target.fields.items()
            if field.required
        ]
        # An unconstrained JSON value already includes null. OpenAPI validators
        # such as AJV reject nullable without a type on these fields.
        for field in schema["properties"].values():
            if not any(key in field for key in ("type", "$ref", "oneOf", "anyOf", "allOf")):
                field.pop("nullable", None)
        if not schema["required"]:
            schema.pop("required")
        schema["additionalProperties"] = False
        return schema
