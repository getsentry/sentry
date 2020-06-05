from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _


from sentry.integrations import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata,
    FeatureDescription,
)
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.utils.http import absolute_uri

from .client import VercelClient

DESCRIPTION = """
VERCEL DESC
"""

FEATURES = [
    FeatureDescription(
        """
        COMMIT DESCRIPTION
        """,
        IntegrationFeatures.COMMITS,
    ),
]


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?title=GitHub%20Integration:%20&labels=Component%3A%20Integrations",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github",
    aspects={},
)


class VercelIntegration(IntegrationInstallation):
    pass


class VercelIntegrationProvider(IntegrationProvider):
    key = "vercel"
    name = "Vercel"
    requires_feature_flag = True
    metadata = metadata
    integration_cls = VercelIntegration
    features = frozenset([IntegrationFeatures.COMMITS])
    oauth_redirect_url = "/extensions/vercel/configure/"

    def get_pipeline_views(self):
        identity_pipeline_config = {"redirect_url": absolute_uri(self.oauth_redirect_url)}

        identity_pipeline_view = NestedPipelineView(
            bind_key="identity",
            provider_key=self.key,
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [identity_pipeline_view]

    def build_integration(self, state):
        data = state["identity"]["data"]
        vercel = state["vercel"]
        access_token = data["access_token"]
        client = VercelClient(access_token)

        if data["team_id"]:
            external_id = data["team_id"]
            installation_target = "team"
            team = client.get_team(external_id)
            name = team["name"]
        else:
            external_id = data["user_id"]
            installation_target = "user"
            user = client.get_user()
            name = user["name"]

        integration = {
            "name": name,
            "external_id": external_id,
            "metadata": {
                "access_token": access_token,
                "configuration_id": vercel["configurationId"],
                "installation_target": installation_target,
            },
        }

        return integration
