from __future__ import annotations

from datetime import timedelta

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import control_silo_model, region_silo_model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.uuid import UUIDField

RETRY_BACKOFF = timedelta(minutes=10)
"""After each failed attempt we wait 10 minutes between retries."""

MAX_AGE = timedelta(hours=1)
"""Give up on retries after 1 hour."""


class RelocationTransferState(models.TextChoices):
    Request = "request"
    Reply = "reply"


class BaseRelocationTransfer(DefaultFieldsModel):
    """
    Base class for control + region relocation transfer models

    Relocation transfers are used to record a retriable
    state of a regional transfer for relocation data.
    These models replace outbox based transfers.
    """

    __relocation_scope__ = RelocationScope.Excluded

    relocation_uuid = UUIDField()
    org_slug = models.CharField(null=False)
    requesting_region = models.CharField(null=False)
    exporting_region = models.CharField(null=False)
    state = models.CharField(
        choices=RelocationTransferState, default=RelocationTransferState.Request
    )
    scheduled_for = models.DateTimeField(null=True, default=timezone.now)

    class Meta:
        abstract = True


@control_silo_model
class ControlRelocationTransfer(BaseRelocationTransfer):
    __relocation_scope__ = RelocationScope.Excluded

    # The public key of the region that is requesting
    # the relocation.
    public_key = models.BinaryField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controlrelocationtransfer"


@region_silo_model
class RegionRelocationTransfer(BaseRelocationTransfer):
    __relocation_scope__ = RelocationScope.Excluded

    class Meta:
        app_label = "sentry"
        db_table = "sentry_regionrelocationtransfer"
