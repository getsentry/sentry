"""
sentry.nodestore.django.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BaseModel, GzippedDictField, sane_repr)


class Node(BaseModel):
    # TODO: should we just UUID this and use claims?
    src = models.AutoField(primary_key=True)
    data = GzippedDictField()
    timestamp = models.DateTimeField(default=timezone.now)

    __repr__ = sane_repr('src', 'timestamp')

    class Meta:
        app_label = 'nodestore'
