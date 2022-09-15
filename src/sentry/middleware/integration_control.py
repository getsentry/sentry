import re
from typing import Sequence

from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.models import OrganizationIntegration
from sentry.models.organization import Organization
from sentry.silo import SiloMode
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders


class BaseRequestParser:
    # These are paths that will not be have their requests forwarded, and will be
    # handled by the Control Silo directly.
    exempt_paths = []

    def __init__(self, request):
        self.request = request

    def should_operate(self):
        return self.request.path not in self.exempt_paths

    def get_organizations(self):
        raise NotImplementedError

    def get_regions(self):
        organizations: Sequence[Organization] = self.get_organizations()
        return [organization.region for organization in organizations]


class SlackRequestParser(BaseRequestParser):
    exempt_paths = ["/extensions/slack/setup/"]

    def get_organizations(self):
        slack_request = SlackRequest(self.request)

        try:
            slack_request._authorize()
            slack_request._validate_integration()
        except SlackRequestError:
            # TODO(Leander): Log this occurance
            return []

        try:
            organizations = OrganizationIntegration.objects.filter(
                integration_id=slack_request.integration
            ).select_related("organization")
            print(organizations)
        except RuntimeError:
            # TODO(Leander): Log this occurance
            return []

        return []


class IntegrationControlMiddleware:
    webhook_prefix = "/extensions/"

    integration_parsers = {EXTERNAL_PROVIDERS[ExternalProviders.SLACK]: SlackRequestParser}

    def __init__(self, get_response):
        self.get_response = get_response
        self.silo_mode = SiloMode.get_current_mode()

    def _identify_provider(self, request) -> str:
        """
        Parses the provider out of the request path
            e.g. `/extensions/slack/commands/` -> `slack`
        """
        # TODO(Leander): Catch errors in this method
        webhook_prefix_regex = self.webhook_prefix.replace("/", "\/")
        provider_regex = f"^{webhook_prefix_regex}(\w+)"
        result = re.search(provider_regex, request.path)
        return result.group(1)

    def _should_operate(self, request):
        """
        Determines whether this middleware will operate or just pass the request along.
        """
        is_correct_silo = self.silo_mode == SiloMode.MONOLITH
        is_webhook = request.path.startswith(self.webhook_prefix)
        return is_correct_silo and is_webhook

    def __call__(self, request):
        if not self._should_operate(request):
            return self.get_response(request)

        provider = self._identify_provider(request)
        # TODO(Leander): Catch errors at this stage
        parser = self.integration_parsers.get(provider)(request)

        if not parser.should_operate():
            return self.get_response

        regions = parser.get_regions()
        print("This middleware should forward the webhooks to the following regions:")
        print(regions)

        # Code to be executed for each request before
        # the view (and later middleware) are called.

        response = self.get_response(request)

        # Code to be executed for each request/response after
        # the view is called.

        return response


# def process_response(self, request, response):
# 		# Run the integration specific parser
# 		provider = get_provider_from_request_path(request)
# 		regions = parsers.get(provider)(request) or []

# 		# Forward the requests
# 		for region in regions:
# 				region.schedule_request(request)

# 		# Respond non-commital
# 		return Response(404) if not regions else Response(204)
