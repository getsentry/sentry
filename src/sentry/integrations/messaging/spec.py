import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

from django.urls import re_path
from django.urls.resolvers import URLPattern
from django.views.generic import View

from sentry import analytics
from sentry.api.serializers import serialize
from sentry.incidents.action_handlers import ActionHandler, DefaultActionHandler
from sentry.incidents.endpoints.serializers.alert_rule import (
    AlertRuleSerializer,
    AlertRuleSerializerResponse,
)
from sentry.incidents.endpoints.serializers.incident import (
    DetailedIncidentSerializer,
    DetailedIncidentSerializerResponse,
)
from sentry.incidents.models.alert_rule import ActionHandlerFactory, AlertRuleTriggerAction
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.integrations.base import IntegrationProvider
from sentry.integrations.metric_alerts import get_metric_count_from_incident
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.models.notificationaction import ActionService, ActionTarget
from sentry.rules import rules
from sentry.rules.actions import IntegrationEventAction

logger = logging.getLogger("sentry.integrations.messaging.spec")


@dataclass(frozen=True)
class MessagingIdentityLinkViewSet:
    """An integration's set of view classes for linking and unlinking identities."""

    link_personal_identity: type[View]
    unlink_personal_identity: type[View]

    # Optional until supported on all messaging integrations
    link_team_identity: type[View] | None = None
    unlink_team_identity: type[View] | None = None


