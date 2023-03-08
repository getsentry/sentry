from __future__ import annotations

import logging
from collections import defaultdict
from enum import IntEnum
from typing import Callable, Iterable, Tuple

from django.db import models
from pyparsing import MutableMapping

from sentry.db.models import BoundedIntegerField, FlexibleForeignKey, Model, sane_repr
from sentry.db.models.base import region_silo_only_model

logger = logging.getLogger(__name__)


class FlexibleIntEnum(IntEnum):
    @classmethod
    def as_choices(cls) -> Iterable[Tuple[int, str]]:
        raise NotImplementedError

    @classmethod
    def get_name(cls, value: int) -> str:
        return dict(cls.as_choices())[value]

    @classmethod
    def get_value(cls, name: str) -> int:
        invert_choices = {v: k for k, v in dict(cls.as_choices()).items()}
        return invert_choices[name]


class ActionTriggerType(FlexibleIntEnum):
    """
    The possible sources of action notifications
    """

    SPIKE_PROTECTION = 0  # Handlers registered in getsentry
    SPEND_ALLOCATIONS = 1  # Handlers registered in getsentry

    @classmethod
    def as_choices(cls) -> Iterable[Tuple[int, str]]:
        return (
            (cls.SPIKE_PROTECTION, "spike-protection"),
            (cls.SPEND_ALLOCATIONS, "spend-allocations"),
        )


class ActionServiceType(FlexibleIntEnum):
    """
    The available services to fire action notifications
    """

    EMAIL = 0
    PAGERDUTY = 1
    SLACK = 2
    MSTEAMS = 3
    SENTRY_APP = 4
    SENTRY = 5  # Use notification platform (src/sentry/notifications)

    @classmethod
    def as_choices(cls) -> Iterable[Tuple[int, str]]:
        return (
            (cls.EMAIL, "email"),
            (cls.PAGERDUTY, "pagerduty"),
            (cls.SLACK, "slack"),
            (cls.MSTEAMS, "msteams"),
            (cls.SENTRY_APP, "sentry_app"),
            (cls.SENTRY, "sentry"),
        )


class ActionTargetType(FlexibleIntEnum):
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
            (cls.SPECIFIC, "specific"),
            (cls.USER, "user"),
            (cls.TEAM, "team"),
            (cls.SENTRY_APP, "sentry_app"),
        )


class AbstractNotificationAction(Model):
    """
    Abstract model meant to retroactively create a contract for notification actions
    (e.g. metric alerts, spike protection, etc.)
    """

    integration = FlexibleForeignKey("sentry.Integration", null=True)
    sentry_app = FlexibleForeignKey("sentry.SentryApp", null=True)

    # The type of trigger which controls when the actions will go off (e.g. spike-protecion)
    trigger_type = BoundedIntegerField(choices=ActionTriggerType.as_choices())
    # The type of service which will receive the action notification (e.g. slack, pagerduty, etc.)
    type = BoundedIntegerField(choices=ActionServiceType.as_choices())
    # The type of target which the service uses for routing (e.g. user, team)
    target_type = BoundedIntegerField(choices=ActionTargetType.as_choices())
    # Identifier of the target for the given service (e.g. slack channel id, pagerdutyservice id)
    target_identifier = models.TextField(null=True)
    # User-friendly name of the target (e.g. #slack-channel, pagerduty-service-name)
    target_display = models.TextField(null=True)

    @property
    def service_type(self) -> ActionServiceType:
        """
        Used for disambiguity of self.type
        """
        return self.type

    class Meta:
        abstract = True


@region_silo_only_model
class NotificationAction(AbstractNotificationAction):
    """
    Generic notification action model to programmatically route depending on the trigger (or source) for the notification
    """

    __include_in_export__ = True
    __repr__ = sane_repr("id", "trigger_type", "service_type", "target_display")

    _handlers: MutableMapping[
        ActionTriggerType, MutableMapping[ActionTargetType, Callable]
    ] = defaultdict(dict)

    project = FlexibleForeignKey("sentry.Project")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_notificationaction"

    @classmethod
    def register_handler(
        cls,
        trigger_type: ActionTriggerType,
        service_type: ActionServiceType,
    ):
        def inner(handler):
            if service_type not in cls._handlers[trigger_type]:
                cls._handlers[trigger_type][service_type] = handler
            else:
                raise Exception(
                    f"Conflicting handler for trigger:service pair ({trigger_type}:{service_type})"
                )
            return handler

        return inner

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
