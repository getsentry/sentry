from django.core.signing import BadSignature, SignatureExpired
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.integrations.utils import get_identity_or_404
from sentry.models import ExternalActor, Identity, Integration
from sentry.types.integrations import ExternalProviders
from sentry.utils.signing import unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

from ..utils import send_confirmation
from . import build_linking_url as base_build_linking_url
from . import never_cache, render_error_page

SUCCESS_UNLINKED_TITLE = "Team unlinked"
SUCCESS_UNLINKED_MESSAGE = (
    "This channel will no longer receive issue alert notifications for the {team} team."
)


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


class SlackUnlinkTeamView(BaseView):  # type: ignore
    @transaction_start("SlackUnlinkIdentityView")
    @never_cache
    def handle(self, request: Request, signed_params: str) -> Response:
        try:
            params = unsign(signed_params)
        except (SignatureExpired, BadSignature):
            return render_to_response(
                "sentry/integrations/slack/expired-link.html",
                request=request,
            )

        organization, integration, idp = get_identity_or_404(
            ExternalProviders.SLACK,
            request.user,
            integration_id=params["integration_id"],
            organization_id=params["organization_id"],
        )
        channel_name = params["channel_name"]
        channel_id = params["channel_id"]

        external_teams = ExternalActor.objects.filter(
            organization=organization,
            integration=integration,
            provider=ExternalProviders.SLACK.value,
            external_name=channel_name,
            external_id=channel_id,
        )
        if len(external_teams) == 0:
            return render_error_page(request, body_text="HTTP 404: Team not found")

        team = external_teams[0].actor.resolve()

        if request.method != "POST":
            return render_to_response(
                "sentry/integrations/slack/unlink-team.html",
                request=request,
                context={
                    "team": team,
                    "channel_name": channel_name,
                    "provider": integration.get_provider(),
                },
            )

        if not Identity.objects.filter(idp=idp, external_id=params["slack_id"]).exists():
            return render_error_page(request, body_text="HTTP 403: User identity does not exist")

        # Someone may have accidentally added multiple teams so unlink them all.
        for external_team in external_teams:
            external_team.delete()

        return send_confirmation(
            integration,
            channel_id,
            SUCCESS_UNLINKED_TITLE,
            SUCCESS_UNLINKED_MESSAGE.format(team=team.slug),
            "sentry/integrations/slack/unlinked-team.html",
            request,
        )
