from unittest import mock

import pytest
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone

from sentry.integrations.types import EventLifecycleOutcome
from sentry.notifications.models.notificationrecord import NotificationRecord
from sentry.notifications.models.notificationthread import NotificationThread
from sentry.notifications.platform.email.provider import EmailNotificationProvider
from sentry.notifications.platform.provider import SendResult, SendStatus
from sentry.notifications.platform.service import (
    NotificationDataDto,
    NotificationService,
    NotificationServiceError,
)
from sentry.notifications.platform.target import (
    GenericNotificationTarget,
    IntegrationNotificationTarget,
)
from sentry.notifications.platform.templates.data_export import DataExportFailure
from sentry.notifications.platform.threading import ThreadingOptions, ThreadKey
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationSource,
    NotificationTargetResourceType,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError
from sentry.testutils.asserts import assert_count_of_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import (
    MockNotification,
    MockNotificationTemplate,
    MockStrategy,
)


class NotificationServiceTest(TestCase):
    def setUp(self) -> None:
        self.target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id="test@example.com",
        )

        self.slack_integration = self.create_integration(
            organization=self.organization, provider="slack", external_id="ext-123"
        )
        self.integration_target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C1234567890",
            integration_id=self.slack_integration.id,
            organization_id=self.organization.id,
        )
        self.template = MockNotificationTemplate()

    def test_basic_notify(self) -> None:
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        service.notify_sync(targets=[self.target])

    @mock.patch("sentry.notifications.platform.service.logger")
    def test_validation_on_notify(self, mock_logger: mock.MagicMock) -> None:
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with pytest.raises(
            NotificationServiceError,
            match="Must provide either a strategy or targets. Strategy is preferred.",
        ):
            service.notify_sync()

        strategy = MockStrategy(targets=[])
        with pytest.raises(
            NotificationServiceError,
            match="Cannot provide both strategy and targets, only one is permitted. Strategy is preferred.",
        ):
            service.notify_sync(strategy=strategy, targets=[self.target])

        service.notify_sync(strategy=strategy)
        mock_logger.warning.assert_called_once_with(
            "Strategy '%s' did not yield targets", strategy.__class__.__name__
        )

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch("sentry.notifications.platform.email.provider.EmailNotificationProvider.send")
    def test_notify_target_calls_provider_correctly(
        self, mock_send: mock.MagicMock, mock_record: mock.MagicMock
    ) -> None:
        service = NotificationService(data=MockNotification(message="test"))
        service.notify_target(target=self.target)

        mock_send.assert_called_once()

        # SLO assertions
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, outcome_count=1)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.SUCCESS, outcome_count=1)

    @mock.patch("sentry.notifications.platform.email.provider.EmailNotificationProvider.send")
    def test_notify_sync_collects_errors(self, mock_send: mock.MagicMock) -> None:
        mock_send.return_value = SendResult(
            status=SendStatus.HALT,
            exception=IntegrationConfigurationError(message="Provider error"),
            error_code=400,
        )

        service = NotificationService(data=MockNotification(message="test"))
        errors = service.notify_sync(targets=[self.target])

        assert len(errors[NotificationProviderKey.EMAIL]) == 1
        assert errors[NotificationProviderKey.EMAIL][0].status == SendStatus.HALT
        assert str(errors[NotificationProviderKey.EMAIL][0].exception) == "Provider error"

    def test_render_template_classmethod(self) -> None:
        data = MockNotification(message="test")
        template = MockNotificationTemplate()

        result = NotificationService.render_template(
            data=data, template=template, provider=EmailNotificationProvider
        )

        assert isinstance(result, EmailMultiAlternatives)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_basic_notify_target_async(self, mock_record: mock.MagicMock) -> None:
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with self.tasks():
            service.notify_async(targets=[self.target])

        # slo asserts
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, 1)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.SUCCESS, 1)

    @mock.patch("sentry.notifications.platform.email.provider.EmailNotificationProvider.send")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_notify_target_async_with_failure(
        self, mock_record: mock.MagicMock, mock_send: mock.MagicMock
    ) -> None:
        mock_send.return_value = SendResult(
            status=SendStatus.FAILURE,
            exception=IntegrationError(message="API request failed"),
            error_code=400,
        )
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with self.tasks():
            service.notify_async(targets=[self.target])

        # slo asserts
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, 1)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.FAILURE, 1)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    def test_basic_notify_integration_target_async(
        self, mock_slack_send: mock.MagicMock, mock_record: mock.MagicMock
    ) -> None:
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with self.tasks():
            service.notify_async(targets=[self.integration_target])

        # slo asserts
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, 1)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.SUCCESS, 1)

    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_notify_integration_target_async_with_failure(
        self, mock_record: mock.MagicMock, mock_send: mock.MagicMock
    ) -> None:
        mock_send.return_value = SendResult(
            status=SendStatus.FAILURE,
            exception=IntegrationError(message="Slack API request failed"),
            error_code=400,
        )
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with self.tasks():
            service.notify_async(targets=[self.integration_target])

        # slo asserts
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, 1)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.FAILURE, 1)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    @mock.patch("sentry.notifications.platform.email.provider.EmailNotificationProvider.send")
    def test_notify_mixed_targets_async(
        self,
        mock_email_send: mock.MagicMock,
        mock_slack_send: mock.MagicMock,
        mock_record: mock.MagicMock,
    ) -> None:
        """Test sending notifications to both generic and integration targets"""
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with self.tasks():
            service.notify_async(targets=[self.target, self.integration_target])

        # slo asserts - should have 2 notifications sent
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, 2)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.SUCCESS, 2)


