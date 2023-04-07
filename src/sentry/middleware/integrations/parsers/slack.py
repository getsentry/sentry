from __future__ import annotations

import logging
from typing import List

from django.http import HttpResponse
from rest_framework.request import Request
from sentry_sdk import capture_exception

from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.webhooks.action import SlackActionEndpoint
from sentry.integrations.slack.webhooks.base import SlackDMEndpoint
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service
from sentry.silo.client import SiloClientError
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.types.region import Region
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
        "PipelineAdvancerView",  # installation
    ]

    region_classes = [
        "SlackLinkTeamView",
        "SlackUnlinkTeamView",
        "SlackCommandsEndpoint",
        "SlackEventEndpoint",
    ]

    def handle_action_endpoint(self, regions: List[Region]) -> HttpResponse:
        drf_request: Request = SlackDMEndpoint().initialize_request(self.request)
        slack_request = self.match.func.view_class.slack_request_class(drf_request)
        action_option = SlackActionEndpoint.get_action_option(slack_request=slack_request)

        if action_option in ["link", "ignore", "all_slack"]:
            return self.get_response_from_control_silo()
        else:
            response_map = self.get_responses_from_region_silos(regions=regions)
            successful_responses = [
                result for result in response_map.values() if result.response is not None
            ]
            if len(successful_responses < 1):
                error_map = {region: result.error for region, result in response_map.items()}
                logger.error(
                    "all_regions_error",
                    extra={"path": self.request.path, "error_map": error_map},
                )
                raise SiloClientError("No successful region responses")
            return successful_responses[0].response

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
        view_class_name = self.match.func.view_class.__name__

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.error("no_regions", extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        view_class_name = self.match.func.view_class.__name__
        if view_class_name in self.control_classes:
            return self.get_response_from_control_silo()

        # Handle the actions endpoint seperately -- parse the payload to identify the silo
        if view_class_name == "SlackActionEndpoint":
            return self.handle_action_endpoint(regions=regions)

        # Slack webhooks can only receive one synchronous call/response, as there are many
        # places where we post to slack on their webhook request. This would cause multiple
        # calls back to slack for every region we forward to.
        # By convention, we use the first integration organization/region
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
