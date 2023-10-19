from django.db import models, router, transaction
from django.db.models.signals import post_save

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    region_silo_only_model,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_only_model
class RepositoryProjectPathConfig(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    repository = FlexibleForeignKey("sentry.Repository")
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)

    organization_integration_id = HybridCloudForeignKey(
        "sentry.OrganizationIntegration", on_delete="CASCADE"
    )
    organization_id = BoundedBigIntegerField(db_index=True)
    # From a region point of view, you really only have per organization scoping.
    integration_id = BoundedBigIntegerField(db_index=False)
    stack_root = models.TextField()
    source_root = models.TextField()
    default_branch = models.TextField(null=True)
    # Indicates if Sentry created this mapping
    automatically_generated = models.BooleanField(default=False)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_repositoryprojectpathconfig"
        unique_together = (("project", "stack_root"),)


def process_resource_change(instance, **kwargs):
    from sentry.models.group import Group
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.tasks.codeowners import update_code_owners_schema
    from sentry.utils.cache import cache

    def _spawn_update_schema_task():
        """
        We need to re-apply the updated code mapping against any CODEOWNERS file that uses this mapping.
        """
        try:
            update_code_owners_schema.apply_async(
                kwargs={
                    "organization": instance.project.organization,
                    "projects": [instance.project],
                }
            )
        except (Project.DoesNotExist, Organization.DoesNotExist):
            pass

    def _clear_commit_context_cache():
        """
        Once we have a new code mapping for a project, we want to give all groups in the project
        a new chance to generate missing suspect commits. We debounce the process_commit_context task
        if we cannot find the Suspect Committer from the given code mappings. Thus, need to clear the
        cache to reprocess with the new code mapping
        """

        group_ids = Group.objects.filter(project_id=instance.project_id).values_list(
            "id", flat=True
        )
        cache_keys = [f"process-commit-context-{group_id}" for group_id in group_ids]
        cache.delete_many(cache_keys)

    transaction.on_commit(_spawn_update_schema_task, router.db_for_write(type(instance)))
    transaction.on_commit(_clear_commit_context_cache, router.db_for_write(type(instance)))


post_save.connect(
    lambda instance, **kwargs: process_resource_change(instance, **kwargs),
    sender=RepositoryProjectPathConfig,
    weak=False,
)
