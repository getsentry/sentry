from __future__ import absolute_import

import math

from django.utils import timezone

from sentry.db.models import create_or_update
from sentry.nodestore.base import NodeStorage

from .models import Node


class DjangoNodeStorage(NodeStorage):
    def delete(self, id):
        Node.objects.filter(id=id).delete()
        self._delete_cache_item(id)

    def get(self, id):
        item_from_cache = self._get_cache_item(id)
        if item_from_cache:
            return item_from_cache
        try:
            data = Node.objects.get(id=id).data
            self._set_cache_item(id, data)
            return data
        except Node.DoesNotExist:
            return None

    def get_multi(self, id_list):
        cache_items = self._get_cache_items(id_list)
        if len(cache_items) == len(id_list):
            return cache_items

        uncached_ids = [id for id in id_list if id not in cache_items]
        items = {n.id: n.data for n in Node.objects.filter(id__in=uncached_ids)}
        self._set_cache_items(items)
        items.update(cache_items)
        return items

    def delete_multi(self, id_list):
        Node.objects.filter(id__in=id_list).delete()
        self._delete_cache_items(id_list)

    def set(self, id, data, ttl=None):
        create_or_update(Node, id=id, values={"data": data, "timestamp": timezone.now()})
        self._set_cache_item(id, data)

    def cleanup(self, cutoff_timestamp):
        from sentry.db.deletion import BulkDeleteQuery

        total_seconds = (timezone.now() - cutoff_timestamp).total_seconds()
        days = math.floor(total_seconds / 86400)

        BulkDeleteQuery(model=Node, dtfield="timestamp", days=days).execute()
        if self.cache:
            self.cache.clear()

    def bootstrap(self):
        # Nothing for Django backend to do during bootstrap
        pass
