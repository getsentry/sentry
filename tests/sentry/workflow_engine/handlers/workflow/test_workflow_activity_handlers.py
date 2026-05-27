from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.workflow_engine.registry import (
    invoke_workflow_activity_handlers,
    workflow_activity_registry,
)


class WorkflowActivityRegistryTest(TestCase):
    def setUp(self) -> None:
        self.group = self.create_group()
        self.activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_PR_CREATED.value
        )

    def test_registrants(self) -> None:
        assert "seer_activity" in workflow_activity_registry.registrations
        assert len(workflow_activity_registry.registrations) == 1

    def test_invoke_handlers(self) -> None:
        handler_a = mock.Mock()
        handler_b = mock.Mock()

        with mock.patch.dict(
            workflow_activity_registry.registrations,
            {"handler_a": handler_a, "handler_b": handler_b},
            clear=True,
        ):
            invoke_workflow_activity_handlers(self.group, self.activity)

        handler_a.assert_called_once_with(self.group, self.activity)
        handler_b.assert_called_once_with(self.group, self.activity)

    def test_invoke_handlers_no_registrants(self) -> None:
        with mock.patch.dict(workflow_activity_registry.registrations, {}, clear=True):
            invoke_workflow_activity_handlers(self.group, self.activity)
