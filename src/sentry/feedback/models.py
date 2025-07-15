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
class GroupLabel(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group", on_delete=models.CASCADE)
    label = FlexibleForeignKey(
        "feedback.Label", on_delete=models.CASCADE
    )  # rm: Finding the top 10 labels for Groups that are in a given project and date range may be slow (if we don't care about project, date range I think it's fast)

    class Meta:
        app_label = "feedback"
        db_table = "feedback_grouplabel"
        unique_together = (("group", "label"),)
        indexes = [
            models.Index(
                fields=("group", "label")
            ),  # rm: Allows us to quickly find all labels that a certain feedback has
        ]

    __repr__ = sane_repr("group", "label")


@region_silo_model
class Label(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    name = models.CharField(max_length=255)
    groups = models.ManyToManyField("sentry.Group", through=GroupLabel)

    class Meta:
        app_label = "feedback"
        db_table = "feedback_label"
        unique_together = (("organization_id", "name"),)
        indexes = [models.Index(fields=("organization_id", "name"))]

    __repr__ = sane_repr("organization_id", "name")


# To support the query: find top 10 labels by number of groups (counting groups only in a date range and project), should we make a new table? one that stores label, project_id, date (date the feedback was submitted), and group_id. This query is cached based on project_id and date range.
# We also want to find all groups that have a certain list of 20 or so labels, (again filtered by date range and project), maybe the new table would work well here? Note that this specific query is not cached, it would run every time a user clicks on a given category.
