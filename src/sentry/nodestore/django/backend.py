"""
sentry.nodestore.django.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db import connection
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
        return dict(
            (n.id, n.data)
            for n in Node.objects.filter(id__in=id_list)
        )

    def set(self, id, data):
        create_or_update(
            Node,
            id=id,
            values={
                'data': data,
                'timestamp': timezone.now(),
            },
        )

    def cleanup(self, cutoff_timestamp, chunk_size=100):
        query = """
        DELETE FROM %s WHERE timestamp <= %%s LIMIT %s
        """ % (Node._meta.db_table, chunk_size)
        params = [cutoff_timestamp]

        keep_it_going = True
        while keep_it_going:
            cursor = connection.cursor()
            cursor.execute(query, params)

            keep_it_going = cursor.rowcount > 0
