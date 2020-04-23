from __future__ import absolute_import

import six

from django.utils.translation import ugettext_lazy as _
from django.conf import settings

from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.integrations import (
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
    FeatureDescription,
)
from sentry.pipeline import NestedPipelineView
from sentry.utils.http import absolute_uri
from sentry.shared_integrations.exceptions import ApiError

from .client import SlackClient
from .utils import logger, use_slack_v2

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

metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Workspace"),
    issue_url="https://github.com/getsentry/sentry/issues/new?title=Slack%20Integration:%20&labels=Component%3A%20Integrations",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/slack",
    aspects={"alerts": [setup_alert]},
)


class SlackIntegrationProvider(IntegrationProvider):
    key = "slack"
    name = "Slack"
    metadata = metadata
    features = frozenset([IntegrationFeatures.CHAT_UNFURL, IntegrationFeatures.ALERT_RULE])

    # Scopes differ depending on if it's a workspace app
    wst_oauth_scopes = frozenset(
        [
            "channels:read",
            "groups:read",
            "users:read",
            "chat:write",
            "links:read",
            "links:write",
            "team:read",
        ]
    )

    # some info here: https://api.slack.com/authentication/quickstart
    bot_oauth_scopes = frozenset(
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

    @property
    def use_wst_app(self):
        return settings.SLACK_INTEGRATION_USE_WST and not use_slack_v2(self.pipeline)

    @property
    def identity_oauth_scopes(self):
        if self.use_wst_app:
            return self.wst_oauth_scopes
        return self.bot_oauth_scopes

    def get_pipeline_views(self):
        identity_pipeline_config = {
            "oauth_scopes": self.identity_oauth_scopes,
            "redirect_url": absolute_uri("/extensions/slack/setup/"),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key="identity",
            provider_key="slack",
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [identity_pipeline_view]

    def get_team_info(self, access_token):
        payload = {"token": access_token}

        client = SlackClient()
        try:
            resp = client.get("/team.info", params=payload)
        except ApiError as e:
            logger.error("slack.team-info.response-error", extra={"error": six.text_type(e)})

        return resp["team"]

    def build_integration(self, state):
        data = state["identity"]["data"]
        assert data["ok"]

        access_token = data["access_token"]
        # bot apps have a different response format
        # see: https://api.slack.com/authentication/quickstart#installing
        if self.use_wst_app:
            user_id_slack = data["authorizing_user_id"]
            team_name = data["team_name"]
            team_id = data["team_id"]
        else:
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
        }
        # only set installation type for bot apps
        if not self.use_wst_app:
            metadata["installation_type"] = "born_as_bot"

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
