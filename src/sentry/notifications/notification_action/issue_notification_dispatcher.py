from sentry.incidents.grouptype import MetricIssue
from sentry.models.activity import Activity
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.notifications.notification_action.utils import (
    issue_notification_data_factory,
    metric_alert_notification_data_factory,
)
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.threading import ThreadingOptions, ThreadKey
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationSource,
    NotificationTarget,
    NotificationTargetResourceType,
)
from sentry.notifications.utils.issue_notification_context import IssueNotificationContext
from sentry.workflow_engine.types import ActionInvocation


class NotificationDispatcherError(Exception):
    pass


NOTIFICATION_PLATFORM_ENABLED_PROVIDERS = {
    NotificationProviderKey.SLACK,
    NotificationProviderKey.DISCORD,
}


class IssueNotificationDispatcher:
    def __init__(self, invocation: ActionInvocation):
        self.invocation = invocation
        self.issue_notification_context = IssueNotificationContext(invocation)

    def should_send_via_notification_platform(self) -> bool:
        if not self.invocation.action.type:
            return False

        if self.invocation.action.type not in NOTIFICATION_PLATFORM_ENABLED_PROVIDERS:
            return False

        return NotificationService.has_access(
            self.issue_notification_context.organization, NotificationSource.METRIC_ALERT
        )

    def dispatch(self) -> None:
        if not self.should_send_via_notification_platform():
            raise NotificationDispatcherError("Notification platform not enabled for this action")

        #  Handling for metric and issue alerts differ for now, but eventually
        #  should have only a single notification type that handles all issue data.
        if self._is_metric_issue_action_invocation():
            self._dispatch_metric_alert()
        else:
            self._dispatch_issue_alert()

    # Dispatch methods for each notification type
    def _dispatch_metric_alert(self) -> None:
        metric_alert_notification_data = metric_alert_notification_data_factory(
            self.issue_notification_context
        )
        notification_service = NotificationService(data=metric_alert_notification_data)
        thread_key = self._get_metric_alert_thread_key()
        threading_options = ThreadingOptions(thread_key=thread_key)
        target = self._extract_notification_target()
        notification_service.notify_sync(targets=[target], threading_options=threading_options)

    def _dispatch_issue_alert(self) -> None:
        issue_notification_data = issue_notification_data_factory(self.invocation)
        notification_service = NotificationService(data=issue_notification_data)
        target = self._extract_notification_target()
        threading_options = ThreadingOptions(
            thread_key=self._get_issue_alert_thread_key(), reply_broadcast=False
        )
        notification_service.notify_sync(targets=[target], threading_options=threading_options)

    # General helper methods
    def _extract_notification_target(self) -> NotificationTarget:
        return IntegrationNotificationTarget(
            provider_key=self.issue_notification_context.action_type,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id=self.issue_notification_context.notification_context.target_identifier,
            integration_id=self.issue_notification_context.notification_context.integration_id,
            organization_id=self.issue_notification_context.organization.id,
        )

    def _is_metric_issue_action_invocation(self) -> bool:
        if not self._is_activity_action_invocation():
            return False

        event = self.invocation.event_data.event
        # Appease the type checker, but we're guaranteed for this to be true
        assert isinstance(event, Activity)

        is_supported_activity_notification = (
            event.type in BaseMetricAlertHandler.ACTIVITIES_TO_INVOKE_ON
        )
        is_metric_issue = self.invocation.event_data.group.type == MetricIssue.type_id
        # TODO: Double check that this assumption is correct. The notification
        #  paths currently used in the legacy path appears to be mostly the same.
        created_by_metric_detector = self.invocation.detector.type == MetricIssue.slug

        return is_supported_activity_notification and (
            is_metric_issue or created_by_metric_detector
        )

    def _is_activity_action_invocation(self) -> bool:
        return isinstance(self.invocation.event_data.event, Activity)

    def _is_issue_action_invocation(self) -> bool:
        return not self._is_activity_action_invocation()

    # Thread key generating methods
    def _get_issue_alert_thread_key(self) -> ThreadKey:
        return ThreadKey(
            key_type=NotificationSource.ISSUE,
            key_data={
                "action_id": self.invocation.action.id,  # debatable whether we should use actionID as part of the key
                "group_id": self.issue_notification_context.group.id,
            },
        )

    def _get_metric_alert_thread_key(self) -> ThreadKey:
        return ThreadKey(
            key_type=NotificationSource.METRIC_ALERT,
            key_data={
                "open_period_start": self.issue_notification_context.open_period_context.date_started.isoformat(),
                "action_id": self.invocation.action.id,
                "group_id": self.issue_notification_context.group.id,
            },
        )
