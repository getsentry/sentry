import logging
from abc import ABC, abstractmethod
from collections.abc import Iterable, Mapping
from typing import Any

from django.contrib.auth.models import AnonymousUser
from django.core.signing import BadSignature, SignatureExpired
from django.db import IntegrityError
from django.http import Http404, HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.request import Request

from sentry import analytics, features
from sentry.api.helpers.teams import is_team_admin
from sentry.constants import ObjectStatus
from sentry.identity.services.identity import identity_service
from sentry.integrations.messaging.spec import MessagingIntegrationSpec
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.types import ExternalProviderEnum, ExternalProviders
from sentry.integrations.utils.identities import get_identity_or_404
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.notifications.notificationcontroller import NotificationController
from sentry.notifications.notifications.integration_nudge import IntegrationNudgeNotification
from sentry.notifications.services import notifications_service
from sentry.notifications.types import NotificationSettingEnum
from sentry.organizations.services.organization import RpcOrganization
from sentry.types.actor import ActorType
from sentry.users.models.identity import Identity, IdentityProvider
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.serial import serialize_generic_user
from sentry.utils import metrics
from sentry.utils.signing import unsign
from sentry.web.client_config import get_client_config
from sentry.web.frontend.base import BaseView, control_silo_view, region_silo_view
from sentry.web.helpers import render_to_response

logger = logging.getLogger("sentry.integrations.messaging.linkage")


class LinkageView(BaseView, ABC):
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
    def render_error_page(
        request: Request | HttpRequest, status: int, body_text: str
    ) -> HttpResponse:
        template = "sentry/integrations/generic-error.html"
        context = {"body_text": body_text}
        return render_to_response(template, request=request, status=status, context=context)


