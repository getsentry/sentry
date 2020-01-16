from __future__ import absolute_import

from datetime import timedelta
from django.conf import settings
from django.db import models
from django.utils import timezone
from uuid import uuid4

from sentry.db.models import FlexibleForeignKey, Model, sane_repr

DEFAULT_EXPIRATION = timedelta(days=7)


class ExportedData(Model):
    """
    Stores references to asynchronous data export jobs being stored
    in the Google Cloud Platform temporary storage solution.
    """

    __core__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    data_id = models.CharField(max_length=32, unique=True, default=uuid4().hex)
    created_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True)
    expired_at = models.DateTimeField(null=True)
    storage_url = models.CharField(max_length=256, null=True)
    # query = some custom shape???

    class Meta:
        app_label = "sentry"
        db_table = "sentry_exporteddata"

    def get_storage_info(self):
        return {"expired_at": self.expired_at, "storage_url": self.storage_url}

    def set_finished_at(self, storage_url):
        self.finished_at = timezone.now()
        self.storage_url = storage_url

    def set_expired_at(self, expire_time):
        # TODO: Replace this with a parameterized version
        self.expired_at = timezone.now()

    __repr__ = sane_repr("data_id")
