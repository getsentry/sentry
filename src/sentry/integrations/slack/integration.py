from collections import namedtuple
from typing import Any, Mapping, Optional, Sequence

from django.utils.translation import ugettext_lazy as _
from django.views import View

from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.slack import tasks
from sentry.models import Integration, NotificationSetting, Organization, User
from sentry.pipeline import NestedPipelineView
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri
from sentry.utils.json import JSONData

from .client import SlackClient
from .utils import logger

Channel = namedtuple("Channel", ["name", "id"])

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
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Slack%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/slack",
    aspects={"alerts": [setup_alert]},
)


class SlackIntegration(IntegrationInstallation):  # type: ignore
    def get_config_data(self) -> Mapping[str, str]:
        metadata_ = self.model.metadata
        # Classic bots had a user_access_token in the metadata.
        default_installation = (
            "classic_bot" if "user_access_token" in metadata_ else "workspace_app"
        )
        return {"installationType": metadata_.get("installation_type", default_installation)}

    def uninstall(self) -> None:
        """
        Delete all parent-specific notification settings. For each user and team,
        if this is their ONLY Slack integration, set their parent-independent
        Slack notification setting to NEVER.
        """
        provider = ExternalProviders.SLACK
        organization = Organization.objects.get(id=self.organization_id)
        users = User.objects.get_users_with_only_one_integration_for_provider(
            provider, organization
        )
        NotificationSetting.objects.remove_parent_settings_for_organization(organization, provider)
        NotificationSetting.objects.disable_settings_for_users(provider, users)


class SlackIntegrationProvider(IntegrationProvider):  # type: ignore
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
            "im:history",
            "chat:write.public",
            "chat:write.customize",
            "commands",
        ]
    )
    user_scopes = frozenset(
        [
            "links:read",
            "users:read",
            "users:read.email",
        ]
    )

    setup_dialog_config = {"width": 600, "height": 900}

    def get_pipeline_views(self) -> Sequence[View]:
        identity_pipeline_config = {
            "oauth_scopes": self.identity_oauth_scopes,
            "user_scopes": self.user_scopes,
            "redirect_url": absolute_uri("/extensions/slack/setup/"),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key="identity",
            provider_key="slack",
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [identity_pipeline_view]

    def get_team_info(self, access_token: str) -> JSONData:
        headers = {"Authorization": f"Bearer {access_token}"}

        client = SlackClient()
        try:
            resp = client.get("/team.info", headers=headers)
        except ApiError as e:
            logger.error("slack.team-info.response-error", extra={"error": str(e)})
            raise IntegrationError("Could not retrieve Slack team information.")

        return resp["team"]

    def build_integration(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
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

        integration = {
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

        return integration

    def post_install(
        self, integration: Integration, organization: Organization, extra: Optional[Any] = None
    ) -> None:
        """
        Create Identity records for an organization's users if their emails match in Sentry and Slack
        """
        run_args = {"integration": integration, "organization": organization}
        tasks.link_slack_user_identities.apply_async(kwargs=run_args)
