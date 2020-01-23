from __future__ import absolute_import

import six
from datetime import timedelta
from enum import Enum

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, JSONField, Model, sane_repr

DEFAULT_EXPIRATION = timedelta(days=7)


class ExportStatus(six.binary_type, Enum):
    Early = "EARLY"  # The download is being prepared
    Valid = "VALID"  # The download is ready for the user
    Expired = "EXPIRED"  # The download has been deleted


class ExportedData(Model):
    """
    Stores references to asynchronous data export jobs being stored
    in the Google Cloud Platform temporary storage solution.
    """

    __core__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    date_added = models.DateTimeField(default=timezone.now)
    date_finished = models.DateTimeField(null=True)
    date_expired = models.DateTimeField(null=True)
    storage_url = models.URLField(null=True)
    query_type = models.CharField(max_length=32)
    # TODO(Leander): Define a jsonschema to enforce query shape
    query_info = JSONField()  # i.e.: sort rules, order-by's, custom settings

    @property
    def status(self):
        if self.date_finished is None:
            return ExportStatus.Early
        elif self.date_expired < timezone.now():
            return ExportStatus.Expired
        else:
            return ExportStatus.Valid

    class Meta:
        app_label = "sentry"
        db_table = "sentry_exporteddata"

    # def set_completion_info(self, storage_url):
    #     self.date_expired = timezone.now() + DEFAULT_EXPIRATION
    #     self.date_finished = timezone.now()
    #     self.storage_url = storage_url

    # def set_expired_at(self, expire_time):
    #     self.date_expired = expire_time

    __repr__ = sane_repr("data_id")
