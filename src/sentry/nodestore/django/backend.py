"""
sentry.nodestore.django.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.utils import timezone

from sentry.db.models import create_or_update
from sentry.nodestore.base import NodeStorage

from .models import Node


class DjangoNodeStorage(NodeStorage):
    def get(self, src):
        return Node.objects.get(src=src)

    def get_multi(self, src_list):
        return Node.objects.get(src__in=src_list)

    def set(self, src, data, timestamp=None):
        create_or_update(
            Node,
            src=src,
            data=data,
            timestamp=timestamp or timezone.now()
        )

    def set_multi(self, values):
        for v in values:
            self.set(**v)
