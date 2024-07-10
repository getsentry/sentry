from __future__ import annotations

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    region_silo_model,
    sane_repr,
)


@region_silo_model
class ProcessingIssue(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project", db_index=True, db_constraint=False)
    checksum = models.CharField(max_length=40, db_index=True)
    type = models.CharField(max_length=30)
    data = GzippedDictField()
    datetime = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_processingissue"
        unique_together = (("project", "checksum", "type"),)

    __repr__ = sane_repr("project_id")

    @property
    def scope(self):
        return self.data["_scope"]

    @property
    def object(self):
        return self.data["_object"]


@region_silo_model
class EventProcessingIssue(Model):
    __relocation_scope__ = RelocationScope.Excluded

    raw_event = FlexibleForeignKey("sentry.RawEvent", db_constraint=False)
    processing_issue = FlexibleForeignKey("sentry.ProcessingIssue", db_constraint=False)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_eventprocessingissue"
        unique_together = (("raw_event", "processing_issue"),)

    __repr__ = sane_repr("raw_event", "processing_issue")
