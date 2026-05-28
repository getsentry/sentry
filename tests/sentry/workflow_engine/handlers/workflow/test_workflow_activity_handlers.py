from unittest import mock
from unittest.mock import MagicMock

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType
from sentry.workflow_engine.handlers.workflow.workflow_activity_handlers import (
    SEER_WORKFLOW_ACTIVITIES,
    seer_activity_handler,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.registry import (
    invoke_workflow_activity_handlers,
    workflow_activity_registry,
)
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


class WorkflowActivityRegistryTest(TestCase):
    def setUp(self) -> None:
        self.group = self.create_group()
        self.activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_PR_CREATED.value
        )

    def test_registrants(self) -> None:
        assert "seer_activity" in workflow_activity_registry.registrations
        assert len(workflow_activity_registry.registrations) == 1

    def test_invoke_handlers_safely(self) -> None:
        handler_a = mock.Mock()
        handler_b = mock.Mock(side_effect=Exception("Test error"))
        handler_c = mock.Mock()

        with mock.patch.dict(
            workflow_activity_registry.registrations,
            {"handler_a": handler_a, "handler_b": handler_b, "handler_c": handler_c},
            clear=True,
        ):
            invoke_workflow_activity_handlers(self.group, self.activity)

        handler_a.assert_called_once_with(self.group, self.activity)
        handler_b.assert_called_once_with(self.group, self.activity)
        handler_c.assert_called_once_with(self.group, self.activity)

    def test_invoke_handlers_no_registrants(self) -> None:
        with mock.patch.dict(workflow_activity_registry.registrations, {}, clear=True):
            invoke_workflow_activity_handlers(self.group, self.activity)


class SeerActivityHandlerTest(TestCase):
    def setUp(self) -> None:
        self.group = self.create_group()
        self.activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_PR_CREATED.value
        )
        self.detector = self.create_detector(type=IssueStreamGroupType.slug, project=self.project)

    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.process_workflow_activity"
    )
    def test_feature_flag_disabled(self, mock_process_workflow_activity: MagicMock) -> None:
        seer_activity_handler(self.group, self.activity)
        mock_process_workflow_activity.delay.assert_not_called()

    @with_feature("organizations:workflow-engine-evaluate-seer-activities")
    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.process_workflow_activity"
    )
    def test_all_supported_activity_types_dispatch(
        self, mock_process_workflow_activity: MagicMock
    ) -> None:
        for activity_type in SEER_WORKFLOW_ACTIVITIES:
            mock_process_workflow_activity.reset_mock()
            activity = self.create_group_activity(group=self.group, type=activity_type.value)
            seer_activity_handler(self.group, activity)
            assert mock_process_workflow_activity.delay.called, (
                f"Task not dispatched for {activity_type.value}"
            )
            mock_process_workflow_activity.delay.assert_called_once_with(
                activity_id=activity.id,
                group_id=self.group.id,
                detector_id=self.detector.id,
            )

    @with_feature("organizations:workflow-engine-evaluate-seer-activities")
    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.process_workflow_activity"
    )
    def test_skips_unsupported_activity_type(
        self, mock_process_workflow_activity: MagicMock
    ) -> None:
        activity = self.create_group_activity(group=self.group, type=ActivityType.NOTE.value)
        seer_activity_handler(self.group, activity)

        mock_process_workflow_activity.delay.assert_not_called()

    @with_feature("organizations:workflow-engine-evaluate-seer-activities")
    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.process_workflow_activity"
    )
    @mock.patch(
        "sentry.workflow_engine.models.Detector.get_issue_stream_detector_for_project",
        side_effect=Exception("DoesNotExist"),
    )
    def test_skips_when_no_issue_stream_detector(
        self, mock_get_detector: MagicMock, mock_process_workflow_activity: MagicMock
    ) -> None:
        mock_get_detector.side_effect = Detector.DoesNotExist

        seer_activity_handler(self.group, self.activity)

        mock_process_workflow_activity.delay.assert_not_called()
