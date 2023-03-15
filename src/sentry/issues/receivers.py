from typing import Any

from sentry.models import Group, GroupSnooze
from sentry.signals import issue_resolved


@issue_resolved.connect(weak=False)  # type: ignore
def remove_ignores(group: Group, **kwargs: Any) -> None:
    """
    If an issue is resolved we should remove any pending ignore rows
    """
    try:
        snooze = GroupSnooze.objects.get(group=group)
        snooze.delete()
    except GroupSnooze.DoesNotExist:
        pass
