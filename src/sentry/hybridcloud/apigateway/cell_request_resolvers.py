import logging
from collections.abc import Callable
from typing import Any

from django.http import HttpResponseBase
from rest_framework.request import Request

from sentry.types.cell import Cell

logger = logging.getLogger(__name__)


class CellRequestResolver:
    """
    Base class for Cell request resolvers. Implement the resolve method, and
    pass this method to a @cell_silo_endpoint decorator to use on cell-silo
    endpoints that should be routed through Control silo.
    """

    def resolve(
        self,
        request: Request,
        view_func: Callable[..., HttpResponseBase],
        view_kwargs: dict[str, Any],
    ) -> Cell | None:
        """
        Given a request, returns the relevant cell if one can be determined. If
        the request cannot immediately be routed, but is region-pinned (meaning
        it only goes to the monolith cell as a fallback), return None.

        Otherwise, raise an exception with details on why the request cannot be
        properly routed.
        """
        raise NotImplementedError
