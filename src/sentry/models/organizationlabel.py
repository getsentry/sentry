from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model, sane_repr


@cell_silo_model
class OrganizationLabel(Model):
    """
    Defines a label name scoped to an organization.

    IssueLabel references this model to attach labels to individual issues.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", related_name="organizationlabel_set")
    label_name = models.CharField(max_length=255)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationlabel"
        unique_together = (("organization", "label_name"),)

    __repr__ = sane_repr("organization_id", "label_name")
