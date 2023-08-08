from __future__ import annotations

import abc
import logging
import re
from typing import TYPE_CHECKING, Type

from django.http import HttpRequest, HttpResponse
from pyparsing import Mapping

from .parsers import (
    BitbucketRequestParser,
    BitbucketServerRequestParser,
    GithubEnterpriseRequestParser,
    GithubRequestParser,
    GitlabRequestParser,
    JiraRequestParser,
    JiraServerRequestParser,
    MsTeamsRequestParser,
    PluginRequestParser,
    SlackRequestParser,
    VstsRequestParser,
)

if TYPE_CHECKING:
    from sentry.middleware.integrations.integration_control import ResponseHandler

    from .parsers.base import BaseRequestParser


class BaseClassification(abc.ABC):
    def __init__(self, response_handler: ResponseHandler) -> None:
        self.response_handler = response_handler

    def should_operate(self, request: HttpRequest) -> bool:
        """
        Determines whether the classification should act on request.
        Middleware will return self.get_response() if this function returns True.
        """
        raise NotImplementedError

    def get_response(self, request: HttpRequest) -> HttpResponse:
        """Parse the request and return a response."""
        raise NotImplementedError


class PluginClassification(BaseClassification):
    def should_operate(self, request: HttpRequest) -> bool:
        rp = PluginRequestParser(request=request, response_handler=self.response_handler)
        return rp.should_operate()

    def get_response(self, request: HttpRequest) -> HttpResponse:
        rp = PluginRequestParser(request=request, response_handler=self.response_handler)
        return rp.get_response()


class IntegrationClassification(BaseClassification):
    integration_prefix: str = "/extensions/"
    """Prefix for all integration requests. See `src/sentry/web/urls.py`"""
    setup_suffix: str = "/setup/"
    """Suffix for PipelineAdvancerView on installation. See `src/sentry/web/urls.py`"""
    logger = logging.getLogger(f"{__name__}.integration")
    integration_parsers: Mapping[str, Type[BaseRequestParser]] = {
        parser.provider: parser
        for parser in [
            BitbucketRequestParser,
            BitbucketServerRequestParser,
            GithubEnterpriseRequestParser,
            GithubRequestParser,
            GitlabRequestParser,
            JiraRequestParser,
            JiraServerRequestParser,
            MsTeamsRequestParser,
            SlackRequestParser,
            VstsRequestParser,
        ]
    }

    def _identify_provider(self, request: HttpRequest) -> str | None:
        """
        Parses the provider out of the request path
            e.g. `/extensions/slack/commands/` -> `slack`
        """
        integration_prefix_regex = re.escape(self.integration_prefix)
        provider_regex = rf"^{integration_prefix_regex}(\w+)"
        result = re.search(provider_regex, request.path)
        if not result:
            self.logger.error("invalid_provider", extra={"path": request.path})
            return None
        return result.group(1)

    def should_operate(self, request: HttpRequest) -> bool:
        is_integration = request.path.startswith(self.integration_prefix)
        is_not_setup = not request.path.endswith(self.setup_suffix)
        return is_integration and is_not_setup

    def get_response(self, request: HttpRequest) -> HttpResponse:
        provider = self._identify_provider(request)
        if not provider:
            return self.response_handler(request)

        parser_class = self.integration_parsers.get(provider)
        if not parser_class:
            self.logger.error(
                "unknown_provider",
                extra={"path": request.path, "provider": provider},
            )
            return self.response_handler(request)

        parser = parser_class(
            request=request,
            response_handler=self.response_handler,
        )

        return parser.get_response()
