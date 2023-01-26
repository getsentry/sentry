from __future__ import annotations

from typing import TYPE_CHECKING, Any, List

if TYPE_CHECKING:
    from sentry.models.group import Group


def apply_performance_conditions(conditions: List[Any], group: Group) -> List[Any]:
    conditions.append([["has", ["group_ids", group.id]], "=", 1])
    return conditions
