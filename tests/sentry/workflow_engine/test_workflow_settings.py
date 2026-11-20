import pytest

from sentry.workflow_engine.registry import workflow_settings_registry
from sentry.workflow_engine.types import WorkflowType


@pytest.mark.parametrize("workflow_type", list(WorkflowType))
def test_every_workflow_type_is_registered(workflow_type: WorkflowType) -> None:
    assert workflow_type.value in workflow_settings_registry.registrations
