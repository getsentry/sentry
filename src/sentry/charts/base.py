import logging
from typing import Any, Union

from sentry import options
from sentry.utils.services import Service

from .types import ChartType

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
        return bool(options.get("chart-rendering.enabled", False))

    def generate_chart(self, style: ChartType, data: Any, upload: bool = True) -> Union[str, bytes]:
        """
        Produces a chart. You may specify the upload kwarg to have the chart
        uploaded to storage and receive a public URL for the chart
        """
        raise NotImplementedError
