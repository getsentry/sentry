from abc import ABC, abstractmethod

from sentry.notifications.models.notificationaction import ActionService


class OnCallSpec(ABC):
    @property
    @abstractmethod
    def provider_slug(self):
        raise NotImplementedError

    @property
    @abstractmethod
    def action_service(self):
        raise NotImplementedError


class OpsgenieOnCallSpec(OnCallSpec):
    @property
    def provider_slug(self):
        return "opsgenie"

    @property
    def action_service(self):
        return ActionService.OPSGENIE


class PagerDutyOnCallSpec(OnCallSpec):
    @property
    def provider_slug(self):
        return "pagerduty"

    @property
    def action_service(self):
        return ActionService.PAGERDUTY
