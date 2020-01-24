from __future__ import absolute_import

import six
from enum import Enum

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, JSONField, Model, sane_repr


class ExportStatus(six.binary_type, Enum):
    Early = "EARLY"  # The download is being prepared
    Valid = "VALID"  # The download is ready for the user
    Expired = "EXPIRED"  # The download has been deleted


# TODO(Leander): Connect PostiveSmallIntegerField to enum
# class ExportQueryType(Enum):


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
    query_type = models.PositiveSmallIntegerField()
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

    __repr__ = sane_repr("data_id")
