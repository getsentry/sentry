from __future__ import absolute_import

import re
from django.utils.text import slugify
from django.utils.translation import ugettext_lazy as _

from sentry import http, options

from sentry.integrations import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata,
    FeatureDescription,
)
from sentry.pipeline import PipelineView
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.utils.http import absolute_uri


DESCRIPTION = """
VERCEL DESC
"""

FEATURES = [
    FeatureDescription(
        """
        Authorize repositories to be added to your Sentry organization to augment
        sentry issues with commit data with [deployment
        tracking](https://docs.sentry.io/learn/releases/).
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
    metadata = metadata
    integration_cls = VercelIntegration
    features = frozenset([IntegrationFeatures.COMMITS])
    oauth_redirect_url = "/extensions/vercel/configure/"

    setup_dialog_config = {"width": 1030, "height": 1000}

    def get_pipeline_views(self):
        identity_pipeline_config = {"redirect_url": absolute_uri(self.oauth_redirect_url)}

        identity_pipeline_view = NestedPipelineView(
            bind_key="identity",
            provider_key=self.key,
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [identity_pipeline_view]

    # def get_pipeline_views(self):
    #     return [VercelStep1()]

    def build_integration(self, state):
        print("build_integration", state)

        integration = {
            "name": "name",
            # TODO(adhiraj): This should be a constant representing the entire github cloud.
            "external_id": "some_id",
            "metadata": {
                # The access token will be populated upon API usage
                "access_token": None,
            },
        }

        return integration


# class VercelStep1(PipelineView):
#     """
#         This pipeline step handles rendering the migration
#         intro with context about the migration.

#         If the `integration_id` is not present in the request
#         then we can fast forward through the pipeline to move
#         on to installing the integration as normal.

#     """

#     def dispatch(self, request, pipeline):
#         print("here")
#         return pipeline.next_step()
