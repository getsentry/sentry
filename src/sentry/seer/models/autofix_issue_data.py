from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel


@cell_silo_model
class SeerAutofixIssueData(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    group_id = BoundedBigIntegerField(unique=True)
    organization_id = BoundedBigIntegerField(db_index=True)
    project_id = BoundedBigIntegerField()
    source = models.CharField(max_length=32)
    pr_id = BoundedBigIntegerField(null=True)
    raw_issue_data = models.JSONField()
    judge_review = models.JSONField(null=True)

    class Meta:
        app_label = "seer"
        db_table = "seer_autofixissuedata"

    __repr__ = sane_repr("group_id", "organization_id", "project_id", "source")
