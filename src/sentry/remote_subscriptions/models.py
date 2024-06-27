from enum import Enum

from django.db import models

from sentry.db.models import Model


class BaseRemoteSubscription(Model):
    class Status(Enum):
        ACTIVE = 0
        CREATING = 1
        UPDATING = 2
        DELETING = 3
        DISABLED = 4

    # Text identifier for the subscription type this is. Used to identify the registered callback associated with this
    # subscription.
    type = models.TextField()
    status = models.SmallIntegerField(default=Status.ACTIVE.value, db_index=True)
    subscription_id = models.TextField(unique=True, null=True)

    class Meta:
        abstract = True
