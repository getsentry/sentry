from __future__ import absolute_import

from datetime import timedelta
from django.conf import settings
from django.db import models
from django.utils import timezone
from uuid import uuid4

from sentry.db.models import FlexibleForeignKey, Model, sane_repr

DEFAULT_EXPIRATION = timedelta(days=7)


def generate_data_id():
    return uuid4().hex


class ExportedData(Model):
    """
    Stores references to asynchronous data export jobs being stored
    in the Google Cloud Platform temporary storage solution.
    """

    __core__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    data_id = models.CharField(max_length=32, unique=True, default=generate_data_id)
    created_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True)
    expired_at = models.DateTimeField(null=True)
    storage_url = models.URLField(null=True)
    query_type = models.CharField(max_length=32)  # e.g.: Discover_V1, Billing, IssuesByTag
    query_info = models.TextField()  # i.e.: sort rules, order-by's, custom settings

    class Meta:
        app_label = "sentry"
        db_table = "sentry_exporteddata"

    def get_storage_info(self):
        return {"expired_at": self.expired_at, "storage_url": self.storage_url}

    def set_completion_info(self, storage_url):
        self.expired_at = timezone.now() + DEFAULT_EXPIRATION
        self.finished_at = timezone.now()
        self.storage_url = storage_url

    def set_expired_at(self, expire_time):
        self.expired_at = expire_time

    __repr__ = sane_repr("data_id")
