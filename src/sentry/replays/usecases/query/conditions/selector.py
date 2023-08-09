from __future__ import annotations

from typing import List

from snuba_sdk import And, Column, Condition, Function, Op, Or

from sentry.replays.lib.selector.parse import QueryType
from sentry.replays.usecases.query.conditions.base import ComputedBase


class ClickSelector(ComputedBase[List[QueryType]]):
    """Click selector condition class."""

    @staticmethod
    def visit_eq(value: list[QueryType]) -> Condition:
        if len(value) == 0:
            return Condition(Function("identity", parameters=[1]), Op.EQ, 2)
        else:
            return search_selector(value)


# We are not targetting an aggregated result set.  We are targetting a row.  We're asking does
# this row match the selector and *if it does* record a hit represented as a "1" or a miss
# represented as a "0".
#
# If multiple selectors are provided then we are asking if any row matches any selector.
def search_selector(queries: list[QueryType]) -> Condition:
    conditions: list[Condition] = []

    for query in queries:
        _conditions = []

        if query.alt:
            _conditions.append(Condition(Column("click_alt"), Op.EQ, query.alt))
        if query.aria_label:
            _conditions.append(Condition(Column("click_aria_label"), Op.EQ, query.aria_label))
        if query.classes:
            _conditions.append(Condition(Column("click_classes"), Op.EQ, query.classes))
        if query.id:
            _conditions.append(Condition(Column("click_id"), Op.EQ, query.id))
        if query.role:
            _conditions.append(Condition(Column("click_role"), Op.EQ, query.role))
        if query.tag:
            _conditions.append(Condition(Column("click_tag"), Op.EQ, query.tag))
        if query.testid:
            _conditions.append(Condition(Column("click_testid"), Op.EQ, query.testid))
        if query.title:
            _conditions.append(Condition(Column("click_title"), Op.EQ, query.title))

        if _conditions:
            conditions.append(And(_conditions))

    if len(conditions) == 1:
        # There's only one set of conditions and they all must pass in order to be counted.
        return Function("sum", parameters=[conditions])
    else:
        # There's multiple sets of conditions and any of them passing is considered a successful
        # hit.  To require all of the conditions pass replace the "Or" function with "And".
        return Function("sum", parameters=[Or(conditions)])
