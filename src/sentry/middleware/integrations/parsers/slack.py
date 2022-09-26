from django.urls import ResolverMatch, resolve
from rest_framework.request import Request
from sentry_sdk import capture_exception

from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.webhooks.base import SlackDMEndpoint
from sentry.models.integrations import OrganizationIntegration
from sentry.utils.signing import unsign

from .base import BaseRequestParser


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

    def get_integration(self):
        view_class_name = self.match.func.view_class.__name__
        if view_class_name in self.endpoint_classes:
            # We need convert the raw Django request to a Django Rest Framework request
            # since that's the type the SlackRequest expects
            drf_request: Request = SlackDMEndpoint().initialize_request(self.request)
            slack_request = self.view_class.slack_request_class(drf_request)
            try:
                slack_request._authorize()
                slack_request._validate_integration()
            except SlackRequestError as error:
                capture_exception(error)
                return
            return slack_request.integration
        elif view_class_name in self.django_view_classes:
            # Parse the signed params and ensure the organization is associated with the
            params = unsign(self.match.kwargs.get("signed_params"))
            organization_integration = OrganizationIntegration.objects.get(
                organization_id=params.get("organization_id"),
                integration_id=params.get("integration_id"),
            )
            return organization_integration.integration
        elif view_class_name in self.installation_view_classes:
            return None

    def get_response(self):
        """
        Slack Webhook Requests all require synchronous responses.
        """
        self.match: ResolverMatch = resolve(self.request.path)
        regions = self.get_regions()
        if len(regions) == 0:
            return self.get_response_from_control_silo()
        # Slack only requires one synchronous response.
        # By convention, we just assume it's the first returned region.
        return self.get_response_from_region_silo(regions=[regions[0]])
