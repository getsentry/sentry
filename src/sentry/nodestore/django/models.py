"""
sentry.nodestore.django.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BaseModel, GzippedDictField, sane_repr)


class Node(BaseModel):
    id = models.CharField(max_length=40, primary_key=True)
    data = GzippedDictField()
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    __repr__ = sane_repr('timestamp')

    class Meta:
        app_label = 'nodestore'
