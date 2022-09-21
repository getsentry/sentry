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
    def get_organizations(self) -> Sequence[Organization]:
        match: ResolverMatch = resolve(self.request.path)
        # We need convert the raw Django request to a Django Rest Framework request
        # since that's the type the SlackRequest expects
        drf_request: Request = SlackDMEndpoint().initialize_request(self.request)
        slack_request_class = match.func.view_class.slack_request_class
        slack_request = slack_request_class(drf_request)
        organizations = []

        try:
            slack_request._authorize()
            slack_request._validate_integration()
        except SlackRequestError as error:
            capture_exception(error)
            return []  # Don't fail since this is a middleware

        try:
            organization_integrations = OrganizationIntegration.objects.filter(
                integration_id=slack_request.integration
            ).select_related("organization")
            organizations = [integration.organization for integration in organization_integrations]
        except RuntimeError as error:
            capture_exception(error)
            return []  # Don't fail since this is a middleware
        return organizations
