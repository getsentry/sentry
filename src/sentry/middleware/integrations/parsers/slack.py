from typing import Sequence

from django.urls import ResolverMatch, resolve
from rest_framework.request import Request
from sentry_sdk import capture_exception

from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.webhooks.base import SlackDMEndpoint
from sentry.models import OrganizationIntegration
from sentry.models.organization import Organization

from .base import BaseRequestParser


class SlackRequestParser(BaseRequestParser):
    endpoint_classes = ["SlackCommandsEndpoint", "SlackActionEndpoint", "SlackEventEndpoint"]

    django_view_classes = [
        "SlackLinkIdentityView",
        "SlackUnlinkIdentityView",
        "SlackLinkTeamView",
        "SlackUnlinkTeamView",
    ]

    installation_view_classes = ["PipelineAdvancerView"]

    def _get_integration(self):
        if self.view_class.__name__ in self.endpoint_classes:
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
        elif self.view_class.__name__ in self.django_view_classes:
            # TODO(Leander) Parse out the integration from this Request.
            pass
        elif self.view_class.__name__ in self.installation_view_classes:
            return None

    def get_response(self):
        match: ResolverMatch = resolve(self.request.path)
        self.view_class = match.func.view_class
        organizations = self.get_organizations()
        print("🔥 Got Organizations")
        print(organizations)
        return self.get_response_from_control_silo()

    def get_organizations(self) -> Sequence[Organization]:
        integration = self._get_integration()
        if not integration:
            return []
        organization_integrations = OrganizationIntegration.objects.filter(
            integration_id=integration
        ).select_related("organization")
        return [integration.organization for integration in organization_integrations]
