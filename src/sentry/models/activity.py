from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence

from django.conf import settings
from django.db import models
from django.db.models import F
from django.utils import timezone

from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.tasks import activity
from sentry.types.activity import CHOICES, ActivityType

if TYPE_CHECKING:
    from sentry.models import Group, User


class ActivityManager(BaseManager):
    def get_activities_for_group(self, group: Group, num: int) -> Sequence[Group]:
        activities = []
        activity_qs = self.filter(group=group).order_by("-datetime").select_related("user")

        prev_sig = None
        sig = None
        # we select excess so we can filter dupes
        for item in activity_qs[: num * 2]:
            prev_sig = sig
            sig = (item.type, item.ident, item.user_id)

            if item.type == ActivityType.NOTE.value:
                activities.append(item)
                continue

            if sig != prev_sig:
                activities.append(item)

        activities.append(
            Activity(
                id=0,
                project=group.project,
                group=group,
                type=ActivityType.FIRST_SEEN.value,
                datetime=group.first_seen,
            )
        )

        return activities[:num]

    def create_group_activity(
        self,
        group: Group,
        type: ActivityType,
        user: Optional[User] = None,
        data: Optional[Mapping[str, Any]] = None,
        send_notification: bool = True,
    ) -> Activity:
        activity = self.create(
            project_id=group.project_id,
            group=group,
            type=type.value,
            user=user,
            data=data,
        )
        if send_notification:
            activity.send_notification()

        return activity


@region_silo_only_model
class Activity(Model):
    __include_in_export__ = False

    project = FlexibleForeignKey("sentry.Project")
    group = FlexibleForeignKey("sentry.Group", null=True)
    # index on (type, ident)
    type = BoundedPositiveIntegerField(choices=CHOICES)
    ident = models.CharField(max_length=64, null=True)
    # if the user is not set, it's assumed to be the system
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    datetime = models.DateTimeField(default=timezone.now)
    data = GzippedDictField(null=True)

    objects = ActivityManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_activity"
        index_together = (("project", "datetime"),)

    __repr__ = sane_repr("project_id", "group_id", "event_id", "user_id", "type", "ident")

    @staticmethod
    def get_version_ident(version):
        return (version or "")[:64]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from sentry.models import Release

        # XXX(dcramer): fix for bad data
        if self.type in (ActivityType.RELEASE.value, ActivityType.DEPLOY.value) and isinstance(
            self.data["version"], Release
        ):
            self.data["version"] = self.data["version"].version
        if self.type == ActivityType.ASSIGNED.value:
            self.data["assignee"] = str(self.data["assignee"])

    def save(self, *args, **kwargs):
        created = bool(not self.id)

        super().save(*args, **kwargs)

        if not created:
            return

        # HACK: support Group.num_comments
        if self.type == ActivityType.NOTE.value:
            self.group.update(num_comments=F("num_comments") + 1)

    def delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)

        # HACK: support Group.num_comments
        if self.type == ActivityType.NOTE.value:
            self.group.update(num_comments=F("num_comments") - 1)

    def send_notification(self):
        activity.send_activity_notifications.delay(self.id)


class ActivityIntegration(Enum):
    """Used in the Activity data column to define an acting integration"""

    CODEOWNERS = "codeowners"
    PROJECT_OWNERSHIP = "projectOwnership"
    SLACK = "slack"
    MSTEAMS = "msteams"
    SUSPECT_COMMITTER = "suspectCommitter"
