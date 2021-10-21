from typing import TYPE_CHECKING, Optional, Union

from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry import features
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr

if TYPE_CHECKING:
    from sentry.models import Group, Release, Team, User


class GroupHistoryStatus:
    UNRESOLVED = 0
    RESOLVED = 1
    SET_RESOLVED_IN_RELEASE = 11
    SET_RESOLVED_IN_COMMIT = 12
    SET_RESOLVED_IN_PULL_REQUEST = 13
    AUTO_RESOLVED = 2
    IGNORED = 3
    UNIGNORED = 4
    ASSIGNED = 5
    UNASSIGNED = 6
    REGRESSED = 7
    DELETED = 8
    DELETED_AND_DISCARDED = 9
    REVIEWED = 10


ACTIONED_STATUSES = [
    GroupHistoryStatus.RESOLVED,
    GroupHistoryStatus.SET_RESOLVED_IN_RELEASE,
    GroupHistoryStatus.SET_RESOLVED_IN_COMMIT,
    GroupHistoryStatus.SET_RESOLVED_IN_PULL_REQUEST,
    GroupHistoryStatus.IGNORED,
    GroupHistoryStatus.REVIEWED,
    GroupHistoryStatus.DELETED,
    GroupHistoryStatus.DELETED_AND_DISCARDED,
]

UNRESOLVED_STATUSES = (GroupHistoryStatus.UNRESOLVED, GroupHistoryStatus.REGRESSED)
RESOLVED_STATUSES = (
    GroupHistoryStatus.RESOLVED,
    GroupHistoryStatus.SET_RESOLVED_IN_RELEASE,
    GroupHistoryStatus.SET_RESOLVED_IN_COMMIT,
    GroupHistoryStatus.SET_RESOLVED_IN_PULL_REQUEST,
    GroupHistoryStatus.AUTO_RESOLVED,
)

PREVIOUS_STATUSES = {
    GroupHistoryStatus.UNRESOLVED: RESOLVED_STATUSES,
    GroupHistoryStatus.RESOLVED: UNRESOLVED_STATUSES,
    GroupHistoryStatus.SET_RESOLVED_IN_RELEASE: UNRESOLVED_STATUSES,
    GroupHistoryStatus.SET_RESOLVED_IN_COMMIT: UNRESOLVED_STATUSES,
    GroupHistoryStatus.SET_RESOLVED_IN_PULL_REQUEST: UNRESOLVED_STATUSES,
    GroupHistoryStatus.AUTO_RESOLVED: UNRESOLVED_STATUSES,
    GroupHistoryStatus.IGNORED: (GroupHistoryStatus.UNIGNORED,),
    GroupHistoryStatus.UNIGNORED: (GroupHistoryStatus.IGNORED,),
    GroupHistoryStatus.ASSIGNED: (GroupHistoryStatus.UNASSIGNED,),
    GroupHistoryStatus.UNASSIGNED: (GroupHistoryStatus.ASSIGNED,),
    GroupHistoryStatus.REGRESSED: RESOLVED_STATUSES,
}


class GroupHistory(Model):
    """
    This model is used to track certain status changes for groups,
    and is designed to power a few types of queries:
    - `resolved_in:release` syntax - we can query for entries with status=REGRESSION and matching release
    - Time to Resolution and Age of Unresolved Issues-style queries
    - Issue Activity/Status over time breakdown (i.e. for each of the last 14 days, how many new, resolved, regressed, unignored, etc. issues were there?)
    """

    __include_in_export__ = False

    organization = FlexibleForeignKey("sentry.Organization", db_constraint=False)
    group = FlexibleForeignKey("sentry.Group", db_constraint=False)
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    release = FlexibleForeignKey("sentry.Release", null=True, db_constraint=False)
    actor = FlexibleForeignKey("sentry.Actor", null=True)

    status = BoundedPositiveIntegerField(
        default=0,
        choices=(
            (GroupHistoryStatus.UNRESOLVED, _("Unresolved")),
            (GroupHistoryStatus.RESOLVED, _("Resolved")),
            (GroupHistoryStatus.AUTO_RESOLVED, _("Automatically Resolved")),
            (GroupHistoryStatus.IGNORED, _("Ignored")),
            (GroupHistoryStatus.UNIGNORED, _("Unignored")),
            (GroupHistoryStatus.REGRESSED, _("Regressed")),
            (GroupHistoryStatus.ASSIGNED, _("Assigned")),
            (GroupHistoryStatus.UNASSIGNED, _("Unassigned")),
            (GroupHistoryStatus.DELETED, _("Deleted")),
            (GroupHistoryStatus.DELETED_AND_DISCARDED, _("Deleted and Discarded")),
            (GroupHistoryStatus.REVIEWED, _("Reviewed")),
            (GroupHistoryStatus.SET_RESOLVED_IN_RELEASE, _("Resolved in Release")),
            (GroupHistoryStatus.SET_RESOLVED_IN_COMMIT, _("Resolved in Commit")),
            (GroupHistoryStatus.SET_RESOLVED_IN_PULL_REQUEST, _("Resolved in Pull Request")),
        ),
    )
    prev_history = FlexibleForeignKey(
        "sentry.GroupHistory", null=True
    )  # This field has no immediate use, but might be useful.
    prev_history_date = models.DateTimeField(
        null=True
    )  # This field is used to simplify query calculations.
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "sentry_grouphistory"
        app_label = "sentry"
        index_together = (("project", "status", "release"), ("group", "status"))

    __repr__ = sane_repr("group_id", "release_id")


def get_prev_history(group, status):
    """
    Finds the most recent row that is the inverse of this history row, if one exists.
    """
    previous_statuses = PREVIOUS_STATUSES.get(status)
    if not previous_statuses:
        return

    prev_histories = GroupHistory.objects.filter(
        group=group, status__in=previous_statuses
    ).order_by("-date_added")
    return prev_histories.first()


def record_group_history_from_activity_type(
    group: "Group",
    activity_type: int,
    actor: Optional[Union["User", "Team"]] = None,
    release: Optional["Release"] = None,
):
    """
    Writes a `GroupHistory` row for an activity type if there's a relevant `GroupHistoryStatus` that
    maps to it
    """
    status = activity_type_to_history_status(activity_type)
    if status is not None:
        return record_group_history(group, status, actor, release)


def record_group_history(
    group: "Group",
    status: int,
    actor: Optional[Union["User", "Team"]] = None,
    release: Optional["Release"] = None,
):
    if not features.has("organizations:group-history", group.organization):
        return
    prev_history = get_prev_history(group, status)
    return GroupHistory.objects.create(
        organization=group.project.organization,
        group=group,
        project=group.project,
        release=release,
        actor=actor.actor if actor is not None else None,
        status=status,
        prev_history=prev_history,
        prev_history_date=prev_history.date_added if prev_history else None,
    )


def activity_type_to_history_status(status):
    from sentry.models import Activity

    # TODO: This could be improved; defined above at the very least
    if status == Activity.SET_IGNORED:
        return GroupHistoryStatus.IGNORED
    elif status == Activity.SET_RESOLVED:
        return GroupHistoryStatus.RESOLVED
    elif status == Activity.SET_RESOLVED_IN_COMMIT:
        return GroupHistoryStatus.SET_RESOLVED_IN_COMMIT
    elif status == Activity.SET_RESOLVED_IN_RELEASE:
        return GroupHistoryStatus.SET_RESOLVED_IN_RELEASE
    elif status == Activity.SET_UNRESOLVED:
        return GroupHistoryStatus.UNRESOLVED

    return None
