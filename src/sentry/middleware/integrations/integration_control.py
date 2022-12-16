from __future__ import annotations

import logging
import re
from typing import Mapping, Type

from sentry.silo import SiloMode

from .parsers import SlackRequestParser
from .parsers.base import BaseRequestParser

logger = logging.getLogger(__name__)

ACTIVE_PARSERS = [SlackRequestParser]


class IntegrationControlMiddleware:
    webhook_prefix: str = "/extensions/"

    integration_parsers: Mapping[str, Type[BaseRequestParser]] = {
        parser.provider: parser for parser in ACTIVE_PARSERS
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def _identify_provider(self, request) -> str | None:
        """
        Parses the provider out of the request path
            e.g. `/extensions/slack/commands/` -> `slack`
        """
        webhook_prefix_regex = re.escape(self.webhook_prefix)
        provider_regex = rf"^{webhook_prefix_regex}(\w+)"
        result = re.search(provider_regex, request.path)
        if not result:
            logger.error(
                "integration_control.invalid_provider",
                extra={"path": request.path},
            )
            return None
        return result.group(1)

    def _should_operate(self, request) -> bool:
        """
        Determines whether this middleware will operate or just pass the request along.
        """
        is_correct_silo = SiloMode.get_current_mode() == SiloMode.CONTROL
        is_external = request.path.startswith(self.webhook_prefix)
        return is_correct_silo and is_external

    def __call__(self, request):
        if not self._should_operate(request):
            return self.get_response(request)

        provider = self._identify_provider(request)
        if not provider:
            return self.get_response(request)

        parser_class = self.integration_parsers.get(provider)
        if not parser_class:
            logger.error(
                "integration_control.unknown_provider",
                extra={"path": request.path, "provider": provider},
            )
            return self.get_response(request)

        parser = parser_class(
            request=request,
            response_handler=self.get_response,
        )

        return parser.get_response()
