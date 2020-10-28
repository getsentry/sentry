from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import BaseModel, GzippedDictField, sane_repr


class Node(BaseModel):
    __core__ = False

    id = models.CharField(max_length=40, primary_key=True)
    # TODO(dcramer): this being pickle and not JSON has the ability to cause
    # hard errors as it accepts other serialization than native JSON
    data = GzippedDictField()
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    __repr__ = sane_repr("timestamp")

    class Meta:
        app_label = "nodestore"
