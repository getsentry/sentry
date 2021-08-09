from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model
from sentry.db.models.fields import JSONField


class EthereumAddress(Model):
    __include_in_export__ = True

    project = FlexibleForeignKey("sentry.Project", db_index=True)
    # Ethereum address in hex format
    address = models.CharField(max_length=64, db_index=True)
    display_name = models.TextField()
    last_updated = models.DateTimeField(default=timezone.now)
    abi_contents = JSONField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_ethereumaddress"
        unique_together = (("address", "project"),)
