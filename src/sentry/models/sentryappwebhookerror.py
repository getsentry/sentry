from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import EncryptedJsonField, BoundedBigIntegerField, Model


class SentryAppWebhookError(Model):
    __core__ = False

    date_added = models.DateTimeField(db_index=True, default=timezone.now)

    sentry_app = BoundedBigIntegerField(db_column="sentry_app_id")

    organization = BoundedBigIntegerField(db_column="organization_id")

    request_body = EncryptedJsonField()

    request_headers = EncryptedJsonField()

    event_type = models.CharField(max_length=64)

    # We need to store this rather than just fetch it from the related sentry app in case the URL is changed
    webhook_url = models.URLField()

    # This is the body of the error response OR a description of the error (if it wasn't a HTTP response error)
    response_body = models.TextField()

    response_code = models.PositiveSmallIntegerField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappwebhookerror"
