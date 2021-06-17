from django import forms
from django.urls import reverse
from django.views.decorators.cache import never_cache

from sentry.models import (
    ExternalActor,
    Identity,
    IdentityProvider,
    Integration,
    NotificationSetting,
    Organization,
    OrganizationMember,
    Team,
    TeamStatus,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign, unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

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
    def get_identity(self, integration, slack_id):
        try:
            idp = IdentityProvider.objects.get(type="slack", external_id=integration.external_id)
        except IdentityProvider.DoesNotExist:
            logger.error(
                "slack.action.invalid-team-id", extra={"slack_id": integration.external_id}
            )
            return self.respond(status=403)

        try:
            identity = Identity.objects.select_related("user").get(idp=idp, external_id=slack_id)
        except Identity.DoesNotExist:
            # I don't think this could be possible but just in case
            return self.respond(status=403)
        return identity

    def send_error_message(self, request, client, message, response_url, channel_id, integration):
        token = (
            integration.metadata.get("user_access_token") or integration.metadata["access_token"]
        )
        payload = {
            "token": token,
            "channel": channel_id,
            "text": message,
        }
        headers = {"Authorization": "Bearer %s" % token}
        try:
            client.post("/chat.postMessage", headers=headers, data=payload, json=True)
        except ApiError as e:
            message = str(e)
            if message != "Expired url":
                logger.error("slack.link-notify.response-error", extra={"error": message})
        else:
            # TODO create a new template for this, but we want to show a different page
            return render_to_response(
                "sentry/slack-linked-team.html",
                request=request,
                context={"channel_id": channel_id, "team_id": integration.external_id},
            )

    @transaction_start("SlackLinkTeamView")
    # @never_cache
    def handle(self, request, signed_params):
        params = unsign(signed_params)
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
        organization = Organization.objects.get_for_team_ids([team.id])[0]
        identity = self.get_identity(integration, params["slack_id"])
        org_member = OrganizationMember.objects.get(user=identity.user, organization=organization)
        client = SlackClient()
        # if the org has open membership and the user is an admin or above
        # OR if closed, ensure user is admin AND member of the team
        if not (
            organization.flags.allow_joinleave and org_member.role in ["admin", "manager", "owner"]
        ) or (org_member.role in ["admin", "manager", "owner"] and team in [org_member.teams]):
            INSUFFICIENT_ROLE_MESSAGE = "You must be an admin or higher and a member of the team you wish to link in your Sentry organization to link teams."
            # TODO(ceo) write a test for this case
            return self.send_error_message(
                request,
                client,
                INSUFFICIENT_ROLE_MESSAGE,
                params["response_url"],
                params["channel_id"],
                integration,
            )

        already_linked = ExternalActor.objects.filter(
            actor_id=team.actor_id,
            organization=organization,
            integration=integration,
            provider=ExternalProviders.SLACK.value,
        )
        if already_linked:
            ALREADY_LINKED_MESSAGE = (
                f"The {team.slug} team has already been linked to a Slack channel."
            )
            return self.send_error_message(
                request,
                client,
                ALREADY_LINKED_MESSAGE,
                params["response_url"],
                params["channel_id"],
                integration,
            )

        external_team, created = ExternalActor.objects.get_or_create(
            actor_id=team.actor_id,
            organization=organization,
            integration=integration,
            provider=ExternalProviders.SLACK.value,
            external_name=params["channel_name"],
            external_id=params["channel_id"],
        )

        # TODO handle non-happy paths
        if created:
            # turn on notifications for all of a team's projects
            # this will change with a data migration I think :(
            team_projects = team.get_projects()
            for project in team_projects:
                NotificationSetting.objects.update_settings(
                    ExternalProviders.SLACK,
                    NotificationSettingTypes.ISSUE_ALERTS,
                    NotificationSettingOptionValues.ALWAYS,
                    team=team,
                    project=project,
                )
            token = (
                integration.metadata.get("user_access_token")
                or integration.metadata["access_token"]
            )
            headers = {"Authorization": "Bearer %s" % token}
            payload = {
                "token": token,
                "channel": params["channel_id"],
                "text": f"The {team.slug} team will now receive notifications in this channel.",
            }
            client = SlackClient()
            try:
                client.post("/chat.postMessage", headers=headers, data=payload, json=True)
            except ApiError as e:
                message = str(e)
                # If the user took their time to link their slack account, we may no
                # longer be able to respond, and we're not guaranteed able to post into
                # the channel. Ignore Expired url errors.
                #
                # XXX(epurkhiser): Yes the error string has a space in it.
                if message != "Expired url":
                    logger.error("slack.link-notify.response-error", extra={"error": message})
            return render_to_response(
                "sentry/slack-linked-team.html",
                request=request,
                context={"channel_id": params["channel_id"], "team_id": integration.external_id},
            )
