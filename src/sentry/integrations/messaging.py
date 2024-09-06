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
from rest_framework.request import Request

from sentry import analytics
from sentry.incidents.action_handlers import ActionHandler, DefaultActionHandler
from sentry.incidents.models.alert_rule import ActionHandlerFactory, AlertRuleTriggerAction
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.base import IntegrationProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import ExternalProviderEnum, ExternalProviders
from sentry.integrations.utils.identities import get_identity_or_404
from sentry.models.identity import Identity, IdentityProvider
from sentry.models.notificationaction import ActionService, ActionTarget
from sentry.models.project import Project
from sentry.models.user import User
from sentry.notifications.notificationcontroller import NotificationController
from sentry.notifications.notifications.integration_nudge import IntegrationNudgeNotification
from sentry.organizations.services.organization import RpcOrganization
from sentry.rules import rules
from sentry.rules.actions import IntegrationEventAction
from sentry.types.actor import ActorType
from sentry.utils import metrics
from sentry.utils.signing import unsign
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response

logger = logging.getLogger("sentry.integrations.messaging")


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
class IdentityLinkageView(BaseView, ABC):
    """ "Linkage" includes both linking and unlinking."""

    @property
    @abstractmethod
    def parent_messaging_spec(self) -> MessagingIntegrationSpec:
        raise NotImplementedError

    @property
    @abstractmethod
    def provider(self) -> ExternalProviders:
        raise NotImplementedError

    @property
    @abstractmethod
    def external_provider_enum(self) -> ExternalProviderEnum:
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
    def external_id_parameter(self) -> str:
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

    @abstractmethod
    def get_success_template_and_context(
        self, params: Mapping[str, Any], integration: Integration | None
    ) -> tuple[str, dict[str, Any]]:
        """HTML content to show when the operation has been completed."""
        raise NotImplementedError

    @property
    @abstractmethod
    def metrics_operation_key(self) -> str:
        raise NotImplementedError

    def capture_metric(self, event_tag: str, tags: dict[str, str] | None = None) -> str:
        event = ".".join(
            ("sentry.integrations", self.provider_slug, self.metrics_operation_key, event_tag)
        )
        metrics.incr(event, tags=(tags or {}), sample_rate=1.0)
        return event

    @property
    def analytics_operation_key(self) -> str | None:
        """Operation description to use in analytics. Return None to skip."""
        return None

    def record_analytic(self, actor_id: int) -> None:
        if self.analytics_operation_key is None:
            # This preserves legacy differences between messaging integrations,
            # in that some record analytics and some don't.
            # TODO: Make consistent across all messaging integrations.
            return

        event = ".".join(("integrations", self.provider_slug, self.analytics_operation_key))
        analytics.record(
            event, provider=self.provider_slug, actor_id=actor_id, actor_type=ActorType.USER
        )

    @staticmethod
    def _render_error_page(
        request: Request | HttpRequest, status: int, body_text: str
    ) -> HttpResponse:
        template = "sentry/integrations/generic-error.html"
        context = {"body_text": body_text}
        return render_to_response(template, request=request, status=status, context=context)

    @method_decorator(never_cache)
    def dispatch(self, request: HttpRequest, signed_params: str) -> HttpResponseBase:
        try:
            params = unsign(signed_params, salt=self.salt)
        except (SignatureExpired, BadSignature) as e:
            logger.warning("dispatch.signature_error", exc_info=e)
            self.capture_metric("failure", tags={"error": str(e)})
            return render_to_response(
                self.expired_link_template,
                request=request,
            )

        organization: RpcOrganization | None = None
        integration: Integration | None = None
        idp: IdentityProvider | None = None
        integration_id = params.get("integration_id")
        try:
            if integration_id:
                organization, integration, idp = get_identity_or_404(
                    self.provider, request.user, integration_id=integration_id
                )
        except Http404:
            logger.exception("get_identity_error", extra={"integration_id": integration_id})
            self.capture_metric("failure.get_identity")
            return self._render_error_page(
                request,
                status=404,
                body_text="HTTP 404: Could not find the identity.",
            )

        logger.info(
            "get_identity_success",
            extra={"integration_id": integration_id, "provider": self.provider_slug},
        )
        self.capture_metric("success.get_identity")
        params.update({"organization": organization, "integration": integration, "idp": idp})

        dispatch_kwargs = dict(
            organization=organization, integration=integration, idp=idp, params=params
        )
        dispatch_kwargs = {k: v for (k, v) in dispatch_kwargs.items() if v is not None}
        return super().dispatch(request, **dispatch_kwargs)

    def get(self, request: Request, *args, **kwargs) -> HttpResponse:
        params = kwargs["params"]
        context = {"organization": params["organization"]}
        integration = params.get("integration")
        if integration:
            context["provider"] = integration.get_provider()
        return render_to_response(self.confirmation_template, request=request, context=context)

    def post(self, request: Request, *args: Any, **kwargs: Any) -> HttpResponse:
        if isinstance(request.user, AnonymousUser):
            return HttpResponse(status=401)

        try:
            organization: RpcOrganization | None = kwargs.get("organization")
            integration: Integration | None = kwargs.get("integration")
            idp: IdentityProvider | None = kwargs.get("idp")

            params_dict: Mapping[str, Any] = kwargs["params"]
            external_id: str = params_dict[self.external_id_parameter]
        except KeyError as e:
            event = self.capture_metric("failure.post.missing_params", tags={"error": str(e)})
            logger.exception(event)
            return self._render_error_page(
                request,
                status=400,
                body_text="HTTP 400: Missing required parameters.",
            )

        exc_response = self.persist_identity(idp, external_id, request)
        if exc_response is not None:
            return exc_response

        self.notify_on_success(external_id, params_dict, integration)
        self.capture_metric("success.post")
        self.record_analytic(request.user.id)

        if organization is not None:
            self._send_nudge_notification(organization, request)

        success_template, success_context = self.get_success_template_and_context(
            params_dict, integration
        )
        return render_to_response(success_template, request=request, context=success_context)

    def _send_nudge_notification(self, organization: RpcOrganization, request: Request):
        # TODO: Delete this if no longer needed

        user: User = request.user  # type: ignore[assignment]
        controller = NotificationController(
            recipients=[user],
            organization_id=organization.id,
            provider=self.external_provider_enum,
        )
        has_provider_settings = controller.user_has_any_provider_settings(
            self.external_provider_enum
        )
        if not has_provider_settings:
            # Expects Organization, not RpcOrganization. Suspect this to be a bug
            # that isn't being hit because these notifications aren't being sent.
            nudge_notification = IntegrationNudgeNotification(organization, user, self.provider)  # type: ignore[arg-type]

            nudge_notification.send()

    @abstractmethod
    def persist_identity(
        self, idp: IdentityProvider | None, external_id: str, request: HttpRequest
    ) -> HttpResponse | None:
        """Execute the operation on the Identity table.

        Return a response to trigger an early halt under exceptional conditions.
        Return None if everything is normal.
        """
        raise NotImplementedError

    def notify_on_success(
        self, external_id: str, params: Mapping[str, Any], integration: Integration | None
    ) -> None:
        """On success, notify the user through the messaging client.

        No-op by default.

        :param external_id: the `Identity.external_id` value (the messaging service's ID)
        :param params:      raw params from the incoming request
        :param integration: affected Integration entity, if any
        """


