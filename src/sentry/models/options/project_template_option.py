from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model, sane_repr
from sentry.db.models.fields import PickledObjectField


@region_silo_only_model
class ProjectTemplateOption(Model):
    """
    A ProjectTemplateOption is a templated version of a project

    It is used to store the values that are shared between different
    projects across the organization.
    """

    __relocation_scope__ = RelocationScope.Organization

    project_template = FlexibleForeignKey("sentry.ProjectTemplate", related_name="options")
    key = models.CharField(max_length=64)
    value = PickledObjectField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projecttemplateoption"
        unique_together = (("project_template", "key"),)

    __repr__ = sane_repr("project_template_id", "key", "value")
