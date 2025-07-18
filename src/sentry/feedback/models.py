from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
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


@region_silo_model
class GroupFeedbackLabel(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group")
    feedback_label = FlexibleForeignKey("feedback.FeedbackLabel")

    # Denormalized fields from group, for performance
    project = FlexibleForeignKey("sentry.Project")
    first_seen = models.DateTimeField(default=timezone.now)
    # TODO: if we want to filter by environment(s), we should add a field for that here

    class Meta:
        app_label = "feedback"
        db_table = "feedback_groupfeedbacklabel"
        unique_together = (("group", "feedback_label"),)
        indexes = [
            # rm: Allows us to quickly find all labels that a certain feedback has
            # Q: do we need feedback_label here? or is group enough
            models.Index(fields=("group", "feedback_label")),
            # rm: Allows us to quickly find all feedbacks in a given project and date range that have certain label(s)
            # Also allows us to find all feedbacks and associated labels in a given project and date range
            # Does this support the query: get top 10 labels by number of groups (counting groups only in a date range and project)? Or do we need another field in this index, like "group"
            models.Index(fields=("project", "first_seen", "feedback_label")),
        ]

    __repr__ = sane_repr("group_id", "feedback_label_id")


@region_silo_model
class FeedbackLabel(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization")
    name = models.CharField(max_length=255)
    groups = models.ManyToManyField(
        "sentry.Group", related_name="feedback_labels", through=GroupFeedbackLabel
    )

    class Meta:
        app_label = "feedback"
        db_table = "feedback_feedbacklabel"
        unique_together = (("organization", "name"),)
        indexes = [models.Index(fields=("organization", "name"))]

    __repr__ = sane_repr("organization_id", "name")
