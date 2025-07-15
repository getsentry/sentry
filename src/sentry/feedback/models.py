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
class Keyword(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    label = models.CharField(max_length=255)
    groups = models.ManyToManyField("sentry.Group", through="feedback.GroupKeyword")

    class Meta:
        app_label = "feedback"
        db_table = "feedback_keyword"
        unique_together = (("organization_id", "label"),)
        indexes = [models.Index(fields=("organization_id", "label"))]

    __repr__ = sane_repr("organization_id", "label")


@region_silo_model
class GroupKeyword(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group", on_delete=models.CASCADE)
    keyword = FlexibleForeignKey("feedback.Keyword", on_delete=models.CASCADE)

    class Meta:
        app_label = "feedback"
        db_table = "feedback_groupkeyword"
        unique_together = (("group", "keyword"),)
        indexes = [
            models.Index(fields=("group", "keyword")),
        ]

    __repr__ = sane_repr("group", "keyword")