class LinkIdentityView(IdentityLinkageView, ABC):
    @property
    def confirmation_template(self) -> str:
        return "sentry/auth-link-identity.html"

    @property
    def metrics_operation_key(self) -> str:
        return "link_identity_view"

    def persist_identity(
        self, idp: IdentityProvider | None, external_id: str, request: HttpRequest
    ) -> None:
        if idp is None:
            raise ValueError('idp is required for linking (params must include "integration_id")')

        user = request.user
        if isinstance(user, AnonymousUser):
            raise TypeError("Cannot link identity without a logged-in user")

        try:
            Identity.objects.link_identity(user=user, idp=idp, external_id=external_id)
        except IntegrityError:
            event = self.capture_metric("failure.integrity_error")
            logger.exception(event)
            raise Http404


class UnlinkIdentityView(IdentityLinkageView, ABC):
    @property
    def confirmation_template(self) -> str:
        return "sentry/auth-unlink-identity.html"

    @property
    def no_identity_template(self) -> str | None:
        """Optional page to show if identities were not found."""
        return None

    @property
    def filter_by_user_id(self) -> bool:
        # TODO: Is it okay to just make this True everywhere?
        return False

    @property
    def metrics_operation_key(self) -> str:
        return "unlink_identity_view"

    def persist_identity(
        self, idp: IdentityProvider | None, external_id: str, request: HttpRequest
    ) -> HttpResponse | None:
        try:
            identities = Identity.objects.filter(external_id=external_id)
            if idp is not None:
                identities = identities.filter(idp=idp)
            if self.filter_by_user_id:
                identities = identities.filter(user_id=request.user.id)
            if self.no_identity_template and not identities:
                return render_to_response(self.no_identity_template, request=request, context={})
            identities.delete()
        except IntegrityError:
            tag = f"{self.provider_slug}.unlink.integrity-error"
            logger.exception(tag)
            raise Http404
        return None
