from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model, sane_repr
from sentry.models.options.project_template_option import ProjectTemplateOption, TProjectOptions


@region_silo_model
class ProjectTemplate(DefaultFieldsModel):
    """
    Identifies a project template that can be used to create new projects.

    This model links the project template options to the organization that owns them.
    """

    __relocation_scope__ = RelocationScope.Organization

    name = models.CharField(max_length=200)
    organization = FlexibleForeignKey("sentry.Organization")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projecttemplate"

        constraints = [
            models.UniqueConstraint(
                fields=["name", "organization"], name="unique_projecttemplate_name_per_org"
            )
        ]

    __repr__ = sane_repr("name", "organization_id")

    def get_options(self) -> TProjectOptions:
        # TODO use self.options.all() instead, and return the QuerySet.
        # TODO cause refactoring types.
        return ProjectTemplateOption.objects.get_all_values(project_template=self)
