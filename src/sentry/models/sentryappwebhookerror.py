from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import EncryptedJsonField, FlexibleForeignKey, Model


class SentryAppWebhookError(Model):
    __core__ = False

    date_added = models.DateTimeField(default=timezone.now)

    sentry_app = FlexibleForeignKey("sentry.SentryApp", related_name="webhook_errors")

    organization = FlexibleForeignKey(
        "sentry.Organization", related_name="sentry_app_webhook_errors"
    )

    # If there is a related Sentry error, store it here
    error_id = models.CharField(max_length=64, null=True)

    request_body = EncryptedJsonField()

    request_headers = EncryptedJsonField()

    event_type = models.CharField(max_length=64)

    # We need to store this rather than just fetch it from the related sentry app in case the URL is changed
    webhook_url = models.URLField()

    response_body = models.TextField()

    response_code = models.PositiveSmallIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappwebhookerror"
