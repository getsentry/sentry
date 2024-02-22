from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model
from sentry.db.models.base import region_silo_only_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_only_model
class SentryShot(Model):
    """
    Represents metadata for a screenshot within Sentry product
    """

    __relocation_scope__ = RelocationScope.Excluded

    # uuid represents the ID of the object for external use. We want something long and difficult to
    # guess since the API reading these will be a public API
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    sentry_url = models.URLField()
    component_identifier = models.CharField()
    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE")
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryshot"
