from __future__ import annotations

from collections.abc import Generator
from dataclasses import dataclass
from logging import Logger, getLogger

from django.db.models import Q

from sentry.integrations.repository.base import (
    BaseNewNotificationMessage,
    BaseNotificationMessage,
    NotificationMessageValidationError,
)
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.notifications.models.notificationmessage import NotificationMessage

_default_logger: Logger = getLogger(__name__)


@dataclass(frozen=True)
class IssueAlertNotificationMessage(BaseNotificationMessage):
    # TODO: https://github.com/getsentry/sentry/issues/66751
    rule_fire_history: RuleFireHistory | None = None
    rule_action_uuid: str | None = None

    @classmethod
    def from_model(cls, instance: NotificationMessage) -> IssueAlertNotificationMessage:
        return IssueAlertNotificationMessage(
            id=instance.id,
            error_code=instance.error_code,
            error_details=instance.error_details,
            message_identifier=instance.message_identifier,
            parent_notification_message_id=(
                instance.parent_notification_message.id
                if instance.parent_notification_message
                else None
            ),
            rule_fire_history=instance.rule_fire_history,
            rule_action_uuid=instance.rule_action_uuid,
            date_added=instance.date_added,
        )


class NewIssueAlertNotificationMessageValidationError(NotificationMessageValidationError):
    pass


class RuleFireHistoryAndRuleActionUuidActionValidationError(
    NewIssueAlertNotificationMessageValidationError
):
    message = "both rule fire history and rule action uuid need to exist together with a reference"


@dataclass
class NewIssueAlertNotificationMessage(BaseNewNotificationMessage):
    rule_fire_history_id: int | None = None
    rule_action_uuid: str | None = None

    def get_validation_error(self) -> Exception | None:
        error = super().get_validation_error()
        if error is not None:
            return error

        if self.message_identifier is not None:
            # If a message_identifier exists, that means a successful notification happened for a rule action and fire
            # This means that neither of them can be empty
            if self.rule_fire_history_id is None or self.rule_action_uuid is None:
                return RuleFireHistoryAndRuleActionUuidActionValidationError()

        # We can create a NotificationMessage if it has both, or neither, of rule fire history and action.
        # The following is an XNOR check for rule fire history and action
        if (self.rule_fire_history_id is not None) != (self.rule_action_uuid is not None):
            return RuleFireHistoryAndRuleActionUuidActionValidationError()

        return None


class IssueAlertNotificationMessageRepository:
    """
    Repository class that is responsible for querying the data store for notification messages in relation to issue
    alerts.
    """

    _model = NotificationMessage

    def __init__(self, logger: Logger) -> None:
        self._logger: Logger = logger

    @classmethod
    def default(cls) -> IssueAlertNotificationMessageRepository:
        return cls(logger=_default_logger)

    @classmethod
    def _parent_notification_message_base_filter(cls) -> Q:
        """
        Returns the query used to filter the notification messages for parent notification messages.
        Parent notification messages are notification message instances without a parent notification message itself,
        and where the error code is null.
        """
        return Q(parent_notification_message__isnull=True, error_code__isnull=True)

    def get_parent_notification_message(
        self, rule_id: int, group_id: int, rule_action_uuid: str
    ) -> IssueAlertNotificationMessage | None:
        """
        Returns the parent notification message for a metric rule if it exists, otherwise returns None.
        Will raise an exception if the query fails and logs the error with associated data.
        """
        try:
            base_filter = self._parent_notification_message_base_filter()
            instance: NotificationMessage = (
                self._model.objects.filter(base_filter)
                .filter(
                    rule_fire_history__rule__id=rule_id,
                    rule_fire_history__group__id=group_id,
                    rule_action_uuid=rule_action_uuid,
                )
                .latest("date_added")
            )
            return IssueAlertNotificationMessage.from_model(instance=instance)
        except NotificationMessage.DoesNotExist:
            return None
        except Exception as e:
            self._logger.exception(
                "Failed to get parent notification for issue rule",
                exc_info=e,
                extra={
                    "rule_id": rule_id,
                    "group_id": group_id,
                    "rule_action_uuid": rule_action_uuid,
                },
            )
            raise

    def create_notification_message(
        self, data: NewIssueAlertNotificationMessage
    ) -> IssueAlertNotificationMessage:
        if (error := data.get_validation_error()) is not None:
            raise error

        try:
            new_instance = self._model.objects.create(
                error_details=data.error_details,
                error_code=data.error_code,
                message_identifier=data.message_identifier,
                parent_notification_message_id=data.parent_notification_message_id,
                rule_fire_history_id=data.rule_fire_history_id,
                rule_action_uuid=data.rule_action_uuid,
            )
            return IssueAlertNotificationMessage.from_model(instance=new_instance)
        except Exception as e:
            self._logger.exception(
                "failed to create new issue alert notification alert",
                exc_info=e,
                extra=data.__dict__,
            )
            raise

    def get_all_parent_notification_messages_by_filters(
        self, group_ids: list[int] | None = None, project_ids: list[int] | None = None
    ) -> Generator[IssueAlertNotificationMessage]:
        """
        If no filters are passed, then all parent notification objects are returned.

        Because an unbounded amount of parent notification objects can be returned, this method leverages generator to
        control the usage of memory in the application.
        It is up to the caller to iterate over all the data, or store in memory if they need all objects concurrently.
        """
        group_id_filter = Q(rule_fire_history__group__id__in=group_ids) if group_ids else Q()
        project_id_filter = Q(rule_fire_history__project_id__in=project_ids) if project_ids else Q()

        query = self._model.objects.filter(group_id_filter & project_id_filter).filter(
            self._parent_notification_message_base_filter()
        )

        try:
            for instance in query:
                yield IssueAlertNotificationMessage.from_model(instance=instance)
        except Exception as e:
            self._logger.exception(
                "Failed to get parent notifications on filters",
                exc_info=e,
                extra=filter.__dict__,
            )
            raise
