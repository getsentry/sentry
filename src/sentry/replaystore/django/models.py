from django.db import models

from sentry.db.models import BaseModel, sane_repr


class Replay(BaseModel):  # type: ignore
    __include_in_export__ = False

    id = models.CharField(max_length=80, primary_key=True)
    data = models.TextField()

    __repr__ = sane_repr("timestamp")

    class Meta:
        app_label = "replaystore"
