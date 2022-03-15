from snuba_sdk import Condition, Op

from sentry.api.event_search import SearchFilter
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import constants
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import WhereType


def team_key_transaction_filter(builder: QueryBuilder, search_filter: SearchFilter) -> WhereType:
    value = search_filter.value.value
    key_transaction_expr = builder.resolve_field_alias(constants.TEAM_KEY_TRANSACTION_ALIAS)

    if search_filter.value.raw_value == "":
        return Condition(
            key_transaction_expr, Op.NEQ if search_filter.operator == "!=" else Op.EQ, 0
        )
    if value in ("1", 1):
        return Condition(key_transaction_expr, Op.EQ, 1)
    if value in ("0", 0):
        return Condition(key_transaction_expr, Op.EQ, 0)

    raise InvalidSearchQuery(
        "Invalid value for key_transaction condition. Accepted values are 1, 0"
    )
