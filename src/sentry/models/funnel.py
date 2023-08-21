from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.encoding import force_str

from sentry.backup.scopes import RelocationScope
from sentry.conf.server import SENTRY_SCOPES
from sentry.db.models import (
    ArrayField,
    BaseManager,
    FlexibleForeignKey,
    Model,
    control_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.services.hybrid_cloud.orgauthtoken import orgauthtoken_service


@control_silo_only_model
class Funnel(Model):
    __relocation_scope__ = RelocationScope.Global

    project_id = HybridCloudForeignKey("sentry.Project", null=False, on_delete="CASCADE")
    name = models.CharField(max_length=255, null=False, blank=False)
    slug = models.CharField(max_length=255, null=False, blank=False)
    starting_transaction = models.CharField(max_length=255, null=False, blank=False)
    ending_transaction = models.CharField(max_length=255, null=False, blank=False)
    objects = BaseManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_funnel"
