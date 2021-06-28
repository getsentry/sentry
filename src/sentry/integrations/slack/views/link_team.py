from django import forms
from django.urls import reverse
from django.views.decorators.cache import never_cache

from sentry.models import (
    ExternalActor,
    Identity,
    IdentityProvider,
    Integration,
    NotificationSetting,
    OrganizationMember,
    Team,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign, unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

from ..client import SlackClient
from ..utils import logger


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
    def get_identity(self, request, integration, slack_id):
        try:
            idp = IdentityProvider.objects.get(type="slack", external_id=integration.external_id)
        except IdentityProvider.DoesNotExist:
            logger.error(
                "slack.action.invalid-team-id", extra={"slack_id": integration.external_id}
            )
            return self.render_error_page(request, body_text="HTTP 403: Invalid team ID")

        try:
            identity = Identity.objects.select_related("user").get(idp=idp, external_id=slack_id)
        except Identity.DoesNotExist:
            logger.error(
                "slack.action.missing-identity", extra={"slack_id": integration.external_id}
            )
            return self.render_error_page(
                request, body_text="HTTP 403: User identity does not exist"
            )
        return identity

    def render_error_page(self, request, body_text):
        return render_to_response(
            "sentry/integrations/slack-link-team-error.html",
            request=request,
            context={"body_text": body_text},
        )

    def send_slack_message(self, request, client, token, text, channel_id, integration):
        payload = {
            "token": token,
            "channel": channel_id,
            "text": text["body"],
        }
        headers = {"Authorization": "Bearer %s" % token}
        try:
            client.post("/chat.postMessage", headers=headers, data=payload, json=True)
        except ApiError as e:
            message = str(e)
            if message != "Expired url":
                logger.error("slack.link-notify.response-error", extra={"error": message})
        else:
            return render_to_response(
                "sentry/integrations/slack-post-linked-team.html",
                request=request,
                context={
                    "heading_text": text["heading"],
                    "body_text": text["body"],
                    "channel_id": channel_id,
                    "team_id": integration.external_id,
                },
            )

    @transaction_start("SlackLinkTeamView")
    @never_cache
    def handle(self, request, signed_params):
        params = unsign(signed_params)
        integration = Integration.objects.get(id=params["integration_id"])
        organization = integration.organizations.all()[0]
        teams = Team.objects.get_for_user(organization, request.user)
        channel_name = params["channel_name"]
        channel_id = params["channel_id"]
        form = SelectTeamForm(teams, request.POST or None)
        if request.method not in ["POST", "GET"]:
            return self.render_error_page(request, body_text="HTTP 405: Method not allowed")

        if request.method == "POST":
            if not form.is_valid():
                return self.render_error_page(request, body_text="HTTP 400: Bad request")
            team_id = form.cleaned_data["team"]

        if request.method == "GET":
            return self.respond(
                "sentry/integrations/slack-link-team.html",
                {
                    "form": form,
                    "teams": teams,
                    "channel_name": channel_name,
                    "provider": integration.get_provider(),
                },
            )

        team = Team.objects.get(id=team_id, organization=organization)
        if not team:
            return self.render_error_page(body_text="HTTP 404: Team does not exist")

        INSUFFICIENT_ROLE_MESSAGE = {
            "heading": "Insufficient role",
            "body": "You must be an admin or higher to link teams.",
        }
        ALREADY_LINKED_MESSAGE = {
            "heading": "Already linked",
            "body": f"The {team.slug} team has already been linked to a Slack channel.",
        }
        SUCCESS_LINKED_MESSAGE = {
            "heading": "Team linked",
            "body": f"The {team.slug} team will now receive issue alert notifications in the {channel_name} channel.",
        }
        identity = self.get_identity(request, integration, params["slack_id"])
        org_member = OrganizationMember.objects.get(user=identity.user, organization=organization)
        client = SlackClient()
        token = (
            integration.metadata.get("user_access_token") or integration.metadata["access_token"]
        )
        allowed_roles = ["admin", "manager", "owner"]
        if not (
            org_member.role in allowed_roles
            and (organization.flags.allow_joinleave or team in org_member.teams.all())
        ):
            return self.send_slack_message(
                request,
                client,
                token,
                INSUFFICIENT_ROLE_MESSAGE,
                channel_id,
                integration,
            )

        if ExternalActor.objects.filter(
            actor_id=team.actor_id,
            organization=organization,
            integration=integration,
            provider=ExternalProviders.SLACK.value,
        ).exists():
            return self.send_slack_message(
                request,
                client,
                token,
                ALREADY_LINKED_MESSAGE,
                channel_id,
                integration,
            )

        external_team, created = ExternalActor.objects.get_or_create(
            actor_id=team.actor_id,
            organization=organization,
            integration=integration,
            provider=ExternalProviders.SLACK.value,
            external_name=channel_name,
            external_id=channel_id,
        )

        if created:
            NotificationSetting.objects.update_settings(
                ExternalProviders.SLACK,
                NotificationSettingTypes.ISSUE_ALERTS,
                NotificationSettingOptionValues.ALWAYS,
                team=team,
            )
            return self.send_slack_message(
                request,
                client,
                token,
                SUCCESS_LINKED_MESSAGE,
                channel_id,
                integration,
            )
