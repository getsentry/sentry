import hashlib
from typing import Any, Dict, List, Optional, Union

from django.conf import settings

from sentry.utils.redis import redis_clusters

from .base import StringIndexer

INDEXER_TTL = 3600


def get_client() -> Any:
    return redis_clusters.get(settings.SENTRY_METRICS_INDEXER_REDIS_CLUSTER)


def get_int(string: str) -> int:
    return int.from_bytes(hashlib.md5(string.encode("utf-8")).digest()[:8], "big")


class RedisMockIndexer(StringIndexer):
    """
    Temporary mock string indexer that uses Redis to store data.
    """

    def _get_key(self, instance: Union[str, int]) -> str:
        if isinstance(instance, str):
            return f"temp-metrics-indexer:1:str:{instance}"
        elif isinstance(instance, int):
            return f"temp-metrics-indexer:1:int:{instance}"
        else:
            raise Exception("Invalid: must be string or int")

    def _bulk_record(self, unmapped: Dict[str, None]) -> Dict[str, int]:
        """
        Take a mapping of strings {"metric_id`": None} and populate the ints
        for the corresponding strings.
        This includes save the following key value pairs in Redis
            "temp-metrics-indexer:{org_id}:1:str:{instance}" -> int
            "temp-metrics-indexer:{org_id}:1:int:{instance}" -> string
        """

        mapped_ints: Dict[str, int] = {}
        client = get_client()

        for string in unmapped.keys():
            # use hashlib instead of hash() because the latter uses a random value (unless PYTHONHASHSEED
            # is set to an integer) to seed hashes of strs and bytes
            # https://docs.python.org/3/using/cmdline.html#envvar-PYTHONHASHSEED
            int_value = get_int(string)
            mapped_ints[string] = int_value

            int_key = self._get_key(int_value)
            string_key = self._get_key(string)

            client.set(string_key, int_value, ex=INDEXER_TTL)
            client.set(int_key, string, ex=INDEXER_TTL)

        return mapped_ints

    def bulk_record(self, strings: List[str]) -> Dict[str, int]:
        """
        Takes a list of strings that could be a metric names, tag keys or values
        and returns a string -> int mapping.

        1. Given a list of strings:

          ['release', 'production', 'environment', 'measurement.fp', '1.8.10']

        2. We look up in Redis to see what int values we already have:

          ['1025825', '58876432', '98539986', None, '46186005']

        3. Separate results into resolved and unresolved dictionaries:

            {
                "release": 1025825,
                "production": 8876432,
                "environment": 98539986,
                "1.8.10": 6186005,
            }
            { "measurement.fp": None }

        4. If no unresolved, then return our resolved dict, otherwise
           call self._bulk_record() on the unresolved dict, and updated
           the resolved dictionary
            {
                "release": 1025825,
                "production": 8876432,
                "environment": 98539986,
                "1.8.10": 6186005,
                "measurement.fp": 83361614
            }

        """
        client = get_client()
        string_keys = [self._get_key(s) for s in strings]
        results = client.mget(string_keys)

        resolved: Dict[str, int] = {}
        unresolved: Dict[str, None] = {}
        for i, result in enumerate(results):
            if result:
                resolved[strings[i]] = int(result)
            else:
                unresolved[strings[i]] = None

        if len(unresolved.keys()) == 0:
            return resolved

        newly_resolved = self._bulk_record(unresolved)
        resolved.update(newly_resolved)
        return resolved

    def record(self, string: str) -> int:
        """
        If key already exists, grab that value, otherwise record both the
        string to int and int to string relationships.
        """
        client = get_client()

        string_key = f"temp-metrics-indexer:1:str:{string}"
        value: Any = client.get(string_key)
        if value is None:
            value = get_int(string)
            client.set(string_key, value)

            # reverse record (int to string)
            int_key = f"temp-metrics-indexer:1:int:{value}"
            client.set(int_key, string)

        return int(value)

    def resolve(self, string: str) -> Optional[int]:
        try:
            return int(get_client().get(f"temp-metrics-indexer:1:str:{string}"))
        except TypeError:
            return None

    def reverse_resolve(self, id: int) -> Optional[str]:
        result: Optional[str] = get_client().get(f"temp-metrics-indexer:1:int:{id}")
        return result

    def delete_records(self) -> None:
        """
        Easy way to delete all the data for the temporary indexer.
        """
        client = get_client()
        keys = list(client.scan_iter(match="temp-metrics-indexer*"))
        client.delete(*keys)
