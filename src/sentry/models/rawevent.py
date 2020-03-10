from __future__ import absolute_import

from django.db import models

from sentry.db.models import FlexibleForeignKey, Model, NodeField, sane_repr
from sentry.db.models.manager import BaseManager
from sentry.utils.canonical import CanonicalKeyView

from django.utils import timezone


def ref_func(x):
    return x.project_id or x.project.id


class RawEvent(Model):
    __core__ = False

    project = FlexibleForeignKey("sentry.Project")
    event_id = models.CharField(max_length=32, null=True)
    datetime = models.DateTimeField(default=timezone.now)
    data = NodeField(
        blank=True, null=True, ref_func=ref_func, ref_version=1, wrapper=CanonicalKeyView
    )

    objects = BaseManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_rawevent"
        unique_together = (("project", "event_id"),)

    __repr__ = sane_repr("project_id")
