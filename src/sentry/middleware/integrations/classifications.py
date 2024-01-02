from __future__ import annotations

import abc
import logging
import re
from typing import TYPE_CHECKING, List, Mapping, Type, cast

from django.http import HttpRequest
from django.http.response import HttpResponseBase

from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.middleware.integrations.integration_control import ResponseHandler
    from sentry.middleware.integrations.parsers.base import BaseRequestParser


class BaseClassification(abc.ABC):
    def __init__(self, response_handler: ResponseHandler) -> None:
        self.response_handler = response_handler

    def should_operate(self, request: HttpRequest) -> bool:
        """
        Determines whether the classification should act on request.
        Middleware will return self.get_response() if this function returns True.
        """
        raise NotImplementedError

    def get_response(self, request: HttpRequest) -> HttpResponseBase:
        """Parse the request and return a response."""
        raise NotImplementedError


class PluginClassification(BaseClassification):
    plugin_prefix = "/plugins/"
    """Prefix for plugin requests."""
    logger = logging.getLogger(f"{__name__}.plugin")

    def should_operate(self, request: HttpRequest) -> bool:
        from .parsers import PluginRequestParser

        is_plugin = request.path.startswith(self.plugin_prefix)
        if not is_plugin:
            return False
        rp = PluginRequestParser(request=request, response_handler=self.response_handler)
        return rp.should_operate()

    def get_response(self, request: HttpRequest) -> HttpResponseBase:
        from .parsers import PluginRequestParser

        rp = PluginRequestParser(request=request, response_handler=self.response_handler)
        self.logger.info("routing_request.plugin", extra={"path": request.path})
        return rp.get_response()


class IntegrationClassification(BaseClassification):
    integration_prefix = "/extensions/"
    """Prefix for all integration requests. See `src/sentry/web/urls.py`"""
    logger = logging.getLogger(f"{__name__}.integration")

    @property
    def integration_parsers(self) -> Mapping[str, Type[BaseRequestParser]]:
        from .parsers import (
            BitbucketRequestParser,
            BitbucketServerRequestParser,
            DiscordRequestParser,
            GithubEnterpriseRequestParser,
            GithubRequestParser,
            GitlabRequestParser,
            JiraRequestParser,
            JiraServerRequestParser,
            MsTeamsRequestParser,
            SlackRequestParser,
            VercelRequestParser,
            VstsRequestParser,
        )

        active_parsers: List[Type[BaseRequestParser]] = [
            BitbucketRequestParser,
            BitbucketServerRequestParser,
            DiscordRequestParser,
            GithubEnterpriseRequestParser,
            GithubRequestParser,
            GitlabRequestParser,
            JiraRequestParser,
            JiraServerRequestParser,
            MsTeamsRequestParser,
            SlackRequestParser,
            VercelRequestParser,
            VstsRequestParser,
        ]
        return {cast(str, parser.provider): parser for parser in active_parsers}

    def _identify_provider(self, request: HttpRequest) -> str | None:
        """
        Parses the provider out of the request path
            e.g. `/extensions/slack/commands/` -> `slack`
        """
        integration_prefix_regex = re.escape(self.integration_prefix)
        provider_regex = rf"^{integration_prefix_regex}([^/]+)"
        result = re.search(provider_regex, request.path)
        if not result:
            return None
        return result[1].replace("-", "_")

    def should_operate(self, request: HttpRequest) -> bool:
        return (
            # Must start with the integration request prefix...
            request.path.startswith(self.integration_prefix)
            # Not have the suffix for PipelineAdvancerView (See urls.py)
            and not request.path.endswith("/setup/")
            # or match the routes for integrationOrganizationLink page (See routes.tsx)
            and not request.path.endswith("/link/")
            and not request.path.startswith("/extensions/external-install/")
        )

    def get_response(self, request: HttpRequest) -> HttpResponseBase:
        provider = self._identify_provider(request)
        if not provider:
            return self.response_handler(request)

        parser_class = self.integration_parsers.get(provider)
        if not parser_class:
            self.logger.error(
                "integration_control.unknown_provider",
                extra={"path": request.path, "provider": provider},
            )
            return self.response_handler(request)

        parser = parser_class(
            request=request,
            response_handler=self.response_handler,
        )
        response = parser.get_response()
        metrics.incr(
            f"hybrid_cloud.integration_control.integration.{parser.provider}",
            tags={"url_name": parser.match.url_name, "status_code": response.status_code},
            sample_rate=1.0,
        )
        self.logger.info(
            f"integration_control.routing_request.{parser.provider}.response",
            extra={
                "request.path": request.path,
                "request.method": request.method,
                "url_name": parser.match.url_name,
                "response.status_code": response.status_code,
            },
        )
        return response
