from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr


class GroupHistoryStatus:
    UNRESOLVED = 0
    RESOLVED = 1
    IGNORED = 2
    UNIGNORED = 3
    ASSIGNED = 4
    UNASSIGNED = 5
    REGRESSED = 6
    DELETED = 7


class GroupHistoryn(Model):
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

    status = BoundedPositiveIntegerField(
        default=0,
        choices=(
            (GroupHistoryStatus.UNRESOLVED, _("Unresolved")),
            (GroupHistoryStatus.RESOLVED, _("Resolved")),
            (GroupHistoryStatus.IGNORED, _("Ignored")),
            (GroupHistoryStatus.UNIGNORED, _("Unignored")),
            (GroupHistoryStatus.REGRESSED, _("Regressed")),
            (GroupHistoryStatus.ASSIGNED, _("Assigned")),
            (GroupHistoryStatus.UNASSIGNED, _("Unassigned")),
            (GroupHistoryStatus.DELETED, _("Deleted")),
        ),
        db_index=True,
    )
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "sentry_grouphistory"
        app_label = "sentry"
        unique_together = (("group", "release"),)

    __repr__ = sane_repr("group_id", "release_id")
