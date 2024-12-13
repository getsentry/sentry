from unittest import mock

import pytest

from sentry.integrations.example import ExampleIntegration
from sentry.integrations.models import ExternalIssue, Integration
from sentry.integrations.tasks import sync_assignee_outbound
from sentry.integrations.types import EventLifecycleOutcome
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.services.user import RpcUser


def raise_sync_assignee_exception(*args, **kwargs):
    raise Exception("Something went wrong")


class TestSyncAssigneeOutbound(TestCase):
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
    @mock.patch.object(ExampleIntegration, "sync_assignee_outbound")
    def test_syncs_outbound_assignee(self, mock_sync_assignee, mock_record_event):
        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-1234",
            integration=self.example_integration,
        )

        sync_assignee_outbound(external_issue.id, self.user.id, True, None)
        mock_sync_assignee.assert_called_once()
        mock_sync_assignee.assert_called_with(
            external_issue, mock.ANY, assign=True, assignment_source=None
        )

        user_arg = mock_sync_assignee.call_args_list[0][0][1]
        assert isinstance(user_arg, RpcUser)
        assert user_arg.id == self.user.id

        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_failure")
    @mock.patch.object(ExampleIntegration, "sync_assignee_outbound")
    def test_sync_failure(self, mock_sync_assignee, mock_record_failure):
        mock_sync_assignee.side_effect = raise_sync_assignee_exception

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-1234",
            integration=self.example_integration,
        )

        with pytest.raises(Exception) as exc:
            sync_assignee_outbound(external_issue.id, self.user.id, True, None)

        assert exc.match("Something went wrong")
        mock_record_failure.assert_called_once()
        mock_record_failure_args = mock_record_failure.call_args_list[0][0]
        assert mock_record_failure_args[0] is not None

        metric_exception = mock_record_failure_args[0]
        assert isinstance(metric_exception, Exception)
        assert metric_exception.args[0] == "Something went wrong"

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "sync_assignee_outbound")
    @mock.patch.object(ExampleIntegration, "should_sync")
    def test_skips_syncing_if_should_sync_false(
        self, mock_should_sync, mock_sync_assignee, mock_record_event
    ):
        mock_should_sync.return_value = False
        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-1234",
            integration=self.example_integration,
        )

        sync_assignee_outbound(external_issue.id, self.user.id, True, None)
        mock_sync_assignee.assert_not_called()

        assert mock_record_event.call_count == 2
        start, success = mock_record_event.mock_calls
        assert start.args == (EventLifecycleOutcome.STARTED,)
        assert success.args == (EventLifecycleOutcome.SUCCESS, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "sync_assignee_outbound")
    def test_missing_issue_sync(self, mock_sync_assignee, mock_record_event):
        # The default test integration does not support issue sync,
        # so creating an external issue for this integration should
        # be enough to test this functionality.
        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-1234",
            integration=self.integration,
        )

        sync_assignee_outbound(external_issue.id, self.user.id, True, None)
        mock_sync_assignee.assert_not_called()

        # We don't want to log halt/failure metrics for these as it will taint
        # all non-sync integrations' metrics.
        assert mock_record_event.call_count == 2
        start, success = mock_record_event.mock_calls
        assert start.args == (EventLifecycleOutcome.STARTED,)
        assert success.args == (EventLifecycleOutcome.SUCCESS, None)

    @mock.patch.object(ExampleIntegration, "sync_assignee_outbound")
    def test_missing_integration_installation(self, mock_sync_assignee):
        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-1234",
            integration=self.example_integration,
        )

        # Delete all integrations, but ensure we still have an external issue
        with assume_test_silo_mode_of(Integration):
            Integration.objects.filter().delete()

        assert ExternalIssue.objects.filter(id=external_issue.id).exists()
        sync_assignee_outbound(external_issue.id, self.user.id, True, None)
        mock_sync_assignee.assert_not_called()
