from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model, sane_repr


@region_silo_only_model
class ProjectTemplate(Model):
    """
    Identifies a project template that can be used to create new projects.

    This model links the project template options to the organization that owns them.
    """

    __relocation_scope__ = RelocationScope.Organization

    name = models.CharField(max_length=200)
    organization = FlexibleForeignKey("sentry.Organization")
    date_added = models.DateTimeField(default=timezone.now, null=True)
    updated_at = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projecttemplate"

    __repr__ = sane_repr("name", "organization_id")
