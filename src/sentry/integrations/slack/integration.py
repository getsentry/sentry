from __future__ import absolute_import

import six

from django.utils.translation import ugettext_lazy as _

from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.integrations import (
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
    FeatureDescription,
    IntegrationInstallation,
)

from sentry.pipeline import NestedPipelineView, PipelineView
from sentry.utils.http import absolute_uri
from sentry.shared_integrations.exceptions import ApiError, IntegrationError

from .client import SlackClient
from .utils import logger

from sentry.web.helpers import render_to_response

DESCRIPTION = """
Connect your Sentry organization to one or more Slack workspaces, and start
getting errors right in front of you where all the action happens in your
office!
"""

FEATURES = [
    FeatureDescription(
        """
        Unfurls Sentry URLs directly within Slack, providing you context and
        actionability on issues right at your fingertips. Resolve, ignore, and assign issues with minimal context switching.
        """,
        IntegrationFeatures.CHAT_UNFURL,
    ),
    FeatureDescription(
        """
        Configure rule based Slack notifications to automatically be posted into a
        specific channel. Want any error that's happening more than 100 times a
        minute to be posted in `#critical-errors`? Setup a rule for it!
        """,
        IntegrationFeatures.ALERT_RULE,
    ),
]

setup_alert = {
    "type": "info",
    "text": "The Slack integration adds a new Alert Rule action to all projects. To enable automatic notifications sent to Slack you must create a rule using the slack workspace action in your project settings.",
}

reauthentication_alert = {
    "alertText": "Slack must be re-authorized to avoid a disruption of Slack notifications",
}

metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Workspace"),
    issue_url="https://github.com/getsentry/sentry/issues/new?title=Slack%20Integration:%20&labels=Component%3A%20Integrations",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/slack",
    aspects={"alerts": [setup_alert], "reauthentication_alert": reauthentication_alert},
)


class SlackIntegration(IntegrationInstallation):
    def get_config_data(self):
        metadata = self.model.metadata
        # classic bots had a user_access_token in the metadata
        default_installation = "classic_bot" if "user_access_token" in metadata else "workspace_app"
        return {"installationType": metadata.get("installation_type", default_installation)}


class SlackIntegrationProvider(IntegrationProvider):
    key = "slack"
    name = "Slack"
    metadata = metadata
    features = frozenset([IntegrationFeatures.CHAT_UNFURL, IntegrationFeatures.ALERT_RULE])
    integration_cls = SlackIntegration

    # some info here: https://api.slack.com/authentication/quickstart
    identity_oauth_scopes = frozenset(
        [
            "channels:read",
            "groups:read",
            "users:read",
            "chat:write",
            "links:read",
            "links:write",
            "team:read",
            "im:read",
            "chat:write.public",
            "chat:write.customize",
        ]
    )

    setup_dialog_config = {"width": 600, "height": 900}

    def get_pipeline_views(self):
        identity_pipeline_config = {
            "oauth_scopes": self.identity_oauth_scopes,
            "user_scopes": frozenset(["links:read"]),
            "redirect_url": absolute_uri("/extensions/slack/setup/"),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key="identity",
            provider_key="slack",
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [SlackReAuthIntro(), SlackReAuthChannels(), identity_pipeline_view]

    def get_team_info(self, access_token):
        payload = {"token": access_token}

        client = SlackClient()
        try:
            resp = client.get("/team.info", params=payload)
        except ApiError as e:
            logger.error("slack.team-info.response-error", extra={"error": six.text_type(e)})
            raise IntegrationError("Could not retrieve Slack team information.")

        return resp["team"]

    def build_integration(self, state):
        data = state["identity"]["data"]
        assert data["ok"]

        access_token = data["access_token"]
        # bot apps have a different response format
        # see: https://api.slack.com/authentication/quickstart#installing
        user_id_slack = data["authed_user"]["id"]
        team_name = data["team"]["name"]
        team_id = data["team"]["id"]

        scopes = sorted(self.identity_oauth_scopes)
        team_data = self.get_team_info(access_token)

        metadata = {
            "access_token": access_token,
            "scopes": scopes,
            "icon": team_data["icon"]["image_132"],
            "domain_name": team_data["domain"] + ".slack.com",
            "installation_type": "born_as_bot",
        }

        if state.get("integration_id"):
            metadata["installation_type"] = "migrated_to_bot"

        return {
            "name": team_name,
            "external_id": team_id,
            "metadata": metadata,
            "user_identity": {
                "type": "slack",
                "external_id": user_id_slack,
                "scopes": [],
                "data": {},
            },
        }


class SlackReAuthIntro(PipelineView):
    """
        This pipeline step handles rendering the migration
        intro with context about the migration.

        If the `integration_id` is not present in the request
        then we can fast forward through the pipeline to move
        on to installing the integration as normal.

    """

    def dispatch(self, request, pipeline):
        if "integration_id" in request.GET:
            pipeline.bind_state("integration_id".request.GET["integration_id"])

        # this should be nested but leaving here for now
        next_url_param = "?show_alert_rules"
        channels = []

        if "show_alert_rules" in request.GET:
            return pipeline.next_step()

        return render_to_response(
            template="sentry/integrations/slack-reauth-intro.html",
            context={
                "next_url": "%s%s" % (absolute_uri("/extensions/slack/setup/"), next_url_param),
                "channels": channels,
            },
            request=request,
        )

        # if we dont have the integration_id we dont care about the
        # migration path, skip straight to install
        pipeline.state.step_index = 2
        return pipeline.current_step()


class SlackReAuthChannels(PipelineView):
    """
        This pipeline step handles rendering the channels
        that are problematic:

        1. private
        2. removed
        3. unauthorized

        Any private channels in alert rules will also be binded
        to the pipeline state to be used later.

    """

    def dispatch(self, request, pipeline):
        next_url_param = "?start_migration"
        channels = _get_channels(pipeline.organization)

        if "start_migration" in request.GET:
            return pipeline.next_step()

        return render_to_response(
            template="sentry/integrations/slack-reauth-intro.html",
            context={
                "next_url": "%s%s" % (absolute_uri("/extensions/slack/setup/"), next_url_param),
                "channels": channels,
            },
            request=request,
        )


def _get_channels(pipeline):
    # todo: get all the channels from the alert rules
    # and then make requests to slack using old access token (which
    # will still be stored as access_token cause we havent migrated yet)
    organization = pipeline.organization
    integration_id = pipeline.state.get("integration_id")

    from sentry.models import Rule

    Rule.objects.filter(
        project__in=organization.project_set().all(), status=0,
    )