@control_silo_view
class IdentityLinkageView(LinkageView, ABC):
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
            return self.render_error_page(
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
            return self.render_error_page(
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


@region_silo_view
class TeamLinkageView(LinkageView, ABC):
    _ALLOWED_ROLES = frozenset(["admin", "manager", "owner"])

    @classmethod
    def is_valid_role(cls, org_member: OrganizationMember) -> bool:
        return org_member.role in cls._ALLOWED_ROLES

    @method_decorator(never_cache)
    def handle(self, request: HttpRequest, signed_params: str) -> HttpResponseBase:
        if request.method not in ("GET", "POST"):
            return self.render_error_page(
                request, status=405, body_text="HTTP 405: Method not allowed"
            )

        try:
            params = unsign(signed_params, salt=self.salt)
        except (SignatureExpired, BadSignature) as e:
            logger.warning("handle.signature_error", exc_info=e)
            self.capture_metric("failure", tags={"error": str(e)})
            return render_to_response(
                "sentry/integrations/slack/expired-link.html",
                status=400,
                request=request,
            )

        integration_id: str = params["integration_id"]
        slack_id: str = params["slack_id"]
        organization_id: str | None = params.get("organization_id")

        integration = integration_service.get_integration(
            integration_id=integration_id, status=ObjectStatus.ACTIVE
        )
        if integration is None:
            logger.info(
                "integration.not_found",
                extra={
                    "user_id": request.user.id,
                    "integration_id": integration_id,
                    "slack_id": slack_id,
                    "organization_id": organization_id,
                },
            )
            self.capture_metric("failure")
            return self.render_error_page(
                request, status=404, body_text="HTTP 404: Could not find the Slack integration."
            )
        return self.execute(request, integration, params)

    @abstractmethod
    def execute(
        self, request: HttpRequest, integration: RpcIntegration, params: Mapping[str, Any]
    ) -> HttpResponseBase:
        raise NotImplementedError


class LinkTeamView(TeamLinkageView, ABC):
    @property
    def metrics_operation_key(self) -> str:
        return "link_team_view"

    def execute(
        self, request: HttpRequest, integration: RpcIntegration, params: Mapping[str, Any]
    ) -> HttpResponseBase:
        from sentry.integrations.slack.views.link_team import (
            SUCCESS_LINKED_MESSAGE,
            SUCCESS_LINKED_TITLE,
            SelectTeamForm,
        )

        user = serialize_generic_user(request.user)
        if user is None:
            raise TypeError("Cannot link team without a logged-in user")

        channel_id: str = params["channel_id"]
        channel_name: str = params["channel_name"]
        slack_id: str = params["slack_id"]
        logger_params = {
            "user_id": user.id,
            "integration_id": integration.id,
            "channel_id": channel_id,
            "channel_name": channel_name,
            "slack_id": slack_id,
            "response_url": params["response_url"],
        }

        teams_by_id = {team.id: team for team in self._get_teams(integration, user)}

        if not teams_by_id:
            logger.info("team.no_teams_found", extra=logger_params)
            self.capture_metric("failure.get_teams")
            return self.render_error_page(
                request,
                status=404,
                body_text="HTTP 404: No teams found in your organizations to link. You must be a Sentry organization admin/manager/owner or a team admin to link a team in your respective organization.",
            )

        form = SelectTeamForm(list(teams_by_id.values()), request.POST or None)

        if request.method == "GET":
            return self.respond(
                "sentry/integrations/slack/link-team.html",
                {
                    "form": form,
                    "teams": teams_by_id.values(),
                    "channel_name": channel_name,
                    "provider": integration.get_provider(),
                },
            )

        if not form.is_valid():
            logger.info("form.invalid", extra={**logger_params, "form_errors": form.errors})
            self.capture_metric("failure.form_invalid")
            return self.render_error_page(request, status=400, body_text="HTTP 400: Bad request")

        team_id = int(form.cleaned_data["team"])
        team = teams_by_id.get(team_id)
        if not team:
            logger.info("team.not_found", extra={"team_id": team_id})
            self.capture_metric("failure.team_not_found")
            return self.render_error_page(
                request,
                status=404,
                body_text="HTTP 404: Team does not exist or you do not have sufficient permission to link a team",
            )

        logger_params["team_id"] = team.id

        idp = identity_service.get_provider(
            provider_type="slack", provider_ext_id=integration.external_id
        )
        logger_params["provider_ext_id"] = integration.external_id
        if idp is None:
            logger.info("identity_provider.not_found", extra=logger_params)
            self.capture_metric("failure.identity_provider_not_found")
            return self.render_error_page(
                request, status=403, body_text="HTTP 403: Invalid team ID"
            )

        ident = identity_service.get_identity(
            filter={"provider_id": idp.id, "identity_ext_id": slack_id}
        )
        if not ident:
            logger.info("identity.not_found", extra=logger_params)
            self.capture_metric("failure.identity_not_found")
            return self.render_error_page(
                request, status=403, body_text="HTTP 403: User identity does not exist"
            )

        _, created = ExternalActor.objects.get_or_create(
            team_id=team.id,
            organization=team.organization,
            integration_id=integration.id,
            provider=self.provider.value,
            defaults=dict(
                external_name=channel_name,
                external_id=channel_id,
            ),
        )

        analytics.record(
            "integrations.identity_linked",
            provider=self.provider_slug,
            actor_id=team.id,
            actor_type="team",
        )

        if not created:
            self.capture_metric("failure.team_already_linked")
            return self.notify_team_already_linked(request, channel_id, integration, team)

        has_team_workflow = features.has(
            "organizations:team-workflow-notifications", team.organization
        )
        # Turn on notifications for all of a team's projects.
        # TODO(jangjodi): Remove this once the flag is removed
        if not has_team_workflow:
            notifications_service.enable_all_settings_for_provider(
                external_provider=self.external_provider_enum,
                team_id=team.id,
                types=[NotificationSettingEnum.ISSUE_ALERTS],
            )

        message = SUCCESS_LINKED_MESSAGE.format(
            slug=team.slug,
            workflow_addon=" and workflow" if has_team_workflow else "",
            channel_name=channel_name,
        )
        self.notify_on_success(channel_id, integration, message)

        self.capture_metric("success")

        return render_to_response(
            "sentry/integrations/slack/post-linked-team.html",
            request=request,
            context={
                "heading_text": SUCCESS_LINKED_TITLE,
                "body_text": message,
                "channel_id": channel_id,
                "team_id": integration.external_id,
            },
        )

    def _get_teams(self, integration: RpcIntegration, user: RpcUser) -> Iterable[Team]:
        organization_memberships = OrganizationMember.objects.get_for_integration(integration, user)
        # Filter to teams where we have write access to, either through having a sufficient
        # organization role (owner/manager/admin) or by being a team admin on at least one team.
        for org_membership in organization_memberships:
            # Setting is_team_admin to True only returns teams that member is team admin on.
            # We only want to filter for this when the user does not have a sufficient
            # role in the org, which is checked using is_valid_role.
            is_team_admin = not self.is_valid_role(org_membership)

            yield from Team.objects.get_for_user(
                org_membership.organization, user, is_team_admin=is_team_admin
            )

    @abstractmethod
    def notify_on_success(self, channel_id: str, integration: RpcIntegration, message: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def notify_team_already_linked(
        self, request: HttpRequest, channel_id: str, integration: RpcIntegration, team: Team
    ) -> HttpResponse:
        raise NotImplementedError


class UnlinkTeamView(TeamLinkageView, ABC):
    @property
    def metrics_operation_key(self) -> str:
        return "unlink_team_view"

    def execute(
        self, request: HttpRequest, integration: RpcIntegration, params: Mapping[str, Any]
    ) -> HttpResponseBase:
        from sentry.integrations.mixins import (
            SUCCESS_UNLINKED_TEAM_MESSAGE,
            SUCCESS_UNLINKED_TEAM_TITLE,
        )
        from sentry.integrations.slack.views.unlink_team import INSUFFICIENT_ACCESS

        user = serialize_generic_user(request.user)
        if user is None:
            raise TypeError("Cannot unlink team without a logged-in user")

        integration_id: int = integration.id
        channel_id: str = params["channel_id"]
        channel_name: str = params["channel_name"]
        slack_id: str = params["slack_id"]
        response_url: str = params["response_url"]
        organization_id: str = params["organization_id"]

        logger_params = {
            "user_id": user.id,
            "integration_id": integration_id,
            "channel_id": channel_id,
            "channel_name": channel_name,
            "slack_id": slack_id,
            "response_url": response_url,
            "organization_id": organization_id,
        }

        om = OrganizationMember.objects.get_for_integration(
            integration, user, organization_id=int(organization_id)
        ).first()
        organization = om.organization if om else None
        if om is None or organization is None:
            logger.info("no-organization-found", extra=logger_params)
            self.capture_metric("failure.get_organization")
            return self.render_error_page(
                request, status=404, body_text="HTTP 404: Could not find the organization."
            )

        external_teams = ExternalActor.objects.filter(
            organization_id=organization.id,
            integration_id=integration.id,
            provider=self.provider.value,
            external_name=channel_name,
            external_id=channel_id,
        )
        if len(external_teams) == 0:
            logger.info("no-team-found", extra=logger_params)
            self.capture_metric("failure.get_team")
            return self.render_error_page(request, status=404, body_text="HTTP 404: Team not found")

        team = external_teams[0].team
        if team is None:
            logger.info("no-team-found", extra=logger_params)
            self.capture_metric("failure.get_team")
            return self.render_error_page(request, status=404, body_text="HTTP 404: Team not found")

        logger_params["team_id"] = team.id

        # Error if you don't have a sufficient role and you're not a team admin
        # on the team you're trying to unlink.
        if not self.is_valid_role(om) and not is_team_admin(om, team=team):
            logger.info("invalid-role", extra=logger_params)
            self.capture_metric("failure.invalid_role")
            return self.render_error_page(
                request, status=403, body_text="HTTP 403: " + INSUFFICIENT_ACCESS
            )

        if request.method == "GET":
            return render_to_response(
                "sentry/integrations/slack/unlink-team.html",
                request=request,
                context={
                    "team": team,
                    "channel_name": channel_name,
                    "provider": integration.get_provider(),
                    "react_config": get_client_config(request, self.active_organization),
                },
            )

        idp = identity_service.get_provider(
            provider_ext_id=integration.external_id,
            provider_type=self.external_provider_enum.value,
        )

        if not idp or not identity_service.get_identity(
            filter={"provider_id": idp.id, "identity_ext_id": slack_id}
        ):
            logger.info("identity-not-found", extra=logger_params)
            self.capture_metric("failure.identity_not_found")
            return self.render_error_page(
                request, status=403, body_text="HTTP 403: User identity does not exist"
            )

        # Someone may have accidentally added multiple teams so unlink them all.
        for external_team in external_teams:
            external_team.delete()

        self.capture_metric("success.post")

        return render_to_response(
            "sentry/integrations/slack/unlinked-team.html",
            request=request,
            context={
                "heading_text": SUCCESS_UNLINKED_TEAM_TITLE,
                "body_text": SUCCESS_UNLINKED_TEAM_MESSAGE.format(team=team.slug),
                "channel_id": channel_id,
                "team_id": integration.external_id,
                "react_config": get_client_config(request, self.active_organization),
            },
        )
