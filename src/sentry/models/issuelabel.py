from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model, sane_repr


@cell_silo_model
class IssueLabel(Model):
    """
    Attaches an organization-defined label with a value to an issue.
    """

    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group", related_name="issuelabel_set")
    label = FlexibleForeignKey("sentry.OrganizationLabel", related_name="issuelabel_set")
    label_value = models.CharField(max_length=255)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_issuelabel"
        indexes = [
            models.Index(fields=["group", "label"]),
        ]

    __repr__ = sane_repr("group_id", "label_id", "label_value")
