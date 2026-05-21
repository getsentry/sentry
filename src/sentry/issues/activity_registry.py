from __future__ import annotations

from collections.abc import Callable

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.utils.registry import Registry

GroupActivityHandler = Callable[[Group, Activity], None]
group_activity_registry = Registry[GroupActivityHandler](enable_reverse_lookup=False)


def invoke_activity_handlers(group: Group, activity: Activity) -> None:
    for handler in group_activity_registry.registrations.values():
        handler(group, activity)