class MessagingIntegrationSpec(ABC):
    """Represent the feature set for a messaging integration.

    This class is intended to serve as a top-level "table of contents" for all the
    code that supports integration of a third-party service with Sentry. The
    IntegrationProvider class, which this class incorporates, provides specifications
    for the base integration. This class's distinct purpose is to adds whatever
    features and business logic are particular to messaging integrations.

    This class is currently under development and does not yet represent the complete
    feature set for messaging integrations. We should continue developing it by
    adding anything that is required for all messaging integrations or common across
    many of them, especially where there code or patterns are duplicated.
    """

    def initialize(self) -> None:
        """Initialize a messaging integration.

        We expect each MessagingIntegrationSpec implementation (i.e., concrete
        subclass) to be instantiated once and to have this method called in an
        `__init__` module, or somewhere else that is reliably evaluated on start-up.

        See docstrings on `integration_provider` and
        `get_identity_view_set_url_patterns` for things *not* covered by this method,
        which require additional boilerplate.
        """

        AlertRuleTriggerAction.register_factory(self.get_incident_handler_factory())

        if self.notify_service_action:
            rules.add(self.notify_service_action)
        if self.notification_sent:
            analytics.register(self.notification_sent)

    def get_incident_handler_factory(self) -> ActionHandlerFactory:
        return _MessagingHandlerFactory(self)

    @property
    @abstractmethod
    def provider_slug(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def action_service(self) -> ActionService:
        raise NotImplementedError

    @property
    @abstractmethod
    def integration_provider(self) -> type[IntegrationProvider]:
        """Define the class of the integration provider.

        This class is the top-level description of a third-party service that can be
        integrated with a Sentry instance. It provides the key used by the persistent
        Integration model and the corresponding IntegrationInstallation class.

        TODO: Replace code in `register_plugins` (sentry/runner/initializer.py) that
              receives and invokes IntegrationProvider classes, which currently
              receives them via the SENTRY_DEFAULT_INTEGRATIONS server conf value.
        """
        raise NotImplementedError

    @property
    @abstractmethod
    def identity_view_set(self) -> MessagingIdentityLinkViewSet:
        """Define the view classes for linking and unlinking identities."""
        raise NotImplementedError

    def get_identity_view_set_url_patterns(self) -> list[URLPattern]:
        """Build URL patterns for supported identity-linking views.

        The returned pattern objects can be added to a `urlpatterns` Django value in
        the appropriate place.

        TODO: Fold into `initialize` somehow? Not ideal that we require some extra
              boilerplate in a `urls` module (djust Django things).
        """

        def build_path(operation_slug: str, view_cls: type[View]) -> URLPattern:
            return re_path(
                route=rf"^{operation_slug}/(?P<signed_params>[^/]+)/$",
                view=view_cls.as_view(),
                name=f"sentry-integration-{self.provider_slug}-{operation_slug}",
            )

        vs = self.identity_view_set
        return [
            build_path(operation_slug, view_cls)
            for (operation_slug, view_cls) in [
                ("link-identity", vs.link_personal_identity),
                ("unlink-identity", vs.unlink_personal_identity),
                ("link-team", vs.link_team_identity),
                ("unlink-team", vs.unlink_team_identity),
            ]
            if view_cls is not None
        ]

    @abstractmethod
    def send_incident_alert_notification(
        self,
        organization: Organization,
        alert_context: AlertContext,
        notification_context: NotificationContext,
        metric_issue_context: MetricIssueContext,
        open_period_context: OpenPeriodContext,
        alert_rule_serialized_response: AlertRuleSerializerResponse,
        incident_serialized_response: DetailedIncidentSerializerResponse,
        notification_uuid: str | None = None,
    ) -> bool:
        raise NotImplementedError

    @property
    @abstractmethod
    def notify_service_action(self) -> type[IntegrationEventAction] | None:
        """Define the event action to be added to the global RuleRegistry."""
        raise NotImplementedError

    @property
    @abstractmethod
    def notification_sent(self) -> type[analytics.Event] | None:
        """Define an analytics event for a notification being sent.

        Development note: This one was singled out purely because MsTeams does it.
        See `sentry/integrations/slack/analytics.py` for a lot of other events that
        we might want to make universal to all messaging integrations. Once we have a
        common set of analytics events, it probably is best to represent them as a
        compound object (similar to `identity_view_set`) rather than as a bunch of
        class-level properties.
        """
        raise NotImplementedError


class MessagingActionHandler(DefaultActionHandler):
    def __init__(self, spec: MessagingIntegrationSpec):
        super().__init__()
        self._spec = spec

    @property
    def provider(self) -> str:
        return self._spec.provider_slug

    def send_alert(
        self,
        action: AlertRuleTriggerAction,
        incident: Incident,
        project: Project,
        metric_value: int | float | None,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> None:
        if metric_value is None:
            metric_value = get_metric_count_from_incident(incident)

        alert_rule_serialized_response: AlertRuleSerializerResponse = serialize(
            incident.alert_rule, None, AlertRuleSerializer()
        )
        incident_serialized_response: DetailedIncidentSerializerResponse = serialize(
            incident, None, DetailedIncidentSerializer()
        )
        open_period_context = OpenPeriodContext.from_incident(incident=incident)

        notification_context = NotificationContext.from_alert_rule_trigger_action(action)
        alert_context = AlertContext.from_alert_rule_incident(incident.alert_rule)
        metric_issue_context = MetricIssueContext.from_legacy_models(
            incident=incident,
            new_status=new_status,
            metric_value=metric_value,
        )

        success = self._spec.send_incident_alert_notification(
            organization=incident.organization,
            alert_context=alert_context,
            notification_context=notification_context,
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            alert_rule_serialized_response=alert_rule_serialized_response,
            incident_serialized_response=incident_serialized_response,
            notification_uuid=notification_uuid,
        )
        if success:
            self.record_alert_sent_analytics(
                organization_id=incident.organization.id,
                project_id=project.id,
                alert_id=incident.alert_rule.id,
                external_id=action.target_identifier,
                notification_uuid=notification_uuid,
            )


class _MessagingHandlerFactory(ActionHandlerFactory):
    def __init__(self, spec: MessagingIntegrationSpec) -> None:
        super().__init__(
            slug=spec.provider_slug,
            service_type=spec.action_service,
            supported_target_types=[ActionTarget.SPECIFIC],
            integration_provider=spec.provider_slug,
        )
        self.spec = spec

    def build_handler(self) -> ActionHandler:
        return MessagingActionHandler(self.spec)
