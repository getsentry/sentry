from __future__ import annotations

import abc
from collections.abc import Callable, Sequence
from typing import Any, override

import sentry_sdk

from sentry import analytics
from sentry.analytics.events.alert_sent import AlertSentEvent
from sentry.eventstore.models import GroupEvent
from sentry.integrations.services.integration import (
    RpcIntegration,
    RpcOrganizationIntegration,
    integration_service,
)
from sentry.models.organization import OrganizationStatus
from sentry.models.rule import Rule
from sentry.rules.actions import EventAction
from sentry.rules.base import CallbackFuture
from sentry.types.rules import RuleFuture

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

    @override
    def future(
        self,
        callback: Callable[[GroupEvent, Sequence[RuleFuture]], None],
        key: str | None = None,
        **kwargs: Any,
    ) -> CallbackFuture:
        def wrapped_callback(event: GroupEvent, futures: Sequence[RuleFuture]) -> None:
            with sentry_sdk.start_span(
                op="IntegrationEventAction.future",
                name=type(self).__name__,
            ):
                callback(event, futures)

        return super().future(wrapped_callback, key, **kwargs)

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

    def get_integrations(self) -> list[RpcIntegration]:
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

    def get_organization_integration(self) -> RpcOrganizationIntegration | None:
        return integration_service.get_organization_integration(
            integration_id=self.get_integration_id(), organization_id=self.project.organization_id
        )

    def record_notification_sent(
        self,
        event: GroupEvent,
        external_id: str,
        rule: Rule | None = None,
        notification_uuid: str | None = None,
    ) -> None:
        # Currently these actions can only be triggered by issue alerts
        analytics.record(
            f"integrations.{self.provider}.notification_sent",
            category="issue_alert",
            organization_id=event.organization.id,
            project_id=event.project_id,
            group_id=event.group_id,
            notification_uuid=notification_uuid if notification_uuid else "",
            alert_id=rule.id if rule else None,
        )
        analytics.record(
            AlertSentEvent(
                provider=self.provider,
                alert_id=str(rule.id) if rule else "",
                alert_type="issue_alert",
                organization_id=event.organization.id,
                project_id=event.project_id,
                external_id=external_id,
                notification_uuid=notification_uuid if notification_uuid else "",
            )
        )
