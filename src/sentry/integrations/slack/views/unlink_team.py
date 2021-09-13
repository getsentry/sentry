from django.db import IntegrityError
from django.http import Http404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models import (
    ExternalActor,
    Identity,
    IdentityProvider,
    Integration,
    NotificationSetting,
    Team,
)
from sentry.types.integrations import ExternalProviders
from sentry.utils.signing import unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

from ..utils import get_identity, logger, render_error_page, send_confirmation
from . import build_linking_url as base_build_linking_url
from . import never_cache

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
        params = unsign(signed_params)

        organization, integration, idp = get_identity(
            request.user, params["organization_id"], params["integration_id"]
        )
        channel_name = params["channel_name"]
        channel_id = params["channel_id"]

        try:
            external_teams = ExternalActor.objects.filter(
                organization=organization,
                integration=integration,
                provider=ExternalProviders.SLACK.value,
                external_name=channel_name,
                external_id=channel_id,
            )
        except IntegrityError as e:
            logger.error("slack.team.unlink.integrity-error", extra=e)
            raise Http404

        teams = Team.objects.filter(
            actor__in=[external_team.actor for external_team in external_teams]
        )
        if request.method != "POST":
            return render_to_response(
                "sentry/integrations/slack-unlink-team.html",
                request=request,
                context={
                    "team": teams[0],
                    "channel_name": channel_name,
                    "provider": integration.get_provider(),
                },
            )

        try:
            idp = IdentityProvider.objects.get(type="slack", external_id=integration.external_id)
        except IdentityProvider.DoesNotExist:
            logger.error(
                "slack.action.invalid-team-id", extra={"slack_id": integration.external_id}
            )
            return render_error_page(request, body_text="HTTP 403: Invalid team ID")

        if not Identity.objects.filter(idp=idp, external_id=params["slack_id"]).exists():
            return render_error_page(request, body_text="HTTP 403: User identity does not exist")
        for external_team in external_teams:
            external_team.delete()
        for team in teams:
            NotificationSetting.objects.remove_for_team(team, ExternalProviders.SLACK)
        return send_confirmation(
            integration,
            channel_id,
            SUCCESS_UNLINKED_TITLE,
            SUCCESS_UNLINKED_MESSAGE.format(team=team.slug),
            "sentry/integrations/slack-unlinked-team.html",
            request,
        )
