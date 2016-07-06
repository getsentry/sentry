"""
sentry.nodestore.django.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import math

from django.utils import timezone

from sentry.db.models import create_or_update
from sentry.nodestore.base import NodeStorage


from .models import Node


class DjangoNodeStorage(NodeStorage):
    def delete(self, id):
        Node.objects.filter(id=id).delete()

    def get(self, id):
        try:
            return Node.objects.get(id=id).data
        except Node.DoesNotExist:
            return None

    def get_multi(self, id_list):
        return {
            n.id: n.data
            for n in Node.objects.filter(id__in=id_list)
        }

    def delete_multi(self, id_list):
        Node.objects.filter(id__in=id_list).delete()

    def set(self, id, data):
        create_or_update(
            Node,
            id=id,
            values={
                'data': data,
                'timestamp': timezone.now(),
            },
        )

    def cleanup(self, cutoff_timestamp):
        from sentry.db.deletion import BulkDeleteQuery

        total_seconds = (timezone.now() - cutoff_timestamp).total_seconds()
        days = math.floor(total_seconds / 86400)

        BulkDeleteQuery(
            model=Node,
            dtfield='timestamp',
            days=days,
        ).execute()
