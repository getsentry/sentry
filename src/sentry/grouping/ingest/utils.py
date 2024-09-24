from __future__ import annotations

import logging
from collections.abc import MutableMapping
from typing import TYPE_CHECKING, Any

from sentry.exceptions import HashDiscarded
from sentry.issues.grouptype import GroupCategory
from sentry.killswitches import killswitch_matches_context
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project

if TYPE_CHECKING:
    from sentry.eventstore.models import Event

logger = logging.getLogger("sentry.events.grouping")

Job = MutableMapping[str, Any]


def add_group_id_to_grouphashes(
    group: Group,
    grouphashes: list[GroupHash],
) -> None:
    """
    Link the given group to any grouphash which doesn't yet have a group assigned.
    """

    new_grouphash_ids = [gh.id for gh in grouphashes if gh.group_id is None]

    GroupHash.objects.filter(id__in=new_grouphash_ids).exclude(
        state=GroupHash.State.LOCKED_IN_MIGRATION
    ).update(group=group)


def check_for_group_creation_load_shed(project: Project, event: Event) -> None:
    """
    Raise a `HashDiscarded` error if the load-shed killswitch is enabled
    """
    if killswitch_matches_context(
        "store.load-shed-group-creation-projects",
        {
            "project_id": project.id,
            "platform": event.platform,
        },
    ):
        raise HashDiscarded("Load shedding group creation", reason="load_shed")


def check_for_category_mismatch(group: Group) -> bool:
    """
    Make sure an error event hasn't hashed to a value assigned to a non-error-type group
    """
    if group.issue_category != GroupCategory.ERROR:
        logger.info(
            "event_manager.category_mismatch",
            extra={
                "issue_category": group.issue_category,
                "event_type": "error",
            },
        )
        return True

    return False
