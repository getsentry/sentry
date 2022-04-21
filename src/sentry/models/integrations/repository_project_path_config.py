from django.db import models
from django.db.models.signals import post_save

from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey


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

    class Meta:
        app_label = "sentry"
        db_table = "sentry_repositoryprojectpathconfig"
        unique_together = (("project", "stack_root"),)


def process_resource_change(instance, **kwargs):
    from sentry.tasks.codeowners import update_code_owners_schema

    return update_code_owners_schema.apply_async(
        kwargs={"organization": instance.project.organization, "projects": [instance.project]}
    )


post_save.connect(
    lambda instance, **kwargs: process_resource_change(instance, **kwargs),
    sender=RepositoryProjectPathConfig,
    weak=False,
)
