from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, NodeField, region_silo_only_model, sane_repr
from sentry.utils.canonical import CanonicalKeyView


def ref_func(x):
    return x.project_id or x.project.id


@region_silo_only_model
class RawEvent(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    event_id = models.CharField(max_length=32, null=True)
    datetime = models.DateTimeField(default=timezone.now)
    data = NodeField(
        blank=True, null=True, ref_func=ref_func, ref_version=1, wrapper=CanonicalKeyView
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_rawevent"
        unique_together = (("project", "event_id"),)

    __repr__ = sane_repr("project_id")
