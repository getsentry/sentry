from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import BaseManager, FlexibleForeignKey, Model, sane_repr
from sentry.models import Environment


class EnvironmentBookmark(Model):
    """
    Identifies a bookmark relationship between a user and an environment
    """

    __include_in_export__ = True

    environment = FlexibleForeignKey(Environment, db_constraint=False)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_environmentbookmark"
        unique_together = ("environment", "user")

    __repr__ = sane_repr("environment_id", "user_id")
