from django.db import models

from sentry.db.models import BaseModel, sane_repr
from sentry.replaystore.base import ReplayDataType


class Replay(BaseModel):  # type: ignore
    __include_in_export__ = False

    replay_id = models.CharField(max_length=80)
    replay_data_type = models.PositiveSmallIntegerField(
        choices=((r.value, str(r)) for r in ReplayDataType),
    )
    timestamp = models.DateTimeField()

    data = models.TextField()

    __repr__ = sane_repr("timestamp")

    class Meta:
        app_label = "replaystore"
        indexes = [
            models.Index(fields=["replay_id", "replay_data_type", "timestamp"]),
        ]
