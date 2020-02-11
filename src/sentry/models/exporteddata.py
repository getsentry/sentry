from __future__ import absolute_import

import six
from enum import Enum

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.constants import ExportQueryType
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    sane_repr,
)


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
    file = FlexibleForeignKey("sentry.File", null=True, db_constraint=False)
    date_added = models.DateTimeField(default=timezone.now)
    date_finished = models.DateTimeField(null=True)
    date_expired = models.DateTimeField(null=True)
    query_type = BoundedPositiveIntegerField(choices=ExportQueryType.as_choices())
    query_info = JSONField()

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
