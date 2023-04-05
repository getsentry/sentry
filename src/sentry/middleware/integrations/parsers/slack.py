from __future__ import annotations

import logging

from rest_framework.request import Request
from sentry_sdk import capture_exception

from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.webhooks.base import SlackDMEndpoint
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service
from sentry.silo.client import SiloClientError
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils.signing import unsign

from .base import BaseRequestParser

logger = logging.getLogger(__name__)

WEBHOOK_ENDPOINTS = ["SlackCommandsEndpoint", "SlackActionEndpoint", "SlackEventEndpoint"]
"""
Endpoints which provide integration information in the request headers.
See: `src/sentry/integrations/slack/webhooks`
"""

DJANGO_VIEW_ENDPOINTS = [
    "SlackLinkTeamView",
    "SlackUnlinkTeamView",
    "SlackLinkIdentityView",
    "SlackUnlinkIdentityView",
]
"""
Views served directly from the control silo without React.
See: `src/sentry/integrations/slack/views`
"""


class SlackRequestParser(BaseRequestParser):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.SLACK]  # "slack"

    control_classes = [
        "SlackLinkIdentityView",
        "SlackUnlinkIdentityView",
    ]

    region_classes = [
        "SlackLinkTeamView",
        "SlackUnlinkTeamView",
        "SlackCommandsEndpoint",
        "SlackActionEndpoint",
        "SlackEventEndpoint",
    ]

    def get_integration_from_request(self) -> RpcIntegration | None:
        view_class_name = self.match.func.view_class.__name__
        if view_class_name in WEBHOOK_ENDPOINTS:
            # We need convert the raw Django request to a Django Rest Framework request
            # since that's the type the SlackRequest expects
            drf_request: Request = SlackDMEndpoint().initialize_request(self.request)
            slack_request = self.match.func.view_class.slack_request_class(drf_request)
            try:
                slack_request._authorize()
                slack_request._validate_integration()
            except SlackRequestError as error:
                capture_exception(error)
                logger.error("validation_error", extra={"path": self.request.path})
                return None
            return slack_request.integration

        elif view_class_name in DJANGO_VIEW_ENDPOINTS:
            # Parse the signed params and ensure the organization is associated with the
            params = unsign(self.match.kwargs.get("signed_params"))
            return integration_service.get_integration(integration_id=params.get("integration_id"))

    def get_response(self):
        """
        Slack Webhook Requests all require synchronous responses.
        """
        # TODO(Leander): Handle installation pipeline requests

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.error("no_regions", extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        # Django views are returned from the control silo no matter what.
        view_class_name = self.match.func.view_class.__name__
        if view_class_name in self.control_classes:
            return self.get_response_from_control_silo()

        # Slack only requires one synchronous response.
        # By convention, we just assume it's the first returned region.
        first_region = regions[0]
        response_map = self.get_responses_from_region_silos(regions=[first_region])
        region_result = response_map[first_region.name]
        if region_result.error is not None:
            error = SiloClientError(region_result.error)
            capture_exception(error)
            logger.error(
                "region_error", extra={"path": self.request.path, "region": first_region.name}
            )
            # We want to fail loudly so that devs know this error happened on the region silo (for now)
            raise SiloClientError(error)
        return region_result.response
