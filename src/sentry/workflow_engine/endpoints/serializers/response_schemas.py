"""
API response schemas for workflow engine fields whose shape depends on a registry.

Each one is built from the JSON Schemas the workflow engine validates the data with:
condition handlers' `comparison_json_schema`, action handlers' `config_schema` and
detector types' `config_schema`. So a new handler or detector type, or a change to one
of their schemas, shows up in the API schema without a hand-written copy. The source
schemas leave most properties undescribed, so the maps below describe them. A new
property without a description fails `make build-api-docs`.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.apidocs.json_schemas import to_response_schema, union_schema

_MATCH = "How to compare, such as eq for equals, co for contains or is for is set"
_FILTER_DESCRIPTIONS = {
    "filters": "Tag or attribute filters that events must match to count",
    "filters[].key": "Tag key to match",
    "filters[].attribute": "Event attribute to match, such as message or user.email",
    "filters[].match": _MATCH,
    "filters[].value": "Value to compare the tag or attribute against. Not set for is and ns",
    "interval": "Time window to count in, such as 1h",
    "comparison_interval": "Earlier time window to compare the count against, such as 1w",
}
_CONDITION_DESCRIPTIONS: dict[str, dict[str, str]] = {
    "age_comparison": {
        "comparison_type": "Whether the issue must be older or newer than the age",
        "value": "Age of the issue, in units of time",
        "time": "Unit of the age",
    },
    "anomaly_detection": {
        "sensitivity": "How sensitive anomaly detection is",
        "seasonality": "Seasonal pattern that anomaly detection accounts for",
        "threshold_type": "Anomalies to detect: 0 above, 1 below, 2 above or below the expected value",
    },
    "assigned_to": {
        "target_type": "Who the issue must be assigned to",
        "target_identifier": "ID of the team or member. Not set for Unassigned",
    },
    "event_attribute": {
        "attribute": "Event attribute to match, such as message or user.email",
        "match": _MATCH,
        "value": "Value to compare the attribute against. Not set for is and ns",
    },
    "tagged_event": {
        "key": "Tag key to match",
        "match": _MATCH,
        "value": "Value to compare the tag against. Not set for is and ns",
    },
    "event_frequency_count": {
        **_FILTER_DESCRIPTIONS,
        "value": "Number of events in the interval that meets the condition",
    },
    "event_frequency_percent": {
        **_FILTER_DESCRIPTIONS,
        "value": "Percent increase in events over the comparison interval that meets the condition",
    },
    "event_unique_user_frequency_count": {
        **_FILTER_DESCRIPTIONS,
        "value": "Number of affected users in the interval that meets the condition",
    },
    "event_unique_user_frequency_percent": {
        **_FILTER_DESCRIPTIONS,
        "value": "Percent increase in affected users over the comparison interval that meets the condition",
    },
    "percent_sessions_count": {
        **_FILTER_DESCRIPTIONS,
        "value": "Percent of sessions affected in the interval that meets the condition",
    },
    "percent_sessions_percent": {
        **_FILTER_DESCRIPTIONS,
        "value": "Percent increase in affected sessions over the comparison interval that meets the condition",
    },
    "issue_category": {
        "value": "ID of the issue category",
        "include": "Whether the issue must be in the category or not. Defaults to true",
    },
    "issue_type": {
        "value": "Slug of the issue type",
        "include": "Whether the issue must be of the type or not. Defaults to true",
    },
    "issue_occurrences": {"value": "Number of times the issue must have occurred"},
    "latest_adopted_release": {
        "release_age_type": "Whether to compare against the oldest or newest adopted release",
        "age_comparison": "Whether the event's release must be older or newer than that release",
        "environment": "Environment the release was adopted in",
    },
    "level": {
        "level": "Event level: 0 sample, 10 debug, 20 info, 30 warning, 40 error, 50 fatal",
        "match": "How to compare the event's level: eq, gte or lte",
    },
}
# Operator conditions, such as gt or eq on a monitor, compare against a plain value.
OPERATOR_COMPARISON_SCHEMA = {
    "anyOf": [{"type": "number"}, {"type": "string"}, {"type": "boolean"}]
}

_ACTION_CONFIG_DESCRIPTIONS = {
    "target_type": "Kind of target the action notifies, such as specific, user or team",
    "target_identifier": "ID of the target, such as a channel, user or team ID",
    "target_display": "Display name of the target, such as a channel name",
}

_ACTION_DATA_DESCRIPTIONS = {
    "settings": "Values of the Sentry App's alert rule settings form, each with a name and value",
    "additional_fields.repo": "Repository to create the issue in, as owner/name",
    "additional_fields.labels": "Labels to add to the issue",
    "additional_fields.assignee": "User to assign the issue to",
}

# The data schemas leave these open. The ticket rule form and the legacy alert rule
# actions that actions are migrated from pin them down, so the API schema does too.
_TICKET_FORM_FIELD: dict[str, Any] = {
    "type": "object",
    "description": "A field of the ticket form, as the integration's issue config defines it",
    "properties": {
        "name": {"type": "string", "description": "Name of the field"},
        "label": {"type": "string", "description": "Label of the field"},
        "type": {"type": "string", "description": "Type of the field, such as select or text"},
    },
}
_TICKET_FIELD_VALUE: dict[str, Any] = {
    "anyOf": [
        # Validators ignore `nullable` next to `anyOf`, so it sits on a branch.
        {"type": "string", "nullable": True},
        {"type": "number"},
        {"type": "boolean"},
        {"type": "array", "items": {"anyOf": [{"type": "string"}, {"type": "number"}]}},
    ],
    "description": "Value of the ticket form field with this name",
}
# Plugin and webhook actions have no data schema. They keep the string settings of the
# legacy rule action they were migrated from, if any.
_LEGACY_ACTION_DATA: dict[str, Any] = {
    "type": "object",
    "description": "Settings of the legacy alert rule action the action was migrated from",
    "additionalProperties": {"type": "string"},
}

_DETECTOR_CONFIG_DESCRIPTIONS: dict[str, dict[str, str]] = {
    "issue_stream": {"organization_id": "ID of the organization"},
    "metric_issue": {
        "comparison_delta": "For percent detection, how far back the compared window is, in seconds",
        "detection_type": "How the monitor detects issues: static thresholds, percent change or dynamic anomalies",
    },
    "uptime_domain_failure": {
        "mode": "How the monitor was created: 1 manually, 2 auto-detected and onboarding, 3 auto-detected and active",
        "environment": "Environment of the monitor. Null for none",
    },
}
# Error detectors serialize project options rather than their own config.
_ERROR_DETECTOR_OPTIONS: dict[str, dict[str, Any]] = {
    "sentry:fingerprinting_rules": {
        "type": "string",
        "description": "Fingerprinting rules of the project",
    },
    "sentry:resolve_age": {
        "type": "integer",
        "description": "Hours of inactivity after which the project's issues resolve. 0 to never",
    },
}
EMPTY_DETECTOR_CONFIG_SCHEMA = {
    "type": "object",
    "maxProperties": 0,
    "description": "Empty for monitor types without configuration",
}


def condition_comparison_sources() -> list[tuple[str, Mapping[str, Any]]]:
    """Every registered condition handler's comparison JSON Schema, by condition type."""
    from sentry.workflow_engine.registry import condition_handler_registry

    return [
        (str(name), handler.comparison_json_schema)
        for name, handler in sorted(condition_handler_registry.registrations.items())
    ]


