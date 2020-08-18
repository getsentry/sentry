from __future__ import absolute_import

import logging

from django.utils.translation import ugettext_lazy as _


from sentry import options
from sentry.integrations import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata,
    FeatureDescription,
)
from sentry.pipeline import PipelineView
from .client import get_token_data

logger = logging.getLogger("sentry.integrations.msteams")

DESCRIPTION = """
MS TEAMS DESC
"""


FEATURES = [
    FeatureDescription(
        """
        Teams unfurl
        """,
        IntegrationFeatures.CHAT_UNFURL,
    ),
    FeatureDescription(
        """
        Teams alert rule
        """,
        IntegrationFeatures.ALERT_RULE,
    ),
]


INSTALL_NOTICE_TEXT = (
    "Visit the Teams Marketplace to install this integration. After adding the integration"
    " to your team, you will get a message in the General channel to complete installation."
)

external_install = {
    "url": u"https://teams.microsoft.com/l/app/%s" % options.get("msteams.app-id"),
    "buttonText": _("Teams Marketplace"),
    "noticeText": _(INSTALL_NOTICE_TEXT),
}


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?title=Microsoft%20Teams%20Integration:%20&labels=Component%3A%20Integrations",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/msteams",
    aspects={"externalInstall": external_install},
)


class MsTeamsIntegration(IntegrationInstallation):
    pass


class MsTeamsIntegrationProvider(IntegrationProvider):
    key = "msteams"
    name = "Microsoft Teams (development)"
    requires_feature_flag = True
    can_add = False
    metadata = metadata
    integration_cls = MsTeamsIntegration
    features = frozenset([IntegrationFeatures.CHAT_UNFURL, IntegrationFeatures.ALERT_RULE])

    def get_pipeline_views(self):
        return [MsTeamsPipelineView()]

    def build_integration(self, state):
        data = state[self.key]
        team_id = data["team_id"]
        team_name = data["team_name"]
        service_url = data["service_url"]

        # TODO: add try/except for request errors
        token_data = get_token_data()

        integration = {
            "name": team_name,
            "external_id": team_id,
            "metadata": {
                "access_token": token_data["access_token"],
                "expires_at": token_data["expires_at"],
                "service_url": service_url,
            },
            "user_identity": {"type": "msteams", "external_id": team_id, "scopes": [], "data": {}},
        }
        return integration


class MsTeamsPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        return pipeline.next_step()
