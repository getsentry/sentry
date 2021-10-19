from enum import Enum


class ChartType(Enum):
    """
    This enum defines the chart styles we can render.

    This directly maps to the chartcuterie configuration [0] in the frontend
    code. Be sure to keep these in sync when adding or removing types.

    [0]: app/chartcuterie/config.tsx.
    """

    SLACK_DISCOVER_TOTAL_PERIOD = "slack:discover.totalPeriod"
    SLACK_DISCOVER_TOTAL_DAILY = "slack:discover.totalDaily"
    SLACK_DISCOVER_TOP5_PERIOD = "slack:discover.top5Period"
    SLACK_DISCOVER_TOP5_DAILY = "slack:discover.top5Daily"
    SLACK_DISCOVER_PREVIOUS_PERIOD = "slack:discover.previousPeriod"
