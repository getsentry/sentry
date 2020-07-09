from __future__ import absolute_import

import logging

from django.utils.translation import ugettext_lazy as _


from sentry.integrations import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata,
    FeatureDescription,
)
from sentry.pipeline import PipelineView
from .client import MsTeamsClient

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


INSTALL_NOTICE_TEXT = "INSTALL TEXT"

external_install = {
    "url": u"https://google.com",  # TODO: set correct URL
    "buttonText": _("Teams Marketplace"),
    "noticeText": _(INSTALL_NOTICE_TEXT),
}


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new",
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
        team_id = state[self.key]["team_id"]
        client = MsTeamsClient()
        team = client.get_team_info(team_id)
        # TODO: actually store token stuff :)
        integration = {
            "name": team["name"],
            "external_id": team_id,
            "metadata": {},
        }
        return integration


class MsTeamsPipelineView(PipelineView):
    """
    This pipeline step just binds the team ID for now
    """

    def dispatch(self, request, pipeline):
        team_id = request.GET.get("team_id")
        pipeline.bind_state("team_id", team_id)
        return pipeline.next_step()