class NotificationDataDtoTest(TestCase):
    def test_from_dict_raises_error_without_source(self) -> None:
        serialized = {
            "data": {
                "message": "test",
            },
        }

        with pytest.raises(NotificationServiceError, match="Source is required"):
            NotificationDataDto.from_dict(serialized)

    def test_roundtrip_serialization(self) -> None:
        original_notification = MockNotification(message="roundtrip test")
        dto = NotificationDataDto(notification_data=original_notification)

        serialized = dto.to_dict()
        reconstructed_dto = NotificationDataDto.from_dict(serialized)

        assert isinstance(reconstructed_dto.notification_data, MockNotification)
        assert reconstructed_dto.notification_data.source == original_notification.source
        assert reconstructed_dto.notification_data.message == original_notification.message

    def test_from_dict_with_complex_data_types(self) -> None:
        now = timezone.now()
        data = DataExportFailure(
            error_message="Export failed",
            error_payload={"export_type": "Issues", "project": [123]},
            creation_date=now,
        )
        serialized = NotificationDataDto(notification_data=data).to_dict()
        dto = NotificationDataDto.from_dict(serialized)

        assert dto.notification_data.source == "data-export-failure"
        assert isinstance(dto.notification_data, DataExportFailure)
        assert dto.notification_data.error_message == "Export failed"
        assert dto.notification_data.error_payload == {"export_type": "Issues", "project": [123]}
        assert dto.notification_data.creation_date == now


