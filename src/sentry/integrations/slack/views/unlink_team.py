from django.db import IntegrityError
from django.http import Http404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models import ExternalActor, Integration, NotificationSetting, Team
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import ExternalProviders
from sentry.utils.signing import unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

from ..client import SlackClient
from ..utils import get_identity, logger
from . import build_linking_url as base_build_linking_url
from . import never_cache

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
            external_team = ExternalActor.objects.get(
                organization=organization,
                integration=integration,
                provider=ExternalProviders.SLACK.value,
                external_name=channel_name,
                external_id=channel_id,
            )
        except IntegrityError as e:
            logger.error("slack.team.unlink.integrity-error", extra=e)
            raise Http404

        team = Team.objects.get(actor=external_team.actor)
        if request.method != "POST":
            return render_to_response(
                "sentry/integrations/slack-unlink-team.html",
                request=request,
                context={
                    "team": team,
                    "channel_name": channel_name,
                    "provider": integration.get_provider(),
                },
            )

        external_team.delete()

        # Turn off notifications for all of a team's projects.
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            team=team,
        )

        payload = {
            "replace_original": False,
            "response_type": "ephemeral",
            "text": SUCCESS_UNLINKED_MESSAGE.format(team=team.slug),
        }

        client = SlackClient()
        try:
            client.post(params["response_url"], data=payload, json=True)
        except ApiError as e:
            message = str(e)
            # If the user took their time to unlink their team, we may no
            # longer be able to respond, and we're not guaranteed able to post into
            # the channel. Ignore Expired url errors.
            #
            # XXX(epurkhiser): Yes the error string has a space in it.
            if message != "Expired url":
                logger.error("slack.unlink-notify.response-error", extra={"error": message})

        return render_to_response(
            "sentry/integrations/slack-unlinked-team.html",
            request=request,
            context={"channel_name": channel_name, "team": team},
        )
