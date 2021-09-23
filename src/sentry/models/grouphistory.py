from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr


class GroupHistoryStatus:
    UNRESOLVED = 0
    RESOLVED = 1
    AUTO_RESOLVED = 2
    IGNORED = 3
    UNIGNORED = 4
    ASSIGNED = 5
    UNASSIGNED = 6
    REGRESSED = 7
    DELETED = 8
    DELETED_AND_DISCADED = 9
    REVIEWED = 10


class GroupHistory(Model):
    """
    This model is used to track certain status changes for groups,
    and is designed to power a few types of queries:
    - `resolved_in:release` syntax - we can query for entries with status=REGRESSION and matching release
    - Time to Resolution and Age of Unresolved Issues- style queries
    - Issue Actvity/Status over time breakdown (i.e. for each of the last 14 days, how many new, resolved, regressed, unignored, etc. issues were there?)
    """

    __include_in_export__ = False

    group = FlexibleForeignKey("sentry.Group")
    project = FlexibleForeignKey("sentry.Project")
    release = FlexibleForeignKey("sentry.Release", null=True)
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
            (GroupHistoryStatus.DELETED_AND_DISCADED, _("Deleted and Discarded")),
            (GroupHistoryStatus.REVIEWED, _("Reviewed")),
        ),
        db_index=True,
    )
    prev_history_id = FlexibleForeignKey(
        "sentry.GroupHistory"
    )  # This field has no immediate use, but might be useful.
    prev_history_date = models.DateTimeField(
        null=True
    )  # This field is used to simplify query calculations.
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "sentry_grouphistory"
        app_label = "sentry"

    __repr__ = sane_repr("group_id", "release_id")
