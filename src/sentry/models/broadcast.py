from datetime import timedelta

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, control_silo_model, sane_repr


def default_expiration():
    return timezone.now() + timedelta(days=7)


BROADCAST_CATEGORIES = [
    ("announcement", "Announcement"),
    ("feature", "New Feature"),
    ("blog", "Blog Post"),
    ("event", "Event"),
    ("video", "Video"),
]


@control_silo_model
class Broadcast(Model):
    __relocation_scope__ = RelocationScope.Excluded

    upstream_id = models.CharField(max_length=32, null=True, blank=True)
    title = models.CharField(max_length=64)
    message = models.CharField(max_length=256)
    link = models.URLField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    date_expires = models.DateTimeField(default=default_expiration, null=True, blank=True)
    date_added = models.DateTimeField(default=timezone.now)
    media_url = models.URLField(null=True, blank=True)
    category = models.CharField(choices=BROADCAST_CATEGORIES, max_length=32, null=True, blank=True)
    created_by_id = FlexibleForeignKey("sentry.User", null=True, on_delete=models.SET_NULL)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_broadcast"

    __repr__ = sane_repr("message")


@control_silo_model
class BroadcastSeen(Model):
    __relocation_scope__ = RelocationScope.Excluded

    broadcast = FlexibleForeignKey("sentry.Broadcast")
    user = FlexibleForeignKey("sentry.User")
    date_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_broadcastseen"
        unique_together = ("broadcast", "user")

    __repr__ = sane_repr("broadcast", "user", "date_seen")
