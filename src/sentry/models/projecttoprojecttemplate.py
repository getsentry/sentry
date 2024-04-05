from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model, sane_repr


@region_silo_only_model
class ProjectToProjectTemplate(Model):
    """
    This model maps the project template to the project that is using it.
    """

    __relocation_scope__ = RelocationScope.Organization

    # This is unique instead of a prop on the model to give us future flexibility
    project = FlexibleForeignKey("sentry.Project", related_name="project_to_template", unique=True)
    project_template = FlexibleForeignKey(
        "sentry.ProjectTemplate", related_name="template_to_project"
    )
    date_added = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projecttoprojecttemplate"

    __repr__ = sane_repr("project_id", "project_template_id")
