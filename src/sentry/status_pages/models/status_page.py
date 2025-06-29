from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, sane_repr
from sentry.db.models.base import DefaultFieldsModelExisting, region_silo_model


@region_silo_model
class StatusPage(DefaultFieldsModelExisting):
    """
    A status page represents a public facing status page for an organization.
    """

    __relocation_scope__ = RelocationScope.Organization

    title = models.CharField(max_length=64)
    description = models.TextField(null=True, blank=True)
    organization = FlexibleForeignKey("sentry.Organization")
    is_public = models.BooleanField(default=False)
    is_accepting_subscribers = models.BooleanField(default=False)
    cname = models.CharField(max_length=255, null=True, blank=True)

    # TODO: make a status page avatar and a favicon model for images?

    class Meta:
        app_label = "status_pages"
        db_table = "sentry_status_page"

    __repr__ = sane_repr("organization_id", "title")
