from unittest import mock

import pytest

from sentry.integrations.example import ExampleIntegration
from sentry.integrations.models import ExternalIssue, Integration
from sentry.integrations.tasks import sync_status_outbound
from sentry.integrations.types import EventLifecycleOutcome
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized, IntegrationFormError
from sentry.taskworker.retry import RetryTaskError
from sentry.testutils.asserts import assert_count_of_metric, assert_halt_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of, region_silo_test


def raise_exception(_external_issue, _is_resolved, _group_proj_id):
    raise Exception("Something went wrong")


def raise_integration_form_error(*args, **kwargs):
    raise IntegrationFormError(field_errors={"foo": "Invalid foo provided"})


def raise_api_unauthorized_error(*args, **kwargs):
    raise ApiUnauthorized(text="auth failed")


def raise_api_not_found_error(*args, **kwargs):
    raise ApiError(
        text='{"errorMessages":["Issue does not exist or you do not have permission to see it."],"errors":{}}',
        code=404,
    )



@region_silo_test
class TestSyncStatusOutbound(TestCase):
    def setUp(self) -> None:
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
    def test_successful_outbound_sync(
        self, mock_sync_status: mock.MagicMock, mock_record_event: mock.MagicMock
    ) -> None:

        external_issue: ExternalIssue = self.create_integration_external_issue(
            group=self.group, key="foo_integration", integration=self.example_integration
        )

        sync_status_outbound(self.group.id, external_issue_id=external_issue.id)
        mock_sync_status.assert_called_once_with(external_issue, False, self.group.project_id)
        mock_record_event.assert_any_call(EventLifecycleOutcome.SUCCESS, None, False, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "sync_status_outbound")
    @mock.patch.object(ExampleIntegration, "should_sync")
    def test_should_not_sync(
        self,
        mock_should_sync: mock.MagicMock,
        mock_sync_status: mock.MagicMock,
        mock_record_event: mock.MagicMock,
    ) -> None:
        mock_should_sync.return_value = False
        external_issue: ExternalIssue = self.create_integration_external_issue(
            group=self.group, key="foo_integration", integration=self.example_integration
        )

        sync_status_outbound(self.group.id, external_issue_id=external_issue.id)
        mock_sync_status.assert_not_called()

        assert mock_record_event.call_count == 2
        start, success = mock_record_event.mock_calls
        assert start.args == (EventLifecycleOutcome.STARTED,)
        assert success.args == (EventLifecycleOutcome.SUCCESS, None, False, None)

    @mock.patch.object(ExampleIntegration, "sync_status_outbound")
    def test_missing_external_issue(self, mock_sync_status: mock.MagicMock) -> None:
        # This shouldn't be an issue, but just verify that there's no external
        # issue with this ID
        assert not ExternalIssue.objects.filter(id=5432).exists()
        sync_status_outbound(self.group.id, external_issue_id=5432)

        mock_sync_status.assert_not_called()

    @mock.patch.object(ExampleIntegration, "sync_status_outbound")
    def test_missing_integration(self, mock_sync_status: mock.MagicMock) -> None:
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
    def test_failed_sync(
        self, mock_sync_status: mock.MagicMock, mock_record_failure: mock.MagicMock
    ) -> None:
        mock_sync_status.side_effect = raise_exception
        external_issue: ExternalIssue = self.create_integration_external_issue(
            group=self.group, key="foo_integration", integration=self.example_integration
        )

        with pytest.raises(RetryTaskError):
            sync_status_outbound(self.group.id, external_issue_id=external_issue.id)

        assert mock_record_failure.call_count == 1
        mock_record_event_args = mock_record_failure.call_args_list[0][0]
        assert mock_record_event_args[0] is not None

        metric_exception = mock_record_event_args[0]
        assert isinstance(metric_exception, Exception)
        assert metric_exception.args[0] == "Something went wrong"

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "sync_status_outbound")
    def test_integration_form_error(
        self, mock_sync_status: mock.MagicMock, mock_record: mock.MagicMock
    ) -> None:
        mock_sync_status.side_effect = raise_integration_form_error
        external_issue: ExternalIssue = self.create_integration_external_issue(
            group=self.group, key="foo_integration", integration=self.example_integration
        )

        sync_status_outbound(self.group.id, external_issue_id=external_issue.id)

        #  SLOs SYNC_STATUS_OUTBOUND (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

        assert_halt_metric(
            mock_record=mock_record, error_msg=IntegrationFormError({"foo": "Invalid foo provided"})
        )

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "sync_status_outbound")
    def test_api_unauthorized_error_halts(
        self, mock_sync_status: mock.MagicMock, mock_record: mock.MagicMock
    ) -> None:
        mock_sync_status.side_effect = raise_api_unauthorized_error
        external_issue: ExternalIssue = self.create_integration_external_issue(
            group=self.group, key="foo_integration", integration=self.example_integration
        )

        sync_status_outbound(self.group.id, external_issue_id=external_issue.id)

        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

        assert_halt_metric(mock_record=mock_record, error_msg=ApiUnauthorized("auth failed"))

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(ExampleIntegration, "sync_status_outbound")
    def test_api_not_found_error_halts(
        self, mock_sync_status: mock.MagicMock, mock_record: mock.MagicMock
    ) -> None:
        """Test that 404 errors are handled gracefully and halt the sync."""
        mock_sync_status.side_effect = raise_api_not_found_error
        external_issue: ExternalIssue = self.create_integration_external_issue(
            group=self.group, key="foo_integration", integration=self.example_integration
        )

        sync_status_outbound(self.group.id, external_issue_id=external_issue.id)

        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

        assert_halt_metric(
            mock_record=mock_record,
            error_msg=ApiError(
                '{"errorMessages":["Issue does not exist or you do not have permission to see it."],"errors":{}}',
                code=404,
            ),
        )
