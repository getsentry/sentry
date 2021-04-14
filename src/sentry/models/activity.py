from django.conf import settings
from django.db import models
from django.db.models import F
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    sane_repr,
)
from sentry.tasks import activity
from sentry.types.activity import CHOICES, ActivityType


class Activity(Model):
    __core__ = False

    # TODO(mgaeta): Replace all usages with ActivityTypes.
    ASSIGNED = ActivityType.ASSIGNED.value
    CREATE_ISSUE = ActivityType.CREATE_ISSUE.value
    DEPLOY = ActivityType.DEPLOY.value
    FIRST_SEEN = ActivityType.FIRST_SEEN.value
    MARK_REVIEWED = ActivityType.MARK_REVIEWED.value
    MERGE = ActivityType.MERGE.value
    NEW_PROCESSING_ISSUES = ActivityType.NEW_PROCESSING_ISSUES.value
    NOTE = ActivityType.NOTE.value
    RELEASE = ActivityType.RELEASE.value
    REPROCESS = ActivityType.REPROCESS.value
    SET_IGNORED = ActivityType.SET_IGNORED.value
    SET_PRIVATE = ActivityType.SET_PRIVATE.value
    SET_PUBLIC = ActivityType.SET_PUBLIC.value
    SET_REGRESSION = ActivityType.SET_REGRESSION.value
    SET_RESOLVED = ActivityType.SET_RESOLVED.value
    SET_RESOLVED_BY_AGE = ActivityType.SET_RESOLVED_BY_AGE.value
    SET_RESOLVED_IN_COMMIT = ActivityType.SET_RESOLVED_IN_COMMIT.value
    SET_RESOLVED_IN_PULL_REQUEST = ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value
    SET_RESOLVED_IN_RELEASE = ActivityType.SET_RESOLVED_IN_RELEASE.value
    SET_UNRESOLVED = ActivityType.SET_UNRESOLVED.value
    UNASSIGNED = ActivityType.UNASSIGNED.value
    UNMERGE_DESTINATION = ActivityType.UNMERGE_DESTINATION.value
    UNMERGE_SOURCE = ActivityType.UNMERGE_SOURCE.value

    project = FlexibleForeignKey("sentry.Project")
    group = FlexibleForeignKey("sentry.Group", null=True)
    # index on (type, ident)
    type = BoundedPositiveIntegerField(choices=CHOICES)
    ident = models.CharField(max_length=64, null=True)
    # if the user is not set, it's assumed to be the system
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    datetime = models.DateTimeField(default=timezone.now)
    data = GzippedDictField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_activity"

    __repr__ = sane_repr("project_id", "group_id", "event_id", "user_id", "type", "ident")

    @staticmethod
    def get_version_ident(version):
        return (version or "")[:64]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from sentry.models import Release

        # XXX(dcramer): fix for bad data
        if self.type in (self.RELEASE, self.DEPLOY) and isinstance(self.data["version"], Release):
            self.data["version"] = self.data["version"].version
        if self.type == self.ASSIGNED:
            self.data["assignee"] = str(self.data["assignee"])

    def save(self, *args, **kwargs):
        created = bool(not self.id)

        super().save(*args, **kwargs)

        if not created:
            return

        # HACK: support Group.num_comments
        if self.type == Activity.NOTE:
            self.group.update(num_comments=F("num_comments") + 1)

    def delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)

        # HACK: support Group.num_comments
        if self.type == Activity.NOTE:
            self.group.update(num_comments=F("num_comments") - 1)

    def send_notification(self):
        activity.send_activity_notifications.delay(self.id)
