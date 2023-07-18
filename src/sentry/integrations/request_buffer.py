# import logging
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
        self.is_fatal = False

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

    def _get(self):
        """
        Returns the list of daily aggregate error counts.
        """
        return [
            self._convert_obj_to_dict(obj) for obj in self._get_all_from_buffer(self.integrationkey)
        ]

    def is_integration_broken(self):
        """
        Integration is broken if we have 7 consecutive days of errors and no successes OR have a fatal error

        """
        # fast shutoff
        #  if self.is_fatal:
        #      return True

        data = [
            datetime.strptime(item.get("date"), "%Y-%m-%d").date()
            for item in self._get()
            if item.get("error_count", 0) > 0
            and item.get("success_count", 0) == 0
            and item.get("date")
        ][0 : IS_BROKEN_RANGE - 1]

        if not len(data):
            return False

        date_set = {data[0] - timedelta(x) for x in range((data[0] - data[-1]).days)}
        missing = list(date_set - set(data))
        if len(missing):
            return False
        return True

    def add(self, count: str):
        VALID_KEYS = ["success", "error", "fatal"]
        if count not in VALID_KEYS:
            raise Exception("Requires a valid key param.")

        other_count1, other_count2 = list(set(VALID_KEYS).difference([count]))[0:2]
        buffer_key = self.integrationkey
        print(buffer_key)
        now = datetime.now().strftime("%Y-%m-%d")

        pipe = self.client.pipeline()

        # get first element from array
        recent_item_array = self.client.lrange(buffer_key, 0, 1)
        if len(recent_item_array):
            recent_item = json.loads(recent_item_array[0])
            if recent_item.get("date") == now:
                recent_item[f"{count}_count"] += 1
                pipe.lset(buffer_key, 0, json.dumps(recent_item))
            else:
                data = {
                    "date": now,
                    f"{count}_count": 1,
                    f"{other_count1}_count": 0,
                    f"{other_count2}_count": 0,
                }
                pipe.lpush(buffer_key, json.dumps(data))

        else:
            data = {
                "date": now,
                f"{count}_count": 1,
                f"{other_count1}_count": 0,
                f"{other_count2}_count": 0,
            }
            pipe.lpush(buffer_key, json.dumps(data))

        pipe.expire(buffer_key, KEY_EXPIRY)
        pipe.execute()

    def record_error(self):
        self.add("error")
        # if self.is_integration_broken():
        # call uninstall

    def record_success(self):
        return self.add("success")

    def record_fatal(self):
        # skip to uninstall or call is_integration_broken?
        self.is_fatal = True
        self.add("fatal")
        # if self.is_integration_broken():
        # call uninstal
        # integration_service.get_integrations(integration_ids=result.ids


#    def uninstall(self):
