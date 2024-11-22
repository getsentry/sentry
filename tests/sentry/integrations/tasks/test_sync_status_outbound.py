from unittest import mock

import pytest

from sentry.integrations.example import ExampleIntegration
from sentry.integrations.models import ExternalIssue, Integration
from sentry.integrations.project_management.metrics import ProjectManagementHaltReason
from sentry.integrations.tasks import sync_status_outbound
from sentry.integrations.types import EventLifecycleOutcome
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of, region_silo_test


def raise_exception(_external_issue, _is_resolved, _group_proj_id):
    raise Exception("Something went wrong")


@region_silo_test
class TestSyncStatusOutbound(TestCase):
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

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "sync_status_outbound")
    def test_successful_outbound_sync(self, mock_sync_status, mock_record_event):

        external_issue: ExternalIssue = self.create_integration_external_issue(
            group=self.group, key="foo_integration", integration=self.example_integration
        )

        sync_status_outbound(self.group.id, external_issue_id=external_issue.id)
        mock_sync_status.assert_called_once_with(external_issue, False, self.group.project_id)
        mock_record_event.assert_any_call(EventLifecycleOutcome.SUCCESS, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    @mock.patch.object(ExampleIntegration, "sync_status_outbound")
    @mock.patch.object(ExampleIntegration, "should_sync")
    def test_should_not_sync(self, mock_should_sync, mock_sync_status, mock_record_halt):
        mock_should_sync.return_value = False
        external_issue: ExternalIssue = self.create_integration_external_issue(
            group=self.group, key="foo_integration", integration=self.example_integration
        )

        sync_status_outbound(self.group.id, external_issue_id=external_issue.id)
        mock_record_halt.assert_called_with(
            ProjectManagementHaltReason.SYNC_INBOUND_SYNC_SKIPPED,
            extra={"organization_id": self.organization.id, "group_id": self.group.id},
        )

        mock_sync_status.assert_not_called()

    @mock.patch.object(ExampleIntegration, "sync_status_outbound")
    def test_missing_external_issue(self, mock_sync_status):
        # This shouldn't be an issue, but just verify that there's no external
        # issue with this ID
        assert not ExternalIssue.objects.filter(id=5432).exists()
        sync_status_outbound(self.group.id, external_issue_id=5432)

        mock_sync_status.assert_not_called()

    @mock.patch.object(ExampleIntegration, "sync_status_outbound")
    def test_missing_integration(self, mock_sync_status):
        external_issue: ExternalIssue = self.create_integration_external_issue(
            group=self.group, key="foo_integration", integration=self.example_integration
        )

        with assume_test_silo_mode_of(Integration):
            Integration.objects.filter().delete()

        assert ExternalIssue.objects.filter(id=external_issue.id).exists()
        sync_status_outbound(self.group.id, external_issue_id=external_issue.id)
        mock_sync_status.assert_not_called()

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_failure")
    @mock.patch.object(ExampleIntegration, "sync_status_outbound")
    def test_failed_sync(self, mock_sync_status, mock_record_failure):
        mock_sync_status.side_effect = raise_exception
        external_issue: ExternalIssue = self.create_integration_external_issue(
            group=self.group, key="foo_integration", integration=self.example_integration
        )

        with pytest.raises(Exception) as exc:
            sync_status_outbound(self.group.id, external_issue_id=external_issue.id)

        assert exc.match("Something went wrong")

        assert mock_record_failure.call_count == 1
        mock_record_event_args = mock_record_failure.call_args_list[0][0]
        assert mock_record_event_args[0] is not None

        metric_exception = mock_record_event_args[0]
        assert isinstance(metric_exception, Exception)
        assert metric_exception.args[0] == "Something went wrong"
