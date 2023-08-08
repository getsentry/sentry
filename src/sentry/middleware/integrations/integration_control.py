from __future__ import annotations

import logging
from typing import Callable, List, Type

from django.http import HttpRequest, HttpResponse

from sentry.middleware.integrations.classifications import (
    BaseClassification,
    IntegrationClassification,
    PluginClassification,
)
from sentry.silo import SiloMode

logger = logging.getLogger(__name__)

ResponseHandler = Callable[[HttpRequest], HttpResponse]


class IntegrationControlMiddleware:
    classifications: List[Type[BaseClassification]] = [
        IntegrationClassification,
        PluginClassification,
    ]
    """Classifications to determine whether request must be parsed, sorted in priority order."""

    def __init__(self, get_response: ResponseHandler):
        self.get_response = get_response

    def _should_operate(self, request: HttpRequest) -> bool:
        """
        Determines whether this middleware will operate or just pass the request along.
        """
        is_correct_silo = SiloMode.get_current_mode() == SiloMode.CONTROL
        return is_correct_silo

    def __call__(self, request: HttpRequest):
        if not self._should_operate(request):
            return self.get_response(request)

        # Check request against each classification, if a match is found, return early
        for classification in self.classifications:
            _cls = classification(response_handler=self.get_response)
            if _cls.should_operate(request):
                return _cls.get_response(request)

        return self.get_response(request)
