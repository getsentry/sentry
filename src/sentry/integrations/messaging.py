import logging
from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from django.contrib.auth.models import AnonymousUser
from django.core.signing import BadSignature, SignatureExpired
from django.db import IntegrityError
from django.http import Http404, HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.urls import re_path
from django.urls.resolvers import URLPattern
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.generic import View

from sentry import analytics
from sentry.incidents.action_handlers import ActionHandler, DefaultActionHandler
from sentry.incidents.models.alert_rule import ActionHandlerFactory, AlertRuleTriggerAction
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.base import IntegrationProvider
from sentry.integrations.types import ExternalProviders
from sentry.integrations.utils import get_identity_or_404
from sentry.models.identity import Identity, IdentityProvider
from sentry.models.integrations import Integration
from sentry.models.notificationaction import ActionService, ActionTarget
from sentry.models.project import Project
from sentry.rules import rules
from sentry.rules.actions import IntegrationEventAction
from sentry.types.actor import ActorType
from sentry.utils.signing import unsign
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response

logger = logging.getLogger("sentry.integrations.messaging")


@dataclass(frozen=True)
class MessagingIdentityLinkViewSet:
    """An integration's set of view classes for linking and unlinking identities."""

    link_personal_identity: type[View]
    unlink_personal_identity: type[View]

    # TODO: Allow these to be optional? Require for all messaging integrations?
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
                route=rf"^{operation_slug}/(?P<signed_params>[^\/]+)/$",
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
        action: AlertRuleTriggerAction,
        incident: Incident,
        metric_value: float,
        new_status: IncidentStatus,
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

    # Requirements for messaging feature per tech spec

    @property
    def help_view(self) -> type[View] | None:
        """TODO?"""
        return None

    @property
    def support(self) -> type[View] | None:
        """TODO?"""
        return None

    @property
    def documentation(self) -> type[View] | None:
        """TODO?"""
        return None


class MessagingActionHandler(DefaultActionHandler):
    def __init__(
        self,
        action: AlertRuleTriggerAction,
        incident: Incident,
        project: Project,
        spec: MessagingIntegrationSpec,
    ):
        super().__init__(action, incident, project)
        self._spec = spec

    @property
    def provider(self) -> str:
        return self._spec.provider_slug

    def send_alert(
        self,
        metric_value: int | float,
        new_status: IncidentStatus,
        notification_uuid: str | None = None,
    ) -> None:
        success = self._spec.send_incident_alert_notification(
            self.action, self.incident, metric_value, new_status, notification_uuid
        )
        if success:
            self.record_alert_sent_analytics(self.action.target_identifier, notification_uuid)


class _MessagingHandlerFactory(ActionHandlerFactory):
    def __init__(self, spec: MessagingIntegrationSpec) -> None:
        super().__init__(
            slug=spec.provider_slug,
            service_type=spec.action_service,
            supported_target_types=[ActionTarget.SPECIFIC],
            integration_provider=spec.provider_slug,
        )
        self.spec = spec

    def build_handler(
        self, action: AlertRuleTriggerAction, incident: Incident, project: Project
    ) -> ActionHandler:
        return MessagingActionHandler(action, incident, project, self.spec)


@control_silo_view
class LinkingView(BaseView, ABC):
    @property
    @abstractmethod
    def parent_messaging_spec(self) -> MessagingIntegrationSpec:
        raise NotImplementedError

    @property
    @abstractmethod
    def provider(self) -> ExternalProviders:
        raise NotImplementedError

    @property
    def provider_slug(self) -> str:
        return self.parent_messaging_spec.provider_slug

    @property
    @abstractmethod
    def salt(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def user_parameter(self) -> str:
        raise NotImplementedError

    # TODO: Replace thw two template properties below with base templates for all
    #       integrations to use. Add service-specific parts to the context as needed.

    @property
    @abstractmethod
    def confirmation_template(self) -> str:
        """Path to the HTML template to render for a non-POST request."""
        raise NotImplementedError

    @property
    @abstractmethod
    def expired_link_template(self) -> str:
        """Path to the HTML template to show when a link is expired."""
        raise NotImplementedError

    @property
    @abstractmethod
    def success_template(self) -> str:
        """Path to the HTML template to show when an identity has been linked."""
        raise NotImplementedError

    @property
    def success_metric(self) -> str | None:
        """Optional analytics key to record on success."""
        return None

    def notify_on_success(self, integration: Integration, params: Mapping[str, Any]) -> None:
        pass

    @method_decorator(never_cache)
    def handle(
        self, request: HttpRequest, signed_params: Any, *args: Any, **kwargs: Any
    ) -> HttpResponseBase:
        try:
            params = unsign(signed_params, salt=self.salt)
        except (SignatureExpired, BadSignature):
            return render_to_response(
                self.expired_link_template,
                request=request,
            )

        organization, integration, idp = get_identity_or_404(
            self.provider,
            request.user,
            integration_id=params["integration_id"],
            organization_id=params["organization_id"],
        )

        if request.method != "POST":
            return render_to_response(
                self.confirmation_template,
                request=request,
                context={"organization": organization, "provider": integration.get_provider()},
            )

        response = self.execute(idp, params, request)
        if response is not None:
            return response

        self.notify_on_success(integration, params)

        if self.success_metric:
            provider_slug = self.parent_messaging_spec.provider_slug
            analytics.record(
                self.success_metric,
                provider=provider_slug,
                actor_id=request.user.id,
                actor_type=ActorType.USER,
            )

        return render_to_response(
            self.success_template,
            request=request,
            context={"team_id": params["team_id"]},
        )

    @abstractmethod
    def execute(
        self, idp: IdentityProvider, params: Mapping[str, Any], request: HttpRequest
    ) -> HttpResponse | None:
        """Execute the operation on the Identity table.

        Return a response to trigger an early halt under exceptional conditions.
        Return None if everything is normal.
        """
        raise NotImplementedError


class LinkIdentityView(LinkingView, ABC):
    @property
    def confirmation_template(self) -> str:
        return "sentry/auth-link-identity.html"

    def execute(
        self, idp: IdentityProvider, params: Mapping[str, Any], request: HttpRequest
    ) -> HttpResponse | None:
        user = request.user
        if isinstance(user, AnonymousUser):
            raise TypeError("Cannot link identity without a logged-in user")
        Identity.objects.link_identity(user=user, idp=idp, external_id=params[self.user_parameter])
        return None


class UnlinkIdentityView(LinkingView, ABC):
    @property
    def confirmation_template(self) -> str:
        return "sentry/auth-unlink-identity.html"

    @property
    def no_identity_template(self) -> str | None:
        """Optional page to show if identities were not found."""
        return None

    def execute(
        self, idp: IdentityProvider, params: Mapping[str, Any], request: HttpRequest
    ) -> HttpResponse | None:
        try:
            identities = Identity.objects.filter(idp=idp, external_id=params[self.user_parameter])
            if self.no_identity_template and not identities:
                return render_to_response(self.no_identity_template, request=request, context={})
            identities.delete()
        except IntegrityError:
            tag = f"{self.provider_slug}.unlink.integrity-error"
            logger.exception(tag)
            raise Http404
        return None
