import logging
from typing import Callable, Mapping, Type

from django.http import HttpRequest, HttpResponse

from sentry.middleware.integrations.parsers.base import BaseRequestParser

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


class BaseClassification:
    def should_operate(self, request: HttpRequest) -> bool:
        """
        Function to determine if an incoming request should be handled by this
        classifcation of parsers or not.
        """
        return False


class IntegrationClassification(BaseClassification):
    logger = logging.getLogger(f"{__name__}.integration")
    integration_prefix: str = "/extensions/"
    """Prefix for all integration requests. See `src/sentry/web/urls.py`"""
    setup_suffix: str = "/setup/"
    """Suffix for PipelineAdvancerView on installation. See `src/sentry/web/urls.py`"""

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

    def should_operate(self, request: HttpRequest) -> bool:
        is_integration = request.path.startswith(self.integration_prefix)
        is_not_setup = not request.path.endswith(self.setup_suffix)
        return is_integration and is_not_setup

    def get_response(self, request: HttpRequest, response_handler: Callable[[], HttpResponse]):
        provider = self._identify_provider(request)
        if not provider:
            return response_handler(request)

        parser_class = self.integration_parsers.get(provider)
        if not parser_class:
            self.logger.error(
                "integration_control.unknown_provider",
                extra={"path": request.path, "provider": provider},
            )
            return response_handler(request)

        parser = parser_class(
            request=request,
            response_handler=response_handler,
        )

        return parser.get_response()


class PluginClassification(BaseClassification):
    logger = logging.getLogger(f"{__name__}.plugin")

    def should_operate(self, request: HttpRequest) -> bool:
        pass

    def get_response(self) -> HttpResponse:
        pass
