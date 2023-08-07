from __future__ import annotations

from snuba_sdk import Column, Condition, Function, Op, Or

from sentry.replays.lib.new_query.conditions import GenericBase
from sentry.replays.lib.selector.parse import QueryType
from sentry.replays.lib.selector.query import union_find


class ClickSelector(GenericBase[list[QueryType]]):
    """Click selector condition class."""

    @staticmethod
    def visit_eq(column: str, value: list[QueryType]) -> Condition:
        if len(value) == 0:
            return Condition(Function("identity", parameters=[1]), Op.EQ, 2)
        else:
            return search_selector(value)


def search_selector(queries: list[QueryType]) -> Condition:
    conditions: list[Condition] = []

    for query in queries:
        columns, values = [], []

        if query.alt:
            columns.append(Column("click_alt"))
            values.append(query.alt)
        if query.aria_label:
            columns.append(Column("click_aria_label"))
            values.append(query.aria_label)
        if query.classes:
            columns.append(Column("click_classes"))
            values.append(query.classes)
        if query.id:
            columns.append(Column("click_id"))
            values.append(query.id)
        if query.role:
            columns.append(Column("click_role"))
            values.append(query.role)
        if query.tag:
            columns.append(Column("click_tag"))
            values.append(query.tag)
        if query.testid:
            columns.append(Column("click_testid"))
            values.append(query.testid)
        if query.title:
            columns.append(Column("click_title"))
            values.append(query.title)

        if columns and values:
            conditions.append(Condition(union_find(columns, values), Op.EQ, 1))

    if len(conditions) == 1:
        return conditions[0]
    else:
        return Or(conditions)
