from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BaseModel, BoundedBigIntegerField, cell_silo_model, sane_repr


@cell_silo_model
class SeerAutofixIssueData(BaseModel):
    __relocation_scope__ = RelocationScope.Excluded

    group_id = BoundedBigIntegerField(primary_key=True)
    organization_id = BoundedBigIntegerField(db_index=True)
    project_id = BoundedBigIntegerField()
    source = models.CharField(max_length=32)
    pr_id = BoundedBigIntegerField(null=True)
    raw_issue_data = models.JSONField()
    judge_review = models.JSONField(null=True)
    added_ts = models.DateTimeField(auto_now_add=True)
    updated_ts = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "seer"
        db_table = "seer_autofixissuedata"

    __repr__ = sane_repr("pk", "organization_id", "project_id", "source")
