from typing import Sequence

import sentry_sdk
from rest_framework.request import Request

from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.integrations.slack.webhooks.base import SlackDMEndpoint
from sentry.models import OrganizationIntegration
from sentry.models.organization import Organization

from .base import BaseRequestParser


class SlackRequestParser(BaseRequestParser):
    exempt_paths = ["/extensions/slack/setup/"]

    def get_organizations(self) -> Sequence[Organization]:
        # We need convert the raw Django request to a Django Rest Framework request
        # since that's the type the SlackRequest expects
        drf_request: Request = SlackDMEndpoint().initialize_request(self.request)
        slack_request = SlackRequest(drf_request)
        organizations = []

        try:
            slack_request._authorize()
            slack_request._validate_integration()
        except SlackRequestError as error:
            sentry_sdk.capture_exception(error)
            return []  # Don't fail since this is a middleware

        try:
            organization_integrations = OrganizationIntegration.objects.filter(
                integration_id=slack_request.integration
            ).select_related("organization")
            organizations = [integration.organization for integration in organization_integrations]
        except RuntimeError as error:
            sentry_sdk.capture_exception(error)
            return []  # Don't fail since this is a middleware

        return organizations
