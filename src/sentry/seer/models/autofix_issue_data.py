from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel


@cell_silo_model
class SeerAutofixIssueData(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey(
        "sentry.Group", on_delete=models.CASCADE, unique=True, db_constraint=False
    )
    organization = FlexibleForeignKey(
        "sentry.Organization", on_delete=models.CASCADE, db_constraint=False
    )
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE, db_constraint=False)
    source = models.CharField(max_length=256)
    pull_request = FlexibleForeignKey(
        "sentry.PullRequest", on_delete=models.SET_NULL, null=True, db_constraint=False
    )
    raw_issue_data = models.JSONField()
    judge_review = models.JSONField(null=True)

    class Meta:
        app_label = "seer"
        db_table = "seer_autofixissuedata"

    __repr__ = sane_repr("group_id", "organization_id", "project_id", "source")
