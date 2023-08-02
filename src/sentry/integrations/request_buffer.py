from datetime import datetime, timedelta

from django.conf import settings

from sentry.utils import redis

BUFFER_SIZE = 30  # 30 days
KEY_EXPIRY = 60 * 60 * 24 * 30  # 30 days

IS_BROKEN_RANGE = 7  # 7 days

VALID_KEYS = ["success", "error", "fatal"]


class IntegrationRequestBuffer:
    """
    Create a data structure to store daily successful and failed request counts for each installed integration in Redis
    This should store the aggregate counts of each type for last 30 days for each integration
    """

    def __init__(self, key):
        self.integrationkey = key

        cluster_id = settings.SENTRY_INTEGRATION_ERROR_LOG_REDIS_CLUSTER
        self.client = redis.redis_clusters.get(cluster_id)

    def add(self, count: str):
        if count not in VALID_KEYS:
            raise Exception("Requires a valid key param.")

        now = datetime.now().strftime("%Y-%m-%d")
        buffer_key = f"{self.integrationkey}:{now}"

        pipe = self.client.pipeline()
        pipe.hincrby(buffer_key, count + "_count", 1)
        pipe.expire(buffer_key, KEY_EXPIRY)
        pipe.execute()

    def record_error(self):
        self.add("error")

    def record_success(self):
        self.add("success")

    def record_fatal(self):
        self.add("fatal")

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

    def _get_all_from_buffer(self):
        """
        Get the list at the buffer key.
        """

        now = datetime.now()
        all_range = [
            f"{self.integrationkey}:{(now - timedelta(days=i)).strftime('%Y-%m-%d')}"
            for i in range(BUFFER_SIZE)
        ]

        return self._get_range_buffers(all_range)

    def _get_broken_range_from_buffer(self):
        """
        Get the list at the buffer key in the broken range.
        """

        now = datetime.now()
        broken_range_keys = [
            f"{self.integrationkey}:{(now - timedelta(days=i)).strftime('%Y-%m-%d')}"
            for i in range(IS_BROKEN_RANGE)
        ]

        return self._get_range_buffers(broken_range_keys)

    def _get_range_buffers(self, keys):
        pipe = self.client.pipeline()
        ret = []
        for key in keys:
            pipe.hgetall(key)
        response = pipe.execute()
        for item in response:
            if item:
                ret.append(item)

        return ret
