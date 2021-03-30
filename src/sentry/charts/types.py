from enum import Enum


class ChartType(Enum):
    """
    This enum defines the chart styles we can render.

    This directly maps to the chartcuterie configuration [0] in the frontend
    code. Be sure to keep these in sync when adding or removing types.

    [0]: app/chartcuterieConfig.tsx.
    """

    SLACK_DISCOVER_TOTAL_PERIOD = "slack:discover.totalPeriod"
