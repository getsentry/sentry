from __future__ import absolute_import

import logging
import time

from django.utils.translation import ugettext_lazy as _


from sentry.integrations import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata,
    FeatureDescription,
)
from sentry.pipeline import PipelineView
from sentry.shared_integrations.exceptions import IntegrationError
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
        }
        return integration


class MsTeamsPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        data = pipeline.fetch_state("msteams")
        # check the expiration time of the link
        if int(time.time()) > data["expiration_time"]:
            return pipeline.error(IntegrationError("Installation link expired"))
        return pipeline.next_step()
