from unittest.mock import Mock, patch

from sentry.apidocs.extensions import (
    WorkflowActionSerializerExtension,
    _condition_schema,
    _metric_condition_schema,
    _metric_config_schema,
)
from sentry.incidents.grouptype import MetricIssueDetectorSettings
from sentry.workflow_engine.endpoints.serializers.response_schemas import (
    condition_comparison_sources,
)
from sentry.workflow_engine.endpoints.validators.base.action import BaseActionValidator
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler


def test_workflow_action_openapi_schema_documents_public_contract() -> None:
    schema = WorkflowActionSerializerExtension(BaseActionValidator).map_serializer(
        Mock(), "request"
    )
    variants = {variant["properties"]["type"]["enum"][0]: variant for variant in schema["oneOf"]}

    assert "plugin" not in variants

    email = variants["email"]
    assert "integrationId" not in email["properties"]
    assert email["properties"]["config"]["properties"]["targetIdentifier"]["nullable"]
    assert email["properties"]["config"]["properties"]["targetType"] == {
        "type": "string",
        "enum": ["user", "team", "issue_owners"],
    }
    assert (
        "organization members endpoint"
        in email["properties"]["config"]["properties"]["targetIdentifier"]["description"]
    )

    slack = variants["slack"]
    assert slack["properties"]["integrationId"] == {"type": "string"}
    assert "integrationId" in slack["required"]

    pagerduty_data = variants["pagerduty"]["properties"]["data"]
    assert pagerduty_data["additionalProperties"] is False
    assert "additionalProperties" not in pagerduty_data["properties"]


def test_metric_detector_openapi_schema_documents_variants() -> None:
    config_schema = _metric_config_schema(MetricIssueDetectorSettings.config_schema)
    configs = {
        variant["properties"]["detectionType"]["enum"][0]: variant
        for variant in config_schema["oneOf"]
    }

    assert set(configs) == {"static", "percent", "dynamic"}
    assert configs["percent"]["properties"]["comparisonDelta"]["enum"] == [
        300,
        900,
        3600,
        86400,
        604800,
        2592000,
    ]

    condition_schema = _metric_condition_schema()
    threshold, anomaly = condition_schema["oneOf"]
    assert threshold["properties"]["type"]["enum"] == ["gt", "lt", "gte", "lte"]
    assert anomaly["properties"]["comparison"]["required"] == [
        "sensitivity",
        "seasonality",
        "thresholdType",
    ]


def test_workflow_condition_openapi_schema_documents_registered_conditions() -> None:
    trigger_schema = _condition_schema(DataConditionHandler.Group.WORKFLOW_TRIGGER)
    filter_schema = _condition_schema(DataConditionHandler.Group.ACTION_FILTER)
    trigger_types = {
        variant["properties"]["type"]["enum"][0] for variant in trigger_schema["oneOf"]
    }
    filter_types = {variant["properties"]["type"]["enum"][0] for variant in filter_schema["oneOf"]}

    assert "first_seen_event" in trigger_types
    assert "seer_activity_trigger" in trigger_types
    assert "age_comparison" in filter_types
    assert "issue_priority_greater_or_equal" in filter_types
    assert "issue_priority_equals" not in filter_types
    assert "issue_open_duration" not in filter_types


def test_condition_schemas_exclude_internal_handlers() -> None:
    handler = condition_handler_registry.get(Condition.FIRST_SEEN_EVENT)
    with patch.object(handler, "is_internal", True):
        trigger_schema = _condition_schema(DataConditionHandler.Group.WORKFLOW_TRIGGER)
        comparison_sources = dict(condition_comparison_sources())

    trigger_types = {
        variant["properties"]["type"]["enum"][0] for variant in trigger_schema["oneOf"]
    }
    assert Condition.FIRST_SEEN_EVENT not in trigger_types
    assert Condition.FIRST_SEEN_EVENT not in comparison_sources
    assert Condition.SEER_ACTIVITY_TRIGGER in trigger_types
    assert Condition.SEER_ACTIVITY_TRIGGER in comparison_sources
