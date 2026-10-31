from unittest.mock import Mock

from sentry.apidocs.extensions import WorkflowActionSerializerExtension
from sentry.workflow_engine.endpoints.validators.base.action import BaseActionValidator


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
    assert "additionalProperties" not in pagerduty_data
    assert "additionalProperties" not in pagerduty_data["properties"]
