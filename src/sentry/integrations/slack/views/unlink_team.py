from django.core.signing import BadSignature, SignatureExpired
from django.http import Http404, HttpResponse
from django.utils.decorators import method_decorator
from rest_framework.request import Request

from sentry.api.helpers.teams import is_team_admin
from sentry.integrations.mixins import SUCCESS_UNLINKED_TEAM_MESSAGE, SUCCESS_UNLINKED_TEAM_TITLE
from sentry.models.integrations.external_actor import ExternalActor
from sentry.models.integrations.integration import Integration
from sentry.models.organizationmember import OrganizationMember
from sentry.services.hybrid_cloud.identity import identity_service
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils.signing import unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView, region_silo_view
from sentry.web.helpers import render_to_response

from ..utils import is_valid_role, logger
from . import build_linking_url as base_build_linking_url
from . import never_cache, render_error_page

INSUFFICIENT_ACCESS = (
    "You must be a Sentry organization admin/manager/owner or a team admin to unlink a team."
)

ALLOWED_METHODS = ["GET", "POST"]


def build_team_unlinking_url(
    integration: Integration,
    organization_id: str,
    slack_id: str,
    channel_id: str,
    channel_name: str,
    response_url: str,
) -> str:
    return base_build_linking_url(
        "sentry-integration-slack-unlink-team",
        integration_id=integration.id,
        organization_id=organization_id,
        slack_id=slack_id,
        channel_name=channel_name,
        channel_id=channel_id,
        response_url=response_url,
    )


@region_silo_view
class SlackUnlinkTeamView(BaseView):
    """
    Django view for unlinking team from slack channel. Deletes from ExternalActor table.
    """

    @transaction_start("SlackUnlinkIdentityView")
    @method_decorator(never_cache)
    def handle(self, request: Request, signed_params: str) -> HttpResponse:
        if request.method not in ALLOWED_METHODS:
            return HttpResponse(status=405)

        try:
            params = unsign(signed_params)
        except (SignatureExpired, BadSignature):
            return render_to_response(
                "sentry/integrations/slack/expired-link.html",
                request=request,
            )

        integration = integration_service.get_integration(integration_id=params["integration_id"])
        if not integration:
            raise Http404

        om = OrganizationMember.objects.get_for_integration(
            integration, request.user, organization_id=params["organization_id"]
        ).first()
        organization = om.organization if om else None
        if organization is None:
            raise Http404

        channel_name = params["channel_name"]
        channel_id = params["channel_id"]

        external_teams = ExternalActor.objects.filter(
            organization_id=organization.id,
            integration_id=integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name=channel_name,
            external_id=channel_id,
        )
        if len(external_teams) == 0:
            return render_error_page(request, status=404, body_text="HTTP 404: Team not found")

        team = external_teams[0].team
        if team is None:
            return render_error_page(request, status=404, body_text="HTTP 404: Team not found")

        # Error if you don't have a sufficient role and you're not a team admin
        # on the team you're trying to unlink.
        if not is_valid_role(om) and not is_team_admin(om, team=team):
            logger.info(
                "slack.action.invalid-role",
                extra={"slack_id": integration.external_id, "user_id": request.user.id},
            )
            return render_error_page(
                request, status=404, body_text="HTTP 404: " + INSUFFICIENT_ACCESS
            )

        if request.method == "GET":
            return render_to_response(
                "sentry/integrations/slack/unlink-team.html",
                request=request,
                context={
                    "team": team,
                    "channel_name": channel_name,
                    "provider": integration.get_provider(),
                },
            )

        idp = identity_service.get_provider(
            provider_ext_id=integration.external_id,
            provider_type=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
        )

        if not idp or not identity_service.get_identity(
            filter={"provider_id": idp.id, "identity_ext_id": params["slack_id"]}
        ):
            return render_error_page(
                request, status=403, body_text="HTTP 403: User identity does not exist"
            )

        # Someone may have accidentally added multiple teams so unlink them all.
        for external_team in external_teams:
            external_team.delete()

        return render_to_response(
            "sentry/integrations/slack/unlinked-team.html",
            request=request,
            context={
                "heading_text": SUCCESS_UNLINKED_TEAM_TITLE,
                "body_text": SUCCESS_UNLINKED_TEAM_MESSAGE.format(team=team.slug),
                "channel_id": channel_id,
                "team_id": integration.external_id,
            },
        )
