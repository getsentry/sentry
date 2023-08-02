from datetime import datetime, timedelta

from django.conf import settings

from sentry.utils import json, redis

BUFFER_SIZE = 30  # 30 days
KEY_EXPIRY = 60 * 60 * 24 * 30  # 30 days

IS_BROKEN_RANGE = 7  # 7 days


class IntegrationRequestBuffer:
    """
    Create a data structure to store daily successful and failed request counts for each installed integration in Redis
    This should store the aggregate counts of each type for last 30 days for each integration
    """

    def __init__(self, key):
        self.integrationkey = key

        cluster_id = settings.SENTRY_INTEGRATION_ERROR_LOG_REDIS_CLUSTER
        self.client = redis.redis_clusters.get(cluster_id)

    def _convert_obj_to_dict(self, redis_object):
        """
        Convert the request string stored in Redis to a python dict
        """
        return json.loads(redis_object)

    def _get_all_from_buffer(self):
        """
        Get the list at the buffer key.
        """

        ret = []
        now = datetime.now()
        i = 0
        buffer_key = f"{self.integrationkey}:{now.strftime('%Y-%m-%d')}"
        while self.client.hgetall(buffer_key):
            cur = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            buffer_key = f"{self.integrationkey}:{cur}"
            ret.append(self.client.hgetall(buffer_key))
            i += 1

        return ret

    def _get_broken_range_from_buffer(self):
        """
        Get the list at the buffer key in the broken range.
        """

        ret = []
        now = datetime.now()
        for i in range(IS_BROKEN_RANGE):
            cur = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            buffer_key = f"{self.integrationkey}:{cur}"
            ret.append(self.client.hgetall(buffer_key))

        return ret

    def is_integration_broken(self):
        """
        Integration is broken if we have 7 consecutive days of errors and no successes OR have a fatal error

        """
        items = self._get_broken_range_from_buffer()

        data = [item for item in items if int(item.get("fatal_count", 0)) > 0]

        if len(data) > 0:
            return True

        data = [
            item
            for item in items
            if int(item.get("error_count", 0)) > 0 and int(item.get("success_count", 0)) == 0
        ]

        if not len(data):
            return False

        if len(data) < IS_BROKEN_RANGE:
            return False

        return True

    def add(self, count: str):
        VALID_KEYS = ["success", "error", "fatal"]
        if count not in VALID_KEYS:
            raise Exception("Requires a valid key param.")

        now = datetime.now().strftime("%Y-%m-%d")

        buffer_key = f"{self.integrationkey}:{now}"
        pipe = self.client.pipeline()
        pipe.hincrby(buffer_key, count + "_count", 1)
        pipe.expire(buffer_key, KEY_EXPIRY)
        pipe.execute()
        pipe.reset()

    def record_error(self):
        self.add("error")

    def record_success(self):
        self.add("success")

    def record_fatal(self):
        self.add("fatal")
