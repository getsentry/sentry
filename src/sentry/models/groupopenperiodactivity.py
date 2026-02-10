from enum import IntEnum
from uuid import UUID, uuid4

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey
from sentry.db.models.base import DefaultFieldsModel, region_silo_model


class OpenPeriodActivityType(IntEnum):
    OPENED = 1
    STATUS_CHANGE = 2
    CLOSED = 3

    def to_str(self) -> str:
        """
        Return the string representation of the activity type.
        """
        return self.name.lower()


def generate_random_uuid() -> UUID:
    return uuid4()


@region_silo_model
class GroupOpenPeriodActivity(DefaultFieldsModel):
    """
    The GroupOpenPeriodActivity tracks state changes within open periods.
    """

    __relocation_scope__ = RelocationScope.Excluded

    group_open_period = FlexibleForeignKey("sentry.GroupOpenPeriod")
    # OpenPeriodActivityType
    type: models.Field = models.IntegerField()
    # The priority associated with this activity row.
    # Can be None if the row corresponds to open period closure.
    value = models.IntegerField(null=True)
    # The event ID that triggered this activity
    event_id = models.CharField(max_length=32, null=True)
    notification_uuid = models.UUIDField("notification_uuid", default=generate_random_uuid)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupopenperiodactivity"
