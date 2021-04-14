from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import BaseManager, FlexibleForeignKey, Model, sane_repr
from sentry.models import Project


class ProjectBookmark(Model):
    """
    Identifies a bookmark relationship between a user and an
    aggregated event (Group).
    """

    __core__ = True

    project = FlexibleForeignKey(Project, blank=True, null=True, db_constraint=False)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = BaseManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectbookmark"
        unique_together = ("project", "user")

    __repr__ = sane_repr("project_id", "user_id")
