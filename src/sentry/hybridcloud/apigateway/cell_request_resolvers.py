import logging
from collections.abc import Callable
from typing import Any

from django.http import HttpResponseBase
from rest_framework.request import Request

from sentry.types.cell import Cell

logger = logging.getLogger(__name__)


class CellRequestResolver:
    def resolve(
        self,
        request: Request,
        view_func: Callable[..., HttpResponseBase],
        view_kwargs: dict[str, Any],
    ) -> Cell | None:
        raise NotImplementedError
