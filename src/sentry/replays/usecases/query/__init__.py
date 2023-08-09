from __future__ import annotations

from typing import Union

from snuba_sdk import Condition

from sentry.api.event_search import SearchFilter
from sentry.replays.lib.new_query.fields import NamedExpressionField
from sentry.replays.usecases.query.fields import ComputedField


def handle_search_filters(
    search_config: dict[str, Union[NamedExpressionField, ComputedField]],
    field_name_map: dict[str, str],
    search_filters: list[SearchFilter],
) -> list[Condition]:
    return [
        search_filter_to_condition(search_config, field_name_map, search_filter)
        for search_filter in search_filters
    ]


def search_filter_to_condition(
    search_config: dict[str, Union[NamedExpressionField, ComputedField]],
    field_name_map: dict[str, str],
    search_filter: SearchFilter,
) -> Condition:
    field_name = search_filter.key.name
    field = search_config.get(field_name, search_config["*"])

    if isinstance(field, ComputedField):
        return field.apply(search_filter)
    else:
        return field.apply(field_name_map[field_name], search_filter)
