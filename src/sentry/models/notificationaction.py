from __future__ import annotations

import logging
from collections import defaultdict
from enum import IntEnum
from typing import Callable, Dict, Iterable, List, Tuple

from django.db import models
from pyparsing import MutableMapping

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.db.models.base import region_silo_only_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey

logger = logging.getLogger(__name__)


class FlexibleIntEnum(IntEnum):
    @classmethod
    def as_choices(cls) -> Iterable[Tuple[int, str]]:
        raise NotImplementedError

    @classmethod
    def get_name(cls, value: int) -> str | None:
        return dict(cls.as_choices()).get(value)

    @classmethod
    def get_value(cls, name: str) -> int | None:
        invert_choices = {v: k for k, v in cls.as_choices()}
        return invert_choices.get(name)


class ActionService(FlexibleIntEnum):
    """
    The available services to fire action notifications
    """

    EMAIL = 0
    PAGERDUTY = 1
    SLACK = 2
    MSTEAMS = 3
    SENTRY_APP = 4
    SENTRY_NOTIFICATION = 5  # Use personal notification platform (src/sentry/notifications)

    @classmethod
    def as_choices(cls) -> Iterable[Tuple[int, str]]:
        return (
            (cls.EMAIL.value, "email"),
            (cls.PAGERDUTY.value, "pagerduty"),
            (cls.SLACK.value, "slack"),
            (cls.MSTEAMS.value, "msteams"),
            (cls.SENTRY_APP.value, "sentry_app"),
            (cls.SENTRY_NOTIFICATION.value, "sentry_notification"),
        )


class ActionTarget(FlexibleIntEnum):
    """
    Explains the contents of target_identifier
    """

    # The target_identifier is a direct reference used by the service (e.g. email address, slack channel id)
    SPECIFIC = 0
    # The target_identifier is an id from the User model in Sentry
    USER = 1
    # The target_identifier is an id from the Team model in Sentry
    TEAM = 2
    # The target_identifier is an id from the SentryApp model in Sentry
    SENTRY_APP = 3

    @classmethod
    def as_choices(cls) -> Iterable[Tuple[int, str]]:
        return (
            (cls.SPECIFIC.value, "specific"),
            (cls.USER.value, "user"),
            (cls.TEAM.value, "team"),
            (cls.SENTRY_APP.value, "sentry_app"),
        )


class AbstractNotificationAction(Model):
    """
    Abstract model meant to retroactively create a contract for notification actions
    (e.g. metric alerts, spike protection, etc.)
    """

    integration = FlexibleForeignKey("sentry.Integration", null=True)
    sentry_app = FlexibleForeignKey("sentry.SentryApp", null=True)

    # The type of service which will receive the action notification (e.g. slack, pagerduty, etc.)
    type = models.SmallIntegerField(choices=ActionService.as_choices())
    # The type of target which the service uses for routing (e.g. user, team)
    target_type = models.SmallIntegerField(choices=ActionTarget.as_choices())
    # Identifier of the target for the given service (e.g. slack channel id, pagerdutyservice id)
    target_identifier = models.TextField(null=True)
    # User-friendly name of the target (e.g. #slack-channel, pagerduty-service-name)
    target_display = models.TextField(null=True)

    @property
    def service_type(self) -> int:
        """
        Used for disambiguity of self.type
        """
        return self.type

    class Meta:
        abstract = True


class ActionTrigger(FlexibleIntEnum):
    """
    The possible sources of action notifications.
    Use values less than 100 here to avoid conflicts with getsentry's trigger values.
    """

    AUDIT_LOG = 0

    @classmethod
    def as_choices(cls) -> Iterable[Tuple[int, str]]:
        return ((cls.AUDIT_LOG.value, "audit-log"),)


class TriggerGenerator:
    """
    Allows NotificationAction.trigger_type to enforce extra triggers via
    NotificationAction.register_trigger_type
    """

    def __iter__(self):
        yield from NotificationAction._trigger_types


@region_silo_only_model
class NotificationActionProject(Model):
    __include_in_export__ = True

    project = FlexibleForeignKey("sentry.Project")
    action = FlexibleForeignKey("sentry.NotificationAction")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationactionproject"


@region_silo_only_model
class NotificationAction(AbstractNotificationAction):
    """
    Generic notification action model to programmatically route depending on the trigger (or source) for the notification
    """

    __include_in_export__ = True
    __repr__ = sane_repr("id", "trigger_type", "service_type", "target_display")

    _handlers: MutableMapping[int, MutableMapping[int, Callable]] = defaultdict(dict)
    _trigger_types: List[Tuple[int, str]] = ActionTrigger.as_choices()

    organization = FlexibleForeignKey("sentry.Organization")
    projects = models.ManyToManyField("sentry.Project", through=NotificationActionProject)
    # TODO(Leander): After adding HybridCloudForeignKeys to AlertRuleTriggerAction, we can remove these lines
    integration = None
    integration_id = HybridCloudForeignKey(
        "sentry.Integration", blank=True, null=True, on_delete="CASCADE"
    )
    sentry_app = None
    sentry_app_id = HybridCloudForeignKey(
        "sentry.SentryApp", blank=True, null=True, on_delete="CASCADE"
    )

    # The type of trigger which controls when the actions will go off (e.g. spike-protection)
    trigger_type = models.SmallIntegerField(choices=TriggerGenerator())

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationaction"

    @classmethod
    def register_trigger_type(
        cls,
        value: int,
        display_text: str,
    ):
        """
        This method is used for adding trigger types to this model from getsentry.
        If the trigger is relevant to sentry as well, directly modify ActionTrigger.
        """
        cls._trigger_types: List[Tuple[int, str]] = cls._trigger_types + ((value, display_text),)

    @classmethod
    def register_handler(
        cls,
        trigger_type: int,
        service_type: int,
    ):
        def inner(handler):
            if service_type not in cls._handlers[trigger_type]:
                cls._handlers[trigger_type][service_type] = handler
            else:
                raise AttributeError(
                    f"Conflicting handler for trigger:service pair ({trigger_type}:{service_type})"
                )
            return handler

        return inner

    @classmethod
    def get_handlers(cls):
        return cls._handlers

    @classmethod
    def get_trigger_types(cls):
        return cls._trigger_types

    @classmethod
    def get_trigger_text(self, trigger_type: int) -> str:
        return dict(NotificationAction.get_trigger_types())[trigger_type]

    def get_audit_log_data(self) -> Dict[str, str]:
        """
        Returns audit log data for NOTIFICATION_ACTION_ADD, NOTIFICATION_ACTION_EDIT
        and NOTIFICATION_ACTION_REMOVE events
        """
        return {"trigger": NotificationAction.get_trigger_text(self.trigger_type)}

    def fire(self, *args, **kwargs):
        handler = NotificationAction._handlers[self.trigger_type].get(self.service_type)
        if handler:
            return handler(action=self, *args, **kwargs)
        else:
            logger.error(
                "missing_handler",
                extra={
                    "id": self.id,
                    "service_type": self.service_type,
                    "trigger_type": self.trigger_type,
                },
            )