def action_config_sources(*, api: bool) -> list[tuple[str, Mapping[str, Any]]]:
    """
    Every registered action handler's config JSON Schema, by action type. With `api`, the
    schema of the config the API returns, which the handler's config transformer defines.
    """
    from sentry.workflow_engine.registry import action_handler_registry

    sources: list[tuple[str, Mapping[str, Any]]] = []
    for action_type, handler in sorted(action_handler_registry.registrations.items()):
        transformer = handler.get_config_transformer() if api else None
        sources.append(
            (str(action_type), transformer.api_schema if transformer else handler.config_schema)
        )
    return sources


def action_data_sources() -> list[tuple[str, Mapping[str, Any]]]:
    """Every registered action handler's data JSON Schema, by action type."""
    from sentry.workflow_engine.registry import action_handler_registry

    return [
        (str(action_type), handler.data_schema)
        for action_type, handler in sorted(action_handler_registry.registrations.items())
    ]


def detector_config_sources() -> list[tuple[str, Mapping[str, Any]]]:
    """Every detector type's config JSON Schema, by group type slug."""
    from sentry.issues.grouptype import registry

    sources: list[tuple[str, Mapping[str, Any]]] = []
    for group_type in sorted(registry.all(), key=lambda group_type: group_type.slug):
        settings = group_type.detector_settings
        if settings is not None and settings.config_schema:
            sources.append((group_type.slug, settings.config_schema))
    return sources


