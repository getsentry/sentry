from datetime import timedelta
from enum import Enum
from typing import ClassVar, Self

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model
from sentry.db.models.manager.base import BaseManager


@region_silo_model
class RemoteSubscription(DefaultFieldsModel):
    # TODO: This should be included in export/import, but right now it has no relation to
    # any projects/orgs. Will fix this in a later pr
    __relocation_scope__ = RelocationScope.Excluded

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

    objects: ClassVar[BaseManager[Self]] = BaseManager(
        cache_fields=["pk"], cache_ttl=int(timedelta(hours=1).total_seconds())
    )

    class Meta:
        app_label = "remote_subscriptions"
        db_table = "sentry_remotesubscription"
