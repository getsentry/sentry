from __future__ import annotations

import logging
from typing import Callable, List, Type

from django.http import HttpRequest
from django.http.response import HttpResponseBase

from sentry.silo import SiloMode
from sentry.silo.util import PROXY_FROM_SILO

logger = logging.getLogger(__name__)


from sentry.middleware.integrations.classifications import (
    BaseClassification,
    IntegrationClassification,
    PluginClassification,
)

ResponseHandler = Callable[[HttpRequest], HttpResponseBase]


class IntegrationControlMiddleware:
    classifications: List[Type[BaseClassification]] = [
        IntegrationClassification,
        PluginClassification,
    ]
    """
    Classifications to determine whether request must be parsed, sorted in priority order.
    getsentry expands this list on django initialization.
    """

    def __init__(self, get_response: ResponseHandler):
        self.get_response = get_response

    def _should_operate(self, request: HttpRequest) -> bool:
        """
        Determines whether this middleware will operate or just pass the request along.
        """
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            origin_silo_mode = request.headers.get(PROXY_FROM_SILO)
            if origin_silo_mode is not None and origin_silo_mode.upper() == "CONTROL":
                # The request was proxied from the control silo and to the region silo.
                # The IntegrationControlMiddleware should not operate in the region silo mode, so we passthrough
                # the request to the next middleware.
                return False
        return SiloMode.get_current_mode() in [SiloMode.CONTROL, SiloMode.MONOLITH]

    @classmethod
    def register_classifications(cls, classifications: List[Type[BaseClassification]]):
        """
        Add new classifications for middleware to determine request parsing dynamically.
        Used in getsentry to expand scope of parsing.
        """
        cls.classifications += classifications

    def __call__(self, request: HttpRequest):
        if not self._should_operate(request):
            return self.get_response(request)

        # Check request against each classification, if a match is found, return early
        for classification in self.classifications:
            _cls = classification(response_handler=self.get_response)
            if _cls.should_operate(request):
                return _cls.get_response(request)

        return self.get_response(request)
