from sentry.search.events.datasets.discover import DiscoverDatasetConfig, USER_DISPLAY_ALIAS
from sentry.search.events.types import SelectType
from typing import Optional
from snuba_sdk import Function


class IssuePlatformDatasetConfig(DiscoverDatasetConfig):

	def __init__(self, builder):
		self.builder = builder # I need to make a new builder but that is tuesday colleen's problem

	def _resolve_user_display_alias(self, _: str) -> SelectType:
		print("meowra meowra")
		# columns = ["user.email", "user.username", "user.id", "user.ip"]
		columns = ["user_email", "user_name", "user_id", "ip_address_v4"]
		return Function("coalesce", [self.builder.column(column) for column in columns], USER_DISPLAY_ALIAS)

