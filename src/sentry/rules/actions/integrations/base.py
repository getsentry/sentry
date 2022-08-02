from __future__ import annotations

import abc
from typing import Any

from django import forms
from django.db.models import QuerySet

from sentry.models import Integration
from sentry.rules.actions import EventAction

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
        enabled: bool = self.get_integrations().exists()
        return enabled

    def get_integration_name(self) -> str:
        """Get the integration's name for the label."""
        try:
            integration = self.get_integration()
        except Integration.DoesNotExist:
            return "[removed]"

        _name: str = integration.name
        return _name

    def get_integrations(self) -> QuerySet[Integration]:
        query: QuerySet[Integration] = Integration.objects.get_active_integrations(
            self.project.organization.id
        ).filter(
            provider=self.provider,
        )
        return query

    def get_integration_id(self) -> str:
        integration_id: str = self.get_option(self.integration_key)
        return integration_id

    def get_integration(self) -> Integration:
        """
        Uses the required class variables `provider` and `integration_key` with
        RuleBase.get_option to get the integration object from DB.

        :raises: Integration.DoesNotExist
        :return: Integration
        """
        return Integration.objects.get_active_integrations(self.project.organization.id).get(
            id=self.get_integration_id(),
            provider=self.provider,
        )

    def get_installation(self) -> Any:
        return self.get_integration().get_installation(self.project.organization.id)

    def get_form_instance(self) -> forms.Form:
        return self.form_cls(self.data, integrations=self.get_integrations())
