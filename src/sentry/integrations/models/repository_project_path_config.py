from django.db import models, router, transaction
from django.db.models.signals import post_save

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModelExisting,
    FlexibleForeignKey,
    cell_silo_model,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@cell_silo_model
class RepositoryProjectPathConfig(DefaultFieldsModelExisting):
    __relocation_scope__ = RelocationScope.Excluded

    repository = FlexibleForeignKey("sentry.Repository")
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)

    organization_integration_id = HybridCloudForeignKey(
        "sentry.OrganizationIntegration", on_delete="CASCADE"
    )
    organization_id = BoundedBigIntegerField(db_index=True)
    # From a cell point of view, you really only have per organization scoping.
    integration_id = BoundedBigIntegerField(db_index=False)
    stack_root = models.TextField()
    source_root = models.TextField()
    default_branch = models.TextField(null=True)
    # Indicates if Sentry created this mapping
    automatically_generated = models.BooleanField(default=False, db_default=False)

    # Transient flag: when True, the post_save signal skips side effects.
    # Used by the bulk endpoint to fire side effects once per batch.
    _skip_post_save: bool = False

    class Meta:
        app_label = "sentry"
        db_table = "sentry_repositoryprojectpathconfig"
        unique_together = (("project", "stack_root"),)

    def __repr__(self) -> str:
        return (
            f"RepositoryProjectPathConfig(repo={self.repository.name}, "
            + f"branch={self.default_branch}, "
            + f"stack_root={self.stack_root}, "
            + f"source_root={self.source_root})"
        )


def process_resource_change(instance: RepositoryProjectPathConfig, **kwargs):
    if instance._skip_post_save:
        return

    from sentry.models.project import Project
    from sentry.tasks.codeowners import update_code_owners_schema

    def _spawn_update_schema_task():
        """
        We need to re-apply the updated code mapping against any CODEOWNERS file that uses this mapping.
        """
        try:
            update_code_owners_schema.apply_async(
                kwargs={
                    "organization": instance.project.organization_id,
                    "projects": [instance.project_id],
                }
            )
        except Project.DoesNotExist:
            pass

    transaction.on_commit(_spawn_update_schema_task, router.db_for_write(type(instance)))


post_save.connect(
    lambda instance, **kwargs: process_resource_change(instance, **kwargs),
    sender=RepositoryProjectPathConfig,
    weak=False,
    dispatch_uid="repository_project_path_config_post_save",
)
