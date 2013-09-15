"""
sentry.nodestore.django.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from uuidfield import UUIDField

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BaseModel, GzippedDictField, sane_repr)


class Node(BaseModel):
    id = UUIDField(auto=True, primary_key=True)
    data = GzippedDictField()
    timestamp = models.DateTimeField(default=timezone.now)

    __repr__ = sane_repr('timestamp')

    class Meta:
        app_label = 'nodestore'
