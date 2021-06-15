from django import forms
from django.urls import reverse
from django.views.decorators.cache import never_cache

from sentry.models import ExternalActor, Integration, NotificationSetting, Team, TeamStatus
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign, unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView

from .client import SlackClient
from .utils import logger


def build_linking_url(integration, slack_id, channel_id, channel_name, response_url):
    signed_params = sign(
        integration_id=integration.id,
        slack_id=slack_id,
        channel_id=channel_id,
        channel_name=channel_name,
        response_url=response_url,
    )

    return absolute_uri(
        reverse("sentry-integration-slack-link-team", kwargs={"signed_params": signed_params})
    )


class SelectTeamForm(forms.Form):
    team = forms.ChoiceField(label="Team")

    def __init__(self, teams, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields["team"].choices = [(team.id, team.slug) for team in teams]
        self.fields["team"].widget.choices = self.fields["team"].choices


class SlackLinkTeamView(BaseView):
    @transaction_start("SlackLinkTeamView")
    @never_cache
    def handle(self, request, signed_params):
        params = unsign(signed_params)
        """
        # params:
        #'integration_id': 15,
        #'slack_id': UA1J9RTE1,
        #'channel_id': CA2FRA079,
        #'channel_name': general
        #'response_url': 'https://hooks.slack.com/commands/TA17GH2QL/2177038069364/unDYN7ciEtuZGfCLEzR9KxMw'
        """
        integration = Integration.objects.get(id=params["integration_id"])
        teams = Team.objects.filter(
            organization__in=integration.organizations.all(), status=TeamStatus.VISIBLE
        ).order_by("slug")

        form = SelectTeamForm(teams, request.POST or None)
        if form.is_valid():
            team_id = form.cleaned_data["team"]

        if request.method != "POST":
            return self.respond(
                "sentry/slack-link-team.html",
                {
                    "form": form,
                    "teams": teams,
                    "channel_name": params["channel_name"],
                    "provider": integration.get_provider(),
                },
            )

        team = Team.objects.get(id=team_id)
        # TODO handle non-happy paths
        # add a check to see if the team is already linked to any channel?
        external_team, created = ExternalActor.objects.get_or_create(
            actor_id=team.actor_id,
            organization=integration.organizations.all()[
                0
            ],  # I think you can only have a Slack installed on one org so this is safe?
            integration=integration,
            provider=ExternalProviders.SLACK.value,
            external_name=params["channel_name"],
            external_id=params["channel_id"],
        )

        if created:
            # turn on notifications for all of a team's projects
            # maybe we can add checkboxes in the form later but this is quick n dirty
            team_projects = team.get_projects()
            for project in team_projects:
                NotificationSetting.objects.update_settings(
                    ExternalProviders.SLACK,
                    NotificationSettingTypes.ISSUE_ALERTS,
                    NotificationSettingOptionValues.ALWAYS,
                    team=team,
                    project=project,
                )

            payload = {
                "replace_original": False,
                "response_type": "ephemeral",
                "text": f"The {team.slug} team will now receive notifications in this channel.",
            }

            client = SlackClient()
            try:
                client.post(params["response_url"], data=payload, json=True)
            except ApiError as e:
                message = str(e)
                # If the user took their time to link their slack account, we may no
                # longer be able to respond, and we're not guaranteed able to post into
                # the channel. Ignore Expired url errors.
                #
                # XXX(epurkhiser): Yes the error string has a space in it.
                if message != "Expired url":
                    logger.error("slack.link-notify.response-error", extra={"error": message})

            return self.response(
                "sentry/slack-linked-team.html",
                {"channel_id": params["channel_id"], "team_id": integration.external_id},
            )
