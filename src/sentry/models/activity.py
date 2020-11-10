from __future__ import absolute_import

import six
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


class Activity(Model):
    __core__ = False

    SET_RESOLVED = 1
    SET_UNRESOLVED = 2
    SET_IGNORED = 3
    SET_PUBLIC = 4
    SET_PRIVATE = 5
    SET_REGRESSION = 6
    CREATE_ISSUE = 7
    NOTE = 8
    FIRST_SEEN = 9
    RELEASE = 10
    ASSIGNED = 11
    UNASSIGNED = 12
    SET_RESOLVED_IN_RELEASE = 13
    MERGE = 14
    SET_RESOLVED_BY_AGE = 15
    SET_RESOLVED_IN_COMMIT = 16
    DEPLOY = 17
    NEW_PROCESSING_ISSUES = 18
    UNMERGE_SOURCE = 19
    UNMERGE_DESTINATION = 20
    SET_RESOLVED_IN_PULL_REQUEST = 21
    REPROCESS = 22

    TYPE = (
        # (TYPE, verb-slug)
        (SET_RESOLVED, u"set_resolved"),
        (SET_RESOLVED_BY_AGE, u"set_resolved_by_age"),
        (SET_RESOLVED_IN_RELEASE, u"set_resolved_in_release"),
        (SET_RESOLVED_IN_COMMIT, u"set_resolved_in_commit"),
        (SET_RESOLVED_IN_PULL_REQUEST, u"set_resolved_in_pull_request"),
        (SET_UNRESOLVED, u"set_unresolved"),
        (SET_IGNORED, u"set_ignored"),
        (SET_PUBLIC, u"set_public"),
        (SET_PRIVATE, u"set_private"),
        (SET_REGRESSION, u"set_regression"),
        (CREATE_ISSUE, u"create_issue"),
        (NOTE, u"note"),
        (FIRST_SEEN, u"first_seen"),
        (RELEASE, u"release"),
        (ASSIGNED, u"assigned"),
        (UNASSIGNED, u"unassigned"),
        (MERGE, u"merge"),
        (DEPLOY, u"deploy"),
        (NEW_PROCESSING_ISSUES, u"new_processing_issues"),
        (UNMERGE_SOURCE, u"unmerge_source"),
        (UNMERGE_DESTINATION, u"unmerge_destination"),
        # The user has reprocessed the group, so events may have moved to new groups
        (REPROCESS, u"reprocess"),
    )

    project = FlexibleForeignKey("sentry.Project")
    group = FlexibleForeignKey("sentry.Group", null=True)
    # index on (type, ident)
    type = BoundedPositiveIntegerField(choices=TYPE)
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
        super(Activity, self).__init__(*args, **kwargs)
        from sentry.models import Release

        # XXX(dcramer): fix for bad data
        if self.type in (self.RELEASE, self.DEPLOY) and isinstance(self.data["version"], Release):
            self.data["version"] = self.data["version"].version
        if self.type == self.ASSIGNED:
            self.data["assignee"] = six.text_type(self.data["assignee"])

    def save(self, *args, **kwargs):
        created = bool(not self.id)

        super(Activity, self).save(*args, **kwargs)

        if not created:
            return

        # HACK: support Group.num_comments
        if self.type == Activity.NOTE:
            self.group.update(num_comments=F("num_comments") + 1)

    def delete(self, *args, **kwargs):
        super(Activity, self).delete(*args, **kwargs)

        # HACK: support Group.num_comments
        if self.type == Activity.NOTE:
            self.group.update(num_comments=F("num_comments") - 1)

    def send_notification(self):
        activity.send_activity_notifications.delay(self.id)
