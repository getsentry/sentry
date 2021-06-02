from collections import namedtuple

from django.utils.translation import ugettext_lazy as _

from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.models import Identity, IdentityProvider, IdentityStatus
from sentry.pipeline import NestedPipelineView
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils.http import absolute_uri

from .client import SlackClient
from .utils import get_integration_type, logger

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
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug_report.md&title=Slack%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/slack",
    aspects={"alerts": [setup_alert]},
)


class SlackIntegration(IntegrationInstallation):
    def get_config_data(self):
        return {"installationType": get_integration_type(self.model)}


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
            "im:history",
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

        return [identity_pipeline_view]

    def get_team_info(self, access_token):
        headers = {"Authorization": "Bearer %s" % access_token}

        client = SlackClient()
        try:
            resp = client.get("/team.info", headers=headers)
        except ApiError as e:
            logger.error("slack.team-info.response-error", extra={"error": str(e)})
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

    def post_install(self, integration, organization, extra=None):
        """
        Create an Identity record for an org's users if their emails match
        """
        access_token = (
            integration.metadata.get("user_access_token") or integration.metadata["access_token"]
        )
        headers = {"Authorization": "Bearer %s" % access_token}
        client = SlackClient()
        # TODO put this all in a task
        for org in integration.organizations.all():
            for member in org.members.all():
                # skip the API call if they already have an identity
                # however in tests there is already an identity so not sure what to do there yet
                # probably make this a tighter lookup including idp (not just idp__type)
                # try:
                #     identity = Identity.objects.get(
                #         idp__type=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
                #         user=member.id,
                #     )
                # except Identity.DoesNotExist:
                try:
                    # TODO what if they have more than one email? or none? can they have none?
                    resp = client.get(
                        "/users.lookupByEmail/", headers=headers, params={"email": member.email}
                    )
                except ApiError as e:
                    logger.info(
                        "post_install.fail.slack_lookupByEmail",
                        extra={
                            "error": str(e),
                            "organization": org.slug,
                            "integration_id": integration.id,
                            "email": member.email,
                        },
                    )
                    # probably just keep going, but commenting out now so I don't get false positives in tests
                    # continue
                # import pdb; pdb.set_trace()
                if resp["ok"] is True:
                    if member.email != resp["user"]["profile"]["email"]:
                        continue
                    else:
                        idp = IdentityProvider.objects.create(
                            type=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
                            external_id=resp["user"]["team_id"],
                            config={},
                        )
                        identity, created = Identity.objects.get_or_create(
                            external_id=resp["user"]["id"],
                            idp=idp,
                            user=member,
                            status=IdentityStatus.VALID,
                            scopes=[],
                        )
                        # identity_model, created = Identity.objects.get_or_create(
                        #     idp=idp,
                        #     user=self.request.user,
                        #     external_id=identity["external_id"],
                        #     defaults=identity_data,
                        # )
                else:
                    logger.info(
                        "post_install.no_match.slack_lookupByEmail",
                        extra={
                            "organization": org.slug,
                            "integration_id": integration.id,
                            "email": member.email,
                        },
                    )
