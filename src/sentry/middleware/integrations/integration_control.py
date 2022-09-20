import re

from sentry.silo import SiloMode
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders

from .parsers import SlackRequestParser


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
        webhook_prefix_regex = re.escape(self.webhook_prefix)
        provider_regex = rf"^{webhook_prefix_regex}(\w+)"
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

        if parser.is_path_exempt():
            return self.get_response(request)

        parser.get_regions()
        # TODO(Leander): Forward the requests to these regions, respond to the requester immediately

        return self.get_response(request)
