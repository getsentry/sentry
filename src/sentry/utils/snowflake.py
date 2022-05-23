import random
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import OrderedDict, Tuple

from django.conf import settings

from sentry.utils import json, redis


@dataclass(frozen=True, eq=True)
class SnowflakeBitSegment:
    length: int
    name: str

    def validate(self, value):
        if self.length <= 0:
            raise Exception("The length should be a positive number")
        if value >> self.length != 0:
            raise Exception(f"{self.name} exceed max bit value of {self.length}")
        return True


class Snowflake:
    _TTL = timedelta(minutes=500)

    SENTRY_EPOCH_START = datetime(2022, 4, 26, 0, 0).timestamp()
    ID_LENGTH = settings.SNOWFLAKE_ID_LENGTH
    VERSION_ID_LENGTH = settings.SNOWFLAKE_VERSION_ID_LENGTH
    TIME_DIFFERENCE_LENGTH = settings.SNOWFLAKE_TIME_DIFFERENCE_LENGTH
    REGION_ID_LENGTH = settings.SNOWFLAKE_REGION_ID_LENGTH
    REGION_SEQUENCE_LENGTH = settings.SNOWFLAKE_REGION_SEQUENCE_LENGTH
    ID_VALIDATOR = SnowflakeBitSegment(ID_LENGTH, "Snowflake ID")

    VERSION_ID = SnowflakeBitSegment(VERSION_ID_LENGTH, "Version ID")
    TIME_DIFFERENCE = SnowflakeBitSegment(TIME_DIFFERENCE_LENGTH, "Time difference")
    REGION_ID = SnowflakeBitSegment(REGION_ID_LENGTH, "Region ID")
    REGION_SEQUENCE = SnowflakeBitSegment(REGION_SEQUENCE_LENGTH, "Region sequence")

    def __init__(self):
        base_seed = secrets.randbits(64)
        values = list(range(1 << self.SNOWFLAKE_REGION_SEQUENCE_LENGTH))
        r = random.Random(base_seed ^ int(datetime.now().timestamp()))
        r.shuffle(values)
        self.region_sequence_order = values

    def snowflake_id_generation(self, redis_key: str) -> int:
        segment_values = OrderedDict()
        segment_values[self.VERSION_ID] = 0
        segment_values[self.TIME_DIFFERENCE] = 0
        segment_values[self.REGION_ID] = 0
        segment_values[self.REGION_SEQUENCE] = 0

        # current_time = datetime.now().timestamp()
        # # supports up to 130 years
        # segment_values[self.TIME_DIFFERENCE] = int(current_time - self.SENTRY_EPOCH_START)

        # for testing purposes only
        segment_values[self.TIME_DIFFERENCE] = 18

        total_bits_to_allocate = self.SNOWFLAKE_ID_LENGTH
        snowflake_id = 0

        self.removed_used_region_sequence_from_list(segment_values[self.TIME_DIFFERENCE], redis_key)
        # do we need to check whats been used already before we assign?
        if self.region_sequence_order:
            segment_values[self.REGION_SEQUENCE] = self.region_sequence_order.pop()
            #  store used region_seq to redis here
            self.store_snowflake_to_redis(
                redis_key,
                segment_values[self.TIME_DIFFERENCE],
                segment_values[self.REGION_SEQUENCE],
            )

        else:
            (
                segment_values[self.TIME_DIFFERENCE],
                segment_values[self.REGION_SEQUENCE],
            ) = self.get_snowflake_from_redis(redis_key, segment_values[self.TIME_DIFFERENCE])

        for key, value in segment_values.items():
            if key.validate(value):
                total_bits_to_allocate -= key.length
                snowflake_id += value << (total_bits_to_allocate)

        self.SNOWFLAKE_ID_VALIDATOR.validate(snowflake_id)

        return snowflake_id

    def get_redis_cluster(self, redis_key: str):
        return redis.clusters.get("default").get_local_client_for_key(redis_key)

    def store_snowflake_to_redis(
        self, redis_key: str, timestamp: int, used_region_sequence: int
    ) -> None:
        cluster = self.get_redis_cluster(redis_key)
        used_region_sequences = cluster.get(str(timestamp))
        if used_region_sequences:
            used_region_sequences = json.loads(used_region_sequences)
        else:
            used_region_sequences = []
        used_region_sequences.append(used_region_sequence)
        cluster.setex(
            str(timestamp), int(self._TTL.total_seconds()), json.dumps(used_region_sequences)
        )

    def get_snowflake_from_redis(self, redis_key: str, timestamp: int) -> Tuple[int, int]:
        cluster = self.get_redis_cluster(redis_key)

        # temp code for now, want to iterate all keys in redis scan_iter() maybe?
        for i in range(300):
            timestamp -= i
            # do i need to reorder these to avoid collision?
            used_region_sequences = cluster.get(str(timestamp))
            if used_region_sequences:
                used_region_sequences = json.loads(used_region_sequences)

                if len(used_region_sequences) != (1 << self.SNOWFLAKE_REGION_SEQUENCE_LENGTH):
                    for region_sequence in range(1 << self.SNOWFLAKE_REGION_SEQUENCE_LENGTH):
                        if region_sequence not in used_region_sequences:
                            self.store_snowflake_to_redis(redis_key, timestamp, region_sequence)
                            return timestamp, region_sequence

        raise Exception("No available ID")

    def removed_used_region_sequence_from_list(self, timestamp: int, redis_key: str):
        cluster = self.get_redis_cluster(redis_key)
        used_region_sequences = cluster.get(str(timestamp))
        if used_region_sequences:
            used_region_sequences = json.loads(used_region_sequences)

            used_sequence_set = set(used_region_sequences)

            self.region_sequence_order = [
                sequence
                for sequence in self.region_sequence_order
                if sequence not in used_sequence_set
            ]
