from django.db import models, transaction
from django.db.models.signals import post_save

from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_only_model


@region_silo_only_model
class RepositoryProjectPathConfig(DefaultFieldsModel):
    __include_in_export__ = False

    repository = FlexibleForeignKey("sentry.Repository")
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    organization_integration = FlexibleForeignKey(
        "sentry.OrganizationIntegration", on_delete=models.CASCADE
    )
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
    from sentry.models import Organization, Project
    from sentry.tasks.codeowners import update_code_owners_schema

    def _spawn_task():
        try:
            update_code_owners_schema.apply_async(
                kwargs={
                    "organization": instance.project.organization,
                    "projects": [instance.project],
                }
            )
        except (Project.DoesNotExist, Organization.DoesNotExist):
            pass

    transaction.on_commit(_spawn_task)


post_save.connect(
    lambda instance, **kwargs: process_resource_change(instance, **kwargs),
    sender=RepositoryProjectPathConfig,
    weak=False,
)
