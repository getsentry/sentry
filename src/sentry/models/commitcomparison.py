from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModel, region_silo_model
from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


@region_silo_model
class CommitComparison(DefaultFieldsModel):
    """
    Captures Git information provided by our users and links with our richer data models.
    Can represent a single commit (main branch) or a comparison between commits (PR branch).
    See https://www.notion.so/sentry/Emerge-Git-User-Experience-2148b10e4b5d80829406c85e010bd083
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)

    # Core commit information
    head_sha = models.CharField(max_length=64)
    base_sha = models.CharField(max_length=64, null=True)  # merge-base

    # Repository information
    provider = models.CharField(max_length=64, null=True)
    head_repo_name = models.CharField(max_length=255)  # "owner/repo"
    base_repo_name = models.CharField(max_length=255, null=True)  # for forks

    # Branch/ref information
    head_ref = models.CharField(max_length=255, null=True)  # "feature/xyz"
    base_ref = models.CharField(max_length=255, null=True)  # "main"

    # Pull request information
    pr_number = models.PositiveIntegerField(null=True)

    # Sentry data, can be hydrated separately
    head_commit = FlexibleForeignKey(
        "sentry.Commit",
        null=True,
        on_delete=models.SET_NULL,
        related_name="head_commit_set",
        db_constraint=False,
    )
    base_commit = FlexibleForeignKey(
        "sentry.Commit",
        null=True,
        on_delete=models.SET_NULL,
        related_name="base_commit_set",
        db_constraint=False,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_commitcomparison"
        indexes = [
            models.Index(fields=["organization_id", "head_repo_name", "head_sha"]),
            models.Index(fields=["organization_id", "head_repo_name", "base_sha"]),
        ]
        constraints = [
            # For comparisons (base_sha present - PR scenario)
            models.UniqueConstraint(
                fields=["organization_id", "head_repo_name", "head_sha", "base_sha"],
                condition=models.Q(base_sha__isnull=False),
                name="sentry_commitcomparison_org_comparison_uniq",
            ),
            # For single commits (base_sha NULL - main branch scenario)
            models.UniqueConstraint(
                fields=["organization_id", "head_repo_name", "head_sha"],
                condition=models.Q(base_sha__isnull=True),
                name="sentry_commitcomparison_org_commit_uniq",
            ),
        ]
