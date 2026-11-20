import logging
from typing import Any

from django.conf import settings

from sentry.utils.services import Service

from .types import ChartSize, ChartType

logger = logging.getLogger("sentry.charts")


class ChartRenderer(Service):
    """
    The chart rendering service is used to translate arbitrary data into a
    image representation of that data, usually a chart.
    """

    __all__ = (
        "is_enabled",
        "generate_chart",
    )

    def __init__(self, **options: Any) -> None:
        pass

    def is_enabled(self) -> bool:
        """
        Checks that the chart rendering service is enabled
        """
        return settings.SENTRY_CHART_RENDERING_ENABLED

    def generate_chart(self, style: ChartType, data: Any, size: ChartSize | None = None) -> str:
        """Produces a chart. Returns the public URL for the chart"""
        raise NotImplementedError
