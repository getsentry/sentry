from __future__ import annotations

import abc
from typing import List

from django import forms

from sentry.models import OrganizationStatus
from sentry.rules.actions import EventAction
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service

INTEGRATION_KEY = "integration"


class IntegrationEventAction(EventAction, abc.ABC):
    """Intermediate abstract class to help DRY some event actions code."""

    @property
    @abc.abstractmethod
    def prompt(self) -> str:
        pass

    @property
    @abc.abstractmethod
    def provider(self) -> str:
        pass

    @property
    @abc.abstractmethod
    def integration_key(self) -> str:
        pass

    def is_enabled(self) -> bool:
        enabled: bool = bool(self.get_integrations())
        return enabled

    def get_integration_name(self) -> str:
        """Get the integration's name for the label."""
        integration = self.get_integration()
        if not integration:
            return "[removed]"

        _name: str = integration.name
        return _name

    def get_integrations(self) -> List[RpcIntegration]:
        return integration_service.get_integrations(
            organization_id=self.project.organization_id,
            status=OrganizationStatus.ACTIVE,
            org_integration_status=OrganizationStatus.ACTIVE,
            providers=[self.provider],
        )

    def get_integration_id(self) -> int:
        integration_id: str | None = self.get_option(self.integration_key)
        if integration_id:
            return int(integration_id)
        return 0

    def get_integration(self) -> RpcIntegration | None:
        """
        Uses the required class variables `provider` and `integration_key` with
        RuleBase.get_option to get the integration object from DB.
        """
        for integration in integration_service.get_integrations(
            organization_id=self.project.organization_id,
            status=OrganizationStatus.ACTIVE,
            org_integration_status=OrganizationStatus.ACTIVE,
            providers=[self.provider],
        ):
            if integration.id == self.get_integration_id():
                return integration
        return None

    def get_form_instance(self) -> forms.Form:
        return self.form_cls(self.data, integrations=self.get_integrations())
