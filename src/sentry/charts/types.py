from enum import Enum


class ChartType(Enum):
    """
    This enum defines the chart styles we can render.

    This directly maps to the chartcuterie configuration in the frontend code, see
    app/chartcuterieConfig.tsx."""

    SLACK_DISCOVER_TOTAL_PERIOD = "slack:discover.totalPeriod"
