from __future__ import annotations

from typing import Sequence

from sentry.models import Group, GroupInboxRemoveAction, User, remove_group_from_inbox
from sentry.utils import metrics


def handle_archived_until_escalating(
    group_list: Sequence[Group],
    acting_user: User | None,
) -> None:
    """
    Handle issues that are archived until escalating and create a forecast for them.

    Issues that are marked as ignored with `archiveDuration: until_escalating`
    in the statusDetail are treated as `archived_until_escalating`.
    """
    metrics.incr("group.archived_until_escalating", skip_internal=True)
    for group in group_list:
        remove_group_from_inbox(group, action=GroupInboxRemoveAction.IGNORED, user=acting_user)
    # TODO(snigdha): create a forecast for this group

    return