class NotificationServiceThreadingTest(TestCase):
    """Tests for threading orchestration in NotificationService."""

    def setUp(self) -> None:
        self.slack_integration = self.create_integration(
            organization=self.organization, provider="slack", external_id="ext-threading"
        )
        self.target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C1234567890",
            integration_id=self.slack_integration.id,
            organization_id=self.organization.id,
        )
        self.threading_options = ThreadingOptions(
            thread_key=ThreadKey(
                key_type=NotificationSource.ERROR_ALERT,
                key_data={"rule_fire_history_id": 123, "rule_action_uuid": "abc-123"},
            ),
            reply_broadcast=True,
        )

    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    def test_notify_target_with_threading_first_message(self, mock_send: mock.MagicMock) -> None:
        """First message creates a new thread and record."""
        mock_send.return_value = SendResult(
            provider_message_id="1234567890.111111",
            is_threaded=True,
        )

        service = NotificationService(data=MockNotification(message="test"))
        service.notify_target(target=self.target, threading_options=self.threading_options)

        assert NotificationThread.objects.count() == 1
        thread = NotificationThread.objects.first()
        assert thread is not None
        assert thread.thread_identifier == "1234567890.111111"
        assert thread.key_type == NotificationSource.ERROR_ALERT
        assert thread.provider_key == NotificationProviderKey.SLACK
        assert thread.target_id == "C1234567890"

        assert NotificationRecord.objects.count() == 1
        record = NotificationRecord.objects.first()
        assert record is not None
        assert record.thread_id == thread.id
        assert record.message_id == "1234567890.111111"

    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    def test_notify_target_with_threading_subsequent_message(
        self, mock_send: mock.MagicMock
    ) -> None:
        """Second message links to the existing thread."""
        mock_send.return_value = SendResult(
            provider_message_id="1234567890.111111", is_threaded=True
        )
        service = NotificationService(data=MockNotification(message="first"))
        service.notify_target(target=self.target, threading_options=self.threading_options)

        # Second message should resolve the existing thread and link to it
        mock_send.return_value = SendResult(
            provider_message_id="1234567890.222222", is_threaded=True
        )
        service = NotificationService(data=MockNotification(message="second"))
        service.notify_target(target=self.target, threading_options=self.threading_options)

        assert NotificationThread.objects.count() == 1
        assert NotificationRecord.objects.count() == 2

        records = list(NotificationRecord.objects.order_by("date_added"))
        assert records[0].message_id == "1234567890.111111"
        assert records[1].message_id == "1234567890.222222"
        assert records[0].thread_id == records[1].thread_id

    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    def test_notify_target_passes_thread_context_to_provider(
        self, mock_send: mock.MagicMock
    ) -> None:
        """Provider receives ThreadContext with the resolved thread on the second message."""
        mock_send.return_value = SendResult(
            provider_message_id="1234567890.111111", is_threaded=True
        )
        service = NotificationService(data=MockNotification(message="first"))
        service.notify_target(target=self.target, threading_options=self.threading_options)

        # First call: thread_context should have thread=None (no existing thread)
        _, first_kwargs = mock_send.call_args
        first_ctx = first_kwargs["thread_context"]
        assert first_ctx is not None
        assert first_ctx.thread is None
        assert first_ctx.reply_broadcast is True

        # Second call: thread_context should have the resolved thread
        mock_send.return_value = SendResult(
            provider_message_id="1234567890.222222", is_threaded=True
        )
        service = NotificationService(data=MockNotification(message="second"))
        service.notify_target(target=self.target, threading_options=self.threading_options)

        _, second_kwargs = mock_send.call_args
        second_ctx = second_kwargs["thread_context"]
        assert second_ctx is not None
        assert second_ctx.thread is not None
        assert second_ctx.thread.thread_identifier == "1234567890.111111"

    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    def test_notify_target_without_threading_options(self, mock_send: mock.MagicMock) -> None:
        """Without threading_options, no threading DB operations happen."""
        mock_send.return_value = SendResult()

        service = NotificationService(data=MockNotification(message="test"))
        service.notify_target(target=self.target)

        mock_send.assert_called_once()
        _, kwargs = mock_send.call_args
        assert kwargs.get("thread_context") is None

        assert NotificationThread.objects.count() == 0
        assert NotificationRecord.objects.count() == 0

    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    def test_notify_target_with_threading_failure_on_existing_thread(
        self, mock_send: mock.MagicMock
    ) -> None:
        """Failed send on an existing thread stores an error record."""
        # First message succeeds and creates the thread
        mock_send.return_value = SendResult(
            provider_message_id="1234567890.111111", is_threaded=True
        )
        service = NotificationService(data=MockNotification(message="first"))
        service.notify_target(target=self.target, threading_options=self.threading_options)

        # Second message fails
        mock_send.return_value = SendResult(
            status=SendStatus.HALT,
            exception=IntegrationConfigurationError(message="channel_not_found"),
            error_code=404,
            error_details={"msg": "channel_not_found"},
        )
        service = NotificationService(data=MockNotification(message="second"))
        service.notify_target(target=self.target, threading_options=self.threading_options)

        assert NotificationThread.objects.count() == 1
        # 2 records: first success + second error
        assert NotificationRecord.objects.count() == 2

        error_record = NotificationRecord.objects.filter(message_id="").first()
        assert error_record is not None
        assert error_record.error_details == {"msg": "channel_not_found"}
        assert error_record.thread is not None

    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    def test_notify_target_with_threading_failure_on_first_message(
        self, mock_send: mock.MagicMock
    ) -> None:
        """Failed send on the first message (no thread exists) raises."""
        mock_send.return_value = SendResult(
            status=SendStatus.HALT,
            exception=IntegrationConfigurationError(message="channel_not_found"),
            error_code=404,
            error_details={"msg": "channel_not_found"},
        )

        service = NotificationService(data=MockNotification(message="test"))
        with pytest.raises(NotificationServiceError):
            service.notify_target(target=self.target, threading_options=self.threading_options)

    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    def test_notify_async_threading_end_to_end(self, mock_send: mock.MagicMock) -> None:
        """Full async flow: notify_async → task → resolve → send → store."""
        mock_send.return_value = SendResult(
            provider_message_id="1234567890.111111", is_threaded=True
        )

        service = NotificationService(data=MockNotification(message="async test"))
        with self.tasks():
            service.notify_async(targets=[self.target], threading_options=self.threading_options)

        assert NotificationThread.objects.count() == 1
        thread = NotificationThread.objects.first()
        assert thread is not None
        assert thread.thread_identifier == "1234567890.111111"

        assert NotificationRecord.objects.count() == 1
        record = NotificationRecord.objects.first()
        assert record is not None
        assert record.thread_id == thread.id

    @mock.patch(
        "sentry.integrations.slack.integration.SlackIntegration.send_notification_with_threading"
    )
    def test_full_threading_integration(self, mock_send_with_threading: mock.MagicMock) -> None:
        """
        Full service → provider → integration test, only mocking the
        integration's send method response. Sends two messages and verifies the
        second one threads onto the first.
        """
        # First message — Slack returns ts "1111111111.111111"
        mock_send_with_threading.return_value = {"ok": True, "ts": "1111111111.111111"}

        service = NotificationService(data=MockNotification(message="first"))
        service.notify_target(target=self.target, threading_options=self.threading_options)

        # Verify first call: no thread_ts (first message in thread)
        first_ctx = mock_send_with_threading.call_args.kwargs["threading_context"]
        assert first_ctx.thread_ts is None

        # Verify DB state after first message
        assert NotificationThread.objects.count() == 1
        thread = NotificationThread.objects.first()
        assert thread is not None
        assert thread.thread_identifier == "1111111111.111111"
        assert NotificationRecord.objects.count() == 1

        # Second message — Slack returns a new ts
        mock_send_with_threading.return_value = {"ok": True, "ts": "2222222222.222222"}

        service = NotificationService(data=MockNotification(message="second"))
        service.notify_target(target=self.target, threading_options=self.threading_options)

        # Verify second call: thread_ts set to first message's ts, reply_broadcast set
        second_ctx = mock_send_with_threading.call_args.kwargs["threading_context"]
        assert second_ctx.thread_ts == "1111111111.111111"
        assert second_ctx.reply_broadcast is True

        # Verify DB state: same thread, two records
        assert NotificationThread.objects.count() == 1
        assert NotificationRecord.objects.count() == 2

        records = list(NotificationRecord.objects.order_by("date_added"))
        assert records[0].message_id == "1111111111.111111"
        assert records[1].message_id == "2222222222.222222"
        assert records[0].thread_id == records[1].thread_id
