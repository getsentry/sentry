import logging
from datetime import datetime

from django.conf import settings

from sentry.utils import json, redis

BUFFER_SIZE = 30  # 30 days
KEY_EXPIRY = 60 * 60 * 24 * 30  # 30 days

logger = logging.getLogger(__name__)


class IntegrationErrorLogBuffer:
    """
    Create a data structure to store daily error counts for each installed integration in Redis
    This should store the aggregate counts for last 30 days for each integration
    """

    def __init__(self, integration):
        self.integration = integration

        cluster_id = settings.SENTRY_INTEGRATION_ERROR_LOG_REDIS_CLUSTER
        self.client = redis.redis_clusters.get(cluster_id)

    def _get_redis_key(self):
        integration_id = self.integration.id

        return f"sentry-integration-error:{integration_id}"

    def _convert_obj_to_dict(self, redis_object):
        """
        Convert the request string stored in Redis to a python dict
        """

        return json.loads(redis_object)

    def _get_all_from_buffer(self, buffer_key):
        """
        Get the list at the buffer key.
        """

        return self.client.lrange(buffer_key, 0, BUFFER_SIZE - 1)

    def get(self):
        """
        Returns the list of daily aggregate error counts.
        """
        return [
            self._convert_obj_to_dict(obj)
            for obj in self._get_all_from_buffer(self._get_redis_key())
        ]

    def add(self):
        buffer_key = self._get_redis_key()
        now = datetime.now().strftime("%Y-%m-%d")

        pipe = self.client.pipeline()

        # get first element from array
        last_item_array = self.client.lrange(buffer_key, 0, 1)
        if len(last_item_array):
            last_item = json.loads(last_item_array[0])
            if last_item.get("date") == now:
                last_item["count"] += 1
                pipe.lset(buffer_key, 0, json.dumps(last_item))
            else:
                data = {
                    "date": now,
                    "count": 1,
                }
                pipe.lpush(buffer_key, json.dumps(data))

        pipe.expire(buffer_key, KEY_EXPIRY)
        pipe.execute()
