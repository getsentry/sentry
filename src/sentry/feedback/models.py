from django.db import models
from django.utils import timezone

import sentry_sdk

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, region_silo_model, sane_repr
from sentry.db.models.fields import UUIDField
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


@region_silo_model
class Feedback(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project_id = BoundedBigIntegerField(db_index=True)
    replay_id = models.CharField(max_length=100, null=True, db_index=True)
    url = models.CharField(max_length=1000, null=True)
    message = models.TextField()
    feedback_id = UUIDField(unique=True)
    date_added = models.DateTimeField(default=timezone.now)
    organization_id = BoundedBigIntegerField(db_index=True)
    environment = FlexibleForeignKey("sentry.Environment", null=True)

    # This "data" field is the data coming from the Sentry event and includes things like contexts
    # As we develop the product more, we will add more specific columns and rely on this JSON field less and less
    data = models.JSONField(null=True)

    class Meta:
        app_label = "feedback"
        db_table = "feedback_feedback"
        indexes = [models.Index(fields=("project_id", "date_added"))]

    __repr__ = sane_repr("project_id", "feedback_id")

    def save(self, *args, **kwargs):
        """Override save method to add distributed tracing instrumentation."""
        with sentry_sdk.start_span(
            op="db.feedback.save",
            description=f"Saving feedback {self.feedback_id}",
        ) as span:
            span.set_tag("feedback.project_id", self.project_id)
            span.set_tag("feedback.organization_id", self.organization_id)
            if self.replay_id:
                span.set_tag("feedback.has_replay", True)
                span.set_tag("feedback.replay_id", self.replay_id)
            span.set_data("feedback.message_length", len(self.message or ""))
            return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Override delete method to add distributed tracing instrumentation."""
        with sentry_sdk.start_span(
            op="db.feedback.delete",
            description=f"Deleting feedback {self.feedback_id}",
        ) as span:
            span.set_tag("feedback.project_id", self.project_id)
            span.set_tag("feedback.organization_id", self.organization_id)
            return super().delete(*args, **kwargs)
