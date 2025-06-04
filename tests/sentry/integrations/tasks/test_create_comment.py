from unittest import mock

import pytest

from sentry.integrations.example import ExampleIntegration
from sentry.integrations.models import ExternalIssue, Integration
from sentry.integrations.tasks import create_comment
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.activity import Activity
from sentry.testutils.asserts import assert_failure_metric, assert_slo_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.types.activity import ActivityType


def raise_create_comment_exception(*args, **kwargs):
    raise Exception("Something went wrong creating comment")


class TestCreateComment(TestCase):
    def setUp(self):
        self.example_integration = self.create_integration(
            organization=self.group.organization,
            external_id="123456",
            provider="example",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )
        self.activity = Activity.objects.create(
            group=self.group,
            project=self.project,
            type=ActivityType.NOTE.value,
            data={"text": "Test comment"},
        )

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "create_comment")
    def test_creates_comment(self, mock_create_comment, mock_record_event):
        mock_create_comment.return_value = {"id": "123"}

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-1234",
            integration=self.example_integration,
        )

        create_comment(external_issue.id, self.user.id, self.activity.id)

        mock_create_comment.assert_called_once_with(external_issue.key, self.user.id, self.activity)

        # Verify the activity was updated with the external comment ID
        updated_activity = Activity.objects.get(id=self.activity.id)
        assert updated_activity.data["external_id"] == "123"

        assert_slo_metric(mock_record_event, EventLifecycleOutcome.SUCCESS)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "create_comment")
    def test_missing_external_issue(self, mock_create_comment, mock_record_event):
        create_comment(999999, self.user.id, self.activity.id)
        mock_create_comment.assert_not_called()

        # No events should be recorded, since we don't record events for missing external issues
        assert len(mock_record_event.mock_calls) == 0

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "create_comment")
    def test_missing_activity(self, mock_create_comment, mock_record_event):
        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-1234",
            integration=self.example_integration,
        )

        create_comment(external_issue.id, self.user.id, 999999)
        mock_create_comment.assert_not_called()

        # No events should be recorded, since we don't record events for missing activities
        assert len(mock_record_event.mock_calls) == 0

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "create_comment")
    def test_missing_integration_installation(self, mock_create_comment, mock_record_event):
        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-1234",
            integration=self.example_integration,
        )

        # Delete all integrations, but ensure we still have an external issue
        with assume_test_silo_mode_of(Integration):
            Integration.objects.filter().delete()

        assert ExternalIssue.objects.filter(id=external_issue.id).exists()

        create_comment(external_issue.id, self.user.id, self.activity.id)
        mock_create_comment.assert_not_called()

        # No events should be recorded, since we don't record events for missing integrations
        assert len(mock_record_event.mock_calls) == 0

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "create_comment")
    def test_comment_sync_disabled(self, mock_create_comment, mock_record_event):
        # Create integration with sync_comments disabled
        integration = self.create_integration(
            organization=self.group.organization,
            external_id="654321",
            provider="example",
            oi_params={
                "config": {
                    "sync_comments": False,
                }
            },
        )

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-1234",
            integration=integration,
        )

        create_comment(external_issue.id, self.user.id, self.activity.id)
        mock_create_comment.assert_not_called()

        # No events should be recorded, since we don't record events for disabled syncs
        assert len(mock_record_event.mock_calls) == 0

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "create_comment")
    def test_create_comment_failure(self, mock_create_comment, mock_record_event):
        mock_create_comment.side_effect = raise_create_comment_exception

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-1234",
            integration=self.example_integration,
        )

        with pytest.raises(Exception) as exc:
            create_comment(external_issue.id, self.user.id, self.activity.id)

        assert exc.match("Something went wrong creating comment")

        assert_failure_metric(mock_record_event, Exception("Something went wrong creating comment"))
