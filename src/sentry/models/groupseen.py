from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr


class GroupSeen(Model):
    """
    Track when a group is last seen by a user.
    """

    __core__ = False

    project = FlexibleForeignKey("sentry.Project")
    group = FlexibleForeignKey("sentry.Group")
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, db_index=False)
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupseen"
        unique_together = (("user", "group"),)

    __repr__ = sane_repr("project_id", "group_id", "user_id", "last_seen")
