from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.array import ArrayField


@region_silo_only_model
class UserFeedback(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    project_id = BoundedBigIntegerField()
    replay_id = models.CharField(max_length=32, null=True)
    url = models.CharField(max_length=1000, null=True)
    error_ids = ArrayField()
    trace_ids = ArrayField()
    feedback_text = models.TextField()
    context = models.JSONField(null=True)
    # Should user feedback ID be defined on the client SDK?

    class Meta:
        app_label = "user_feedback"
        db_table = "user_feedback_user_feedback"

    __repr__ = sane_repr("project_id", "id")
