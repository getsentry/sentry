from __future__ import annotations

import logging

from django.http import HttpResponse
from rest_framework.request import Request
from sentry_sdk import capture_exception

from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.webhooks.base import SlackDMEndpoint
from sentry.models.integrations import Integration, OrganizationIntegration
from sentry.utils.signing import unsign

from .base import BaseRequestParser

logger = logging.getLogger(__name__)


class SlackRequestParser(BaseRequestParser):
    endpoint_classes = ["SlackCommandsEndpoint", "SlackActionEndpoint", "SlackEventEndpoint"]
    """
    Endpoints which provide integration information in the request headers.
    See: `src/sentry/integrations/slack/webhooks`
    """

    django_view_classes = [
        "SlackLinkIdentityView",
        "SlackUnlinkIdentityView",
        "SlackLinkTeamView",
        "SlackUnlinkTeamView",
    ]
    """
    Views served directly from the control silo without React.
    See: `src/sentry/integrations/slack/views`
    """

    installation_view_classes = ["PipelineAdvancerView"]
    """
    Django views which will not map to an existing integration
    """

    def get_integration(self) -> Integration | None:
        view_class_name = self.match.func.view_class.__name__
        if view_class_name in self.endpoint_classes:
            # We need convert the raw Django request to a Django Rest Framework request
            # since that's the type the SlackRequest expects
            drf_request: Request = SlackDMEndpoint().initialize_request(self.request)
            slack_request = self.match.func.view_class.slack_request_class(drf_request)
            try:
                slack_request._authorize()
                slack_request._validate_integration()
            except SlackRequestError as error:
                capture_exception(error)
                logger.error(
                    "integration_control.slack.validation_error",
                    extra={"path": self.request.path},
                )
                return None
            return slack_request.integration
        elif view_class_name in self.django_view_classes:
            # Parse the signed params and ensure the organization is associated with the
            params = unsign(self.match.kwargs.get("signed_params"))
            organization_integration = OrganizationIntegration.objects.filter(
                integration_id=params.get("integration_id"),
            ).first()
            return organization_integration.integration
        elif view_class_name in self.installation_view_classes:
            return None

    def get_response(self):
        """
        Slack Webhook Requests all require synchronous responses.
        """
        regions = self.get_regions()
        if len(regions) == 0:
            logger.error(
                "integration_control.slack.no_regions",
                extra={"path": self.request.path},
            )
            return self.get_response_from_control_silo()

        # Django views are returned from the control silo no matter what.
        view_class_name = self.match.func.view_class.__name__
        if view_class_name in self.django_view_classes:
            return self.get_response_from_control_silo()

        # Slack only requires one synchronous response.
        # By convention, we just assume it's the first returned region.
        first_region = regions[0]
        response_map = self.get_response_from_region_silos(regions=[first_region])
        result = response_map[first_region.name]
        if type(result) is HttpResponse:
            return result
        else:
            logger.error(
                "integration_control.slack.region_error",
                extra={"path": self.request.path, "region": first_region.name},
            )
            capture_exception(result)
            return self.get_response_from_control_silo()
