from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING, Any, ClassVar, Mapping, Optional, Sequence

from django.conf import settings
from django.db import models
from django.db.models import F
from django.db.models.signals import post_save
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.tasks import activity
from sentry.types.activity import CHOICES, ActivityType

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.models.user import User
    from sentry.services.hybrid_cloud.user import RpcUser


class ActivityManager(BaseManager["Activity"]):
    def get_activities_for_group(self, group: Group, num: int) -> Sequence[Group]:
        activities = []
        activity_qs = self.filter(group=group).order_by("-datetime")

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
        user: Optional[User | RpcUser] = None,
        user_id: Optional[int] = None,
        data: Optional[Mapping[str, Any]] = None,
        send_notification: bool = True,
    ) -> Activity:
        if user:
            user_id = user.id
        activity_args = {
            "project_id": group.project_id,
            "group": group,
            "type": type.value,
            "data": data,
        }
        if user_id is not None:
            activity_args["user_id"] = user_id
        activity = self.create(**activity_args)
        if send_notification:
            activity.send_notification()

        return activity


@region_silo_only_model
class Activity(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    group = FlexibleForeignKey("sentry.Group", null=True)
    # index on (type, ident)
    type: models.Field[int | ActivityType, int] = BoundedPositiveIntegerField(choices=CHOICES)
    ident = models.CharField(max_length=64, null=True)
    # if the user is not set, it's assumed to be the system
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    datetime = models.DateTimeField(default=timezone.now)
    data: models.Field[dict[str, Any], dict[str, Any]] = GzippedDictField(null=True)

    objects: ClassVar[ActivityManager] = ActivityManager()

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
        from sentry.models.release import Release

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
            from sentry.models.group import Group

            self.group.update(num_comments=F("num_comments") + 1)
            post_save.send_robust(
                sender=Group, instance=self.group, created=True, update_fields=["num_comments"]
            )

    def delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)

        # HACK: support Group.num_comments
        if self.type == ActivityType.NOTE.value:
            from sentry.models.group import Group

            self.group.update(num_comments=F("num_comments") - 1)
            post_save.send_robust(
                sender=Group, instance=self.group, created=True, update_fields=["num_comments"]
            )

    def send_notification(self):
        activity.send_activity_notifications.delay(self.id)


class ActivityIntegration(Enum):
    """Used in the Activity data column to define an acting integration"""

    CODEOWNERS = "codeowners"
    PROJECT_OWNERSHIP = "projectOwnership"
    SLACK = "slack"
    MSTEAMS = "msteams"
    DISCORD = "discord"
    SUSPECT_COMMITTER = "suspectCommitter"
