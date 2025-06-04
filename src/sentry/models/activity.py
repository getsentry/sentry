from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from enum import Enum
from typing import TYPE_CHECKING, Any, ClassVar

from django.conf import settings
from django.db import models
from django.db.models import F
from django.db.models.signals import post_save
from django.utils import timezone

from sentry import options
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.issues.grouptype import get_group_type_by_type_id
from sentry.tasks import activity
from sentry.types.activity import CHOICES, STATUS_CHANGE_ACTIVITY_TYPES, ActivityType
from sentry.types.group import PriorityLevel

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser


_default_logger = logging.getLogger(__name__)


class ActivityManager(BaseManager["Activity"]):
    def get_activities_for_group(self, group: Group, num: int) -> Sequence[Activity]:
        activities = []
        activity_qs = self.filter(group=group).order_by("-datetime")

        # Check if 'initial_priority' is available
        initial_priority_value = group.get_event_metadata().get(
            "initial_priority", None
        ) or group.get_event_metadata().get("initial_priority", None)

        initial_priority = (
            PriorityLevel(initial_priority_value).to_str() if initial_priority_value else None
        )

        prev_sig = None
        sig = None
        # we select excess so we can filter dupes
        for item in activity_qs[: num * 2]:
            prev_sig = sig
            sig = (item.type, item.ident, item.user_id, item.data)

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
                data={"priority": initial_priority},
                datetime=group.first_seen,
            )
        )

        return activities[:num]

    def create_group_activity(
        self,
        group: Group,
        type: ActivityType,
        user: User | RpcUser | None = None,
        user_id: int | None = None,
        data: Mapping[str, Any] | None = None,
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


@region_silo_model
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
    data: models.Field[dict[str, Any] | None, dict[str, Any]] = GzippedDictField(null=True)

    objects: ClassVar[ActivityManager] = ActivityManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_activity"
        indexes = (models.Index(fields=("project", "datetime")),)

    __repr__ = sane_repr("project_id", "group_id", "event_id", "user_id", "type", "ident")

    @staticmethod
    def get_version_ident(version: str | None) -> str:
        return (version or "")[:64]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        from sentry.models.release import Release

        # XXX(dcramer): fix for bad data
        if self.type in (ActivityType.RELEASE.value, ActivityType.DEPLOY.value) and isinstance(
            self.data["version"], Release
        ):
            self.data["version"] = self.data["version"].version
        if self.type == ActivityType.ASSIGNED.value:
            self.data["assignee"] = str(self.data["assignee"])

    def save(self, *args: Any, **kwargs: Any) -> None:
        created = bool(not self.id)

        super().save(*args, **kwargs)

        # The receiver for the post_save signal was not working in production, so just execute directly and safely
        try:
            from sentry.integrations.slack.tasks.send_notifications_on_activity import (
                activity_created_receiver,
            )

            activity_created_receiver(self, created)
        except Exception as err:
            _default_logger.info(
                "there was an error trying to kick off activity receiver",
                exc_info=err,
                extra={
                    "activity_id": self.id,
                },
            )
            pass

        if not created:
            return

        # HACK: support Group.num_comments
        if self.type == ActivityType.NOTE.value and self.group is not None:
            from sentry.models.group import Group

            self.group.update(num_comments=F("num_comments") + 1)
            if not options.get("groups.enable-post-update-signal"):
                post_save.send_robust(
                    sender=Group, instance=self.group, created=True, update_fields=["num_comments"]
                )

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        result = super().delete(*args, **kwargs)

        # HACK: support Group.num_comments
        if self.type == ActivityType.NOTE.value and self.group is not None:
            from sentry.models.group import Group

            self.group.update(num_comments=F("num_comments") - 1)
            if not options.get("groups.enable-post-update-signal"):
                post_save.send_robust(
                    sender=Group, instance=self.group, created=True, update_fields=["num_comments"]
                )

        return result

    def send_notification(self) -> None:
        if self.group:
            group_type = get_group_type_by_type_id(self.group.type)
            has_status_change_notifications = group_type.enable_status_change_workflow_notifications
            is_status_change = self.type in {
                activity.value for activity in STATUS_CHANGE_ACTIVITY_TYPES
            }

            # Skip sending the activity notification if the group type does not
            # support status change workflow notifications
            if is_status_change and not has_status_change_notifications:
                return

        activity.send_activity_notifications.delay(self.id)


class ActivityIntegration(Enum):
    """Used in the Activity data column to define an acting integration"""

    CODEOWNERS = "codeowners"
    PROJECT_OWNERSHIP = "projectOwnership"
    SLACK = "slack"
    MSTEAMS = "msteams"
    DISCORD = "discord"
    SUSPECT_COMMITTER = "suspectCommitter"
