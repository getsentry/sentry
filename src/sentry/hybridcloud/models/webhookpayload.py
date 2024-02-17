from __future__ import annotations

import datetime
from typing import Any, Self

from django.db import models
from django.http import HttpRequest
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, control_silo_only_model, sane_repr
from sentry.utils import json, metrics

THE_PAST = datetime.datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=datetime.UTC)
MAX_ATTEMPTS = 10

BACKOFF_INTERVAL = 3
BACKOFF_RATE = 1.4


@control_silo_only_model
class WebhookPayload(Model):
    __relocation_scope__ = RelocationScope.Excluded

    mailbox_name = models.CharField(null=False, blank=False)
    region_name = models.CharField(null=False)
    # May need to add organization_id in the future for debugging.
    integration_id = models.BigIntegerField(null=True)

    date_added = models.DateTimeField(default=timezone.now, null=False)

    # Scheduling attributes
    schedule_for = models.DateTimeField(default=THE_PAST, null=False)
    attempts = models.IntegerField(default=0, null=False)

    # payload attributes
    request_method = models.CharField(null=False)
    request_path = models.CharField(null=False)
    request_headers = models.TextField()
    request_body = models.TextField()

    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_webhookpayload"

        indexes = (
            models.Index(fields=["mailbox_name"]),
            models.Index(fields=["schedule_for"]),
        )

    __repr__ = sane_repr(
        "mailbox_name",
        "region_name",
        "schedule_for",
        "attempts",
        "integration_id",
        "request_method",
        "request_path",
    )

    @classmethod
    def get_attributes_from_request(
        cls,
        request: HttpRequest,
    ) -> dict[str, Any]:
        return dict(
            request_method=request.method,
            request_path=request.get_full_path(),
            request_headers=json.dumps({k: v for k, v in request.headers.items()}),
            request_body=request.body.decode(encoding="utf-8"),
        )

    @classmethod
    def create_from_request(
        cls,
        *,
        region: str,
        provider: str,
        identifier: int,
        request: HttpRequest,
        integration_id: int | None = None,
    ) -> Self:
        metrics.incr("hybridcloud.deliver_webhooks.saved")
        return cls.objects.create(
            mailbox_name=f"{provider}:{identifier}",
            region_name=region,
            integration_id=integration_id,
            **cls.get_attributes_from_request(request),
        )

    def schedule_next_attempt(self):
        attempts = self.attempts + 1
        backoff = BACKOFF_INTERVAL * BACKOFF_RATE**attempts
        backoff_delta = datetime.timedelta(minutes=min(backoff, 60))
        new_time = timezone.now() + backoff_delta

        self.update(attempts=attempts, schedule_for=max(new_time, self.schedule_for))
