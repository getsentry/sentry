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
from sentry.models import Project
from sentry.utils.compat import map

from .client import VercelClient

DESCRIPTION = """
VERCEL DESC
"""

FEATURES = [
    FeatureDescription(
        """
        DEPLOYMENT DESCRIPTION
        """,
        IntegrationFeatures.DEPLOYMENT,
    ),
]


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?title=Vercel%20Integration:%20&labels=Component%3A%20Integrations",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/vercel",
    aspects={},
)


class VercelIntegration(IntegrationInstallation):
    def get_organization_config(self):
        metadata = self.model.metadata
        vercel_client = VercelClient(metadata["access_token"], metadata.get("team_id"))
        # TODO: add try/catch if we get API failure
        vercel_projects = [
            {"value": p["id"], "label": p["name"]} for p in vercel_client.get_projects()
        ]

        proj_fields = ["id", "platform", "name", "slug"]
        sentry_projects = map(
            lambda proj: {key: proj[key] for key in proj_fields},
            (
                Project.objects.filter(organization_id=self.organization_id)
                .order_by("slug")
                .values(*proj_fields)
            ),
        )

        fields = [
            {
                "name": "project_mappings",
                "type": "project_mapper",
                "mappedDropdown": {
                    "items": vercel_projects,
                    "placeholder": "Select a Vercel Project",  # TOOD: add translation
                },
                "sentryProjects": sentry_projects,
            }
        ]

        return fields


class VercelIntegrationProvider(IntegrationProvider):
    key = "vercel"
    name = "Vercel"
    requires_feature_flag = True
    metadata = metadata
    integration_cls = VercelIntegration
    features = frozenset([IntegrationFeatures.DEPLOYMENT])
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
        access_token = data["access_token"]
        team_id = data.get("team_id")
        client = VercelClient(access_token, team_id)

        if team_id:
            external_id = team_id
            installation_type = "team"
            team = client.get_team()
            name = team["name"]
        else:
            external_id = data["user_id"]
            installation_type = "user"
            user = client.get_user()
            name = user["name"]

        integration = {
            "name": name,
            "external_id": external_id,
            "metadata": {
                "access_token": access_token,
                "installation_id": data["installation_id"],
                "installation_type": installation_type,
            },
        }

        return integration