def error_detector_options_schema() -> dict[str, Any]:
    """The project options that error detectors serialize instead of their own config."""
    from sentry.workflow_engine.models import Detector

    options = {
        option: _ERROR_DETECTOR_OPTIONS[option]
        for option in Detector.error_detector_project_options.values()
    }
    return {"type": "object", "properties": options, "additionalProperties": False}


def condition_comparison_schema() -> dict[str, Any]:
    return union_schema(
        [
            OPERATOR_COMPARISON_SCHEMA,
            *(
                to_response_schema(
                    schema,
                    descriptions=_CONDITION_DESCRIPTIONS.get(name, {}),
                    camel_case=True,
                )
                for name, schema in condition_comparison_sources()
            ),
        ]
    )


def action_config_schema() -> dict[str, Any]:
    return union_schema(
        to_response_schema(schema, descriptions=_ACTION_CONFIG_DESCRIPTIONS, camel_case=True)
        for _, schema in action_config_sources(api=True)
    )


def _pin_open_action_data(schema: dict[str, Any]) -> dict[str, Any]:
    if not schema:
        return _LEGACY_ACTION_DATA
    properties = schema.get("properties", {})
    if "dynamicFormFields" in properties:
        properties["dynamicFormFields"] = {
            **properties["dynamicFormFields"],
            "items": _TICKET_FORM_FIELD,
        }
    additional_fields = properties.get("additionalFields")
    if additional_fields is not None and not additional_fields.get("properties"):
        properties["additionalFields"] = {
            **additional_fields,
            "additionalProperties": _TICKET_FIELD_VALUE,
        }
    return schema


def action_data_schema() -> dict[str, Any]:
    return union_schema(
        _pin_open_action_data(
            to_response_schema(schema, descriptions=_ACTION_DATA_DESCRIPTIONS, camel_case=True)
        )
        for _, schema in action_data_sources()
    )


def detector_config_schema() -> dict[str, Any]:
    from sentry.grouping.grouptype import ErrorGroupType

    schemas = [
        EMPTY_DETECTOR_CONFIG_SCHEMA,
        to_response_schema(error_detector_options_schema(), camel_case=True),
    ]
    for slug, schema in detector_config_sources():
        if slug == ErrorGroupType.slug:
            continue
        schemas.append(
            to_response_schema(
                schema,
                descriptions=_DETECTOR_CONFIG_DESCRIPTIONS.get(slug, {}),
                camel_case=True,
            )
        )
    return union_schema(schemas)


def workflow_config_schema() -> dict[str, Any]:
    from sentry.workflow_engine.models import Workflow

    return to_response_schema(Workflow.config_schema, camel_case=True)
