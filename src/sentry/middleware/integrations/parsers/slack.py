from __future__ import annotations

import logging
from typing import List

from django.http import HttpResponse
from rest_framework.request import Request

from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.views.link_identity import SlackLinkIdentityView
from sentry.integrations.slack.views.link_team import SlackLinkTeamView
from sentry.integrations.slack.views.unlink_identity import SlackUnlinkIdentityView
from sentry.integrations.slack.views.unlink_team import SlackUnlinkTeamView
from sentry.integrations.slack.webhooks.action import (
    NOTIFICATION_SETTINGS_ACTION_OPTIONS,
    UNFURL_ACTION_OPTIONS,
    SlackActionEndpoint,
)
from sentry.integrations.slack.webhooks.base import SlackDMEndpoint
from sentry.integrations.slack.webhooks.command import SlackCommandsEndpoint
from sentry.integrations.slack.webhooks.event import SlackEventEndpoint
from sentry.models.integrations.integration import Integration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.silo.client import SiloClientError
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.types.region import Region
from sentry.utils.signing import unsign

from .base import BaseRequestParser

logger = logging.getLogger(__name__)

ACTIONS_ENDPOINT_ALL_SILOS_ACTIONS = UNFURL_ACTION_OPTIONS + NOTIFICATION_SETTINGS_ACTION_OPTIONS


class SlackRequestParser(BaseRequestParser):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.SLACK]  # "slack"
    webhook_identifier = WebhookProviderIdentifier.SLACK

    control_classes = [
        SlackLinkIdentityView,
        SlackUnlinkIdentityView,
    ]

    region_classes = [
        SlackLinkTeamView,
        SlackUnlinkTeamView,
        SlackCommandsEndpoint,
        SlackEventEndpoint,
    ]

    webhook_endpoints = [SlackCommandsEndpoint, SlackActionEndpoint, SlackEventEndpoint]
    """
    Endpoints which provide integration info in the request headers.
    See: `src/sentry/integrations/slack/webhooks`
    """

    django_views = [
        SlackLinkTeamView,
        SlackUnlinkTeamView,
        SlackLinkIdentityView,
        SlackUnlinkIdentityView,
    ]
    """
    Views which contain integration info in query params
    See: `src/sentry/integrations/slack/views`
    """

    def handle_action_endpoint(self, regions: List[Region]) -> HttpResponse:
        drf_request: Request = SlackDMEndpoint().initialize_request(self.request)
        slack_request = self.match.func.view_class.slack_request_class(drf_request)
        action_option = SlackActionEndpoint.get_action_option(slack_request=slack_request)

        if action_option in ACTIONS_ENDPOINT_ALL_SILOS_ACTIONS:
            return self.get_response_from_control_silo()
        else:
            response_map = self.get_responses_from_region_silos(regions=regions)
            successful_responses = [
                result for result in response_map.values() if result.response is not None
            ]
            if len(successful_responses) == 0:
                error_map = {region: result.error for region, result in response_map.items()}
                logger.error(
                    "all_regions_error",
                    extra={"path": self.request.path, "error_map": error_map},
                )
                raise SiloClientError("No successful region responses")
            return successful_responses[0].response

    def get_integration_from_request(self) -> Integration | None:
        view_class = self.match.func.view_class
        if view_class in self.webhook_endpoints:
            # We need convert the raw Django request to a Django Rest Framework request
            # since that's the type the SlackRequest expects
            drf_request: Request = SlackDMEndpoint().initialize_request(self.request)
            slack_request = self.match.func.view_class.slack_request_class(drf_request)
            try:
                slack_request.authorize()
                slack_request.validate_integration()
            except SlackRequestError as error:
                logger.error("validation_error", extra={"path": self.request.path, "error": error})
                return None
            return Integration.objects.filter(id=slack_request.integration.id).first()

        elif view_class in self.django_views:
            # Parse the signed params to identify the associated integration
            params = unsign(self.match.kwargs.get("signed_params"))
            return Integration.objects.filter(id=params.get("integration_id")).first()

    def get_response_from_first_region(self):
        regions = self.get_regions_from_organizations()
        first_region = regions[0]
        response_map = self.get_responses_from_region_silos(regions=[first_region])
        region_result = response_map[first_region.name]
        if region_result.error is not None:
            error = SiloClientError(region_result.error)
            logger.error(
                "region_error",
                extra={"path": self.request.path, "region": first_region.name, "error": error},
            )
            # We want to fail loudly so that devs know this error happened on the region silo (for now)
            raise SiloClientError(error)
        return region_result.response

    def get_response_from_all_regions(self):
        regions = self.get_regions_from_organizations()
        response_map = self.get_responses_from_region_silos(regions=regions)
        successful_responses = [
            result for result in response_map.values() if result.response is not None
        ]
        if len(successful_responses) == 0:
            error_map = {region: result.error for region, result in response_map.items()}
            logger.error(
                "all_regions_error",
                extra={"path": self.request.path, "error_map": error_map},
            )
            raise SiloClientError("No successful region responses")
        return successful_responses[0].response

    def get_response(self):
        """
        Slack Webhook Requests all require synchronous responses.
        """
        view_class = self.match.func.view_class
        if view_class in self.control_classes:
            return self.get_response_from_control_silo()

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.error("no_regions", extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        if view_class == SlackActionEndpoint:
            drf_request: Request = SlackDMEndpoint().initialize_request(self.request)
            slack_request = self.match.func.view_class.slack_request_class(drf_request)
            action_option = SlackActionEndpoint.get_action_option(slack_request=slack_request)

            # All actions other than those below are sent to every region
            if action_option not in ACTIONS_ENDPOINT_ALL_SILOS_ACTIONS:
                return self.get_response_from_all_regions()

        # Slack webhooks can only receive one synchronous call/response, as there are many
        # places where we post to slack on their webhook request. This would cause multiple
        # calls back to slack for every region we forward to.
        # By convention, we use the first integration organization/region
        return self.get_response_from_first_region()
