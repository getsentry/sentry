from snuba_sdk import Function

from sentry.search.events import builder
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.datasets.discover import USER_DISPLAY_ALIAS
from sentry.search.events.types import SelectType


class IssuePlatformDatasetConfig(DatasetConfig):
    def __init__(self, builder: builder.QueryBuilder):
        self.builder = builder

    def _resolve_user_display_alias(self, _: str) -> SelectType:
        columns = ["user_email", "user_name", "user_id", "ip_address_v4"]
        return Function(
            "coalesce", [self.builder.column(column) for column in columns], USER_DISPLAY_ALIAS
        )
