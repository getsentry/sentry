from abc import ABC, abstractmethod

from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.models.notificationaction import ActionService


class OnCallSpec(ABC):
    @property
    @abstractmethod
    def provider_slug(self) -> IntegrationProviderSlug:
        raise NotImplementedError

    @property
    @abstractmethod
    def action_service(self) -> ActionService:
        raise NotImplementedError


class OpsgenieOnCallSpec(OnCallSpec):
    @property
    def provider_slug(self) -> IntegrationProviderSlug:
        return IntegrationProviderSlug.OPSGENIE

    @property
    def action_service(self) -> ActionService:
        return ActionService.OPSGENIE


class PagerDutyOnCallSpec(OnCallSpec):
    @property
    def provider_slug(self) -> IntegrationProviderSlug:
        return IntegrationProviderSlug.PAGERDUTY

    @property
    def action_service(self) -> ActionService:
        return ActionService.PAGERDUTY
