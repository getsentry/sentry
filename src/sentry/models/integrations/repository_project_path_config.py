from django.db import models
from django.db.models.signals import post_save

from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey
from sentry.tasks.code_owners import update_code_owners_schema


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


post_save.connect(
    lambda instance, **kwargs: update_code_owners_schema.apply_async(
        kwargs={"organization": instance.project.organization, "projects": [instance.project]}
    ),
    sender=RepositoryProjectPathConfig,
    weak=False,
)
