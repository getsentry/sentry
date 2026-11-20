import pytest

from sentry.workflow_engine.registry import WorkflowSettingsRegistry
from sentry.workflow_engine.types import WorkflowSettings, WorkflowType


def test_workflow_settings_registered_with_a_workflow_type_support_string_lookup() -> None:
    registry = WorkflowSettingsRegistry()

    registry.register(WorkflowType.ALERT)(WorkflowSettings)

    assert registry.get("alert") is WorkflowSettings


@pytest.mark.parametrize("workflow_type", ["alert", "unknown_workflow"])
def test_workflow_settings_registration_rejects_strings(workflow_type: str) -> None:
    registry = WorkflowSettingsRegistry()

    with pytest.raises(ValueError, match="must be registered with a WorkflowType member"):
        registry.register(workflow_type)(WorkflowSettings)

    assert registry.registrations == {}
