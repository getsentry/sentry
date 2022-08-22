import logging
import math
import pickle

from django.utils import timezone

from sentry.db.models import create_or_update
from sentry.nodestore.base import NodeStorage
from sentry.utils.strings import compress, decompress

from .models import Node

logger = logging.getLogger("sentry")


class DjangoNodeStorage(NodeStorage):
    def delete(self, id):
        Node.objects.filter(id=id).delete()
        self._delete_cache_item(id)

    def _decode(self, value, subkey):
        if value is None:
            return None

        try:
            if value.startswith(b"{"):
                return NodeStorage._decode(self, value, subkey=subkey)

            if subkey is None:
                return pickle.loads(value)

            return None
        except Exception as e:
            logger.exception(e)
            return {}

    def _get_bytes(self, id):
        try:
            data = Node.objects.get(id=id).data
            return decompress(data)
        except Node.DoesNotExist:
            return None

    def _get_bytes_multi(self, id_list):
        return {n.id: decompress(n.data) for n in Node.objects.filter(id__in=id_list)}

    def delete_multi(self, id_list):
        Node.objects.filter(id__in=id_list).delete()
        self._delete_cache_items(id_list)

    def _set_bytes(self, id, data, ttl=None):
        create_or_update(Node, id=id, values={"data": compress(data), "timestamp": timezone.now()})

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
