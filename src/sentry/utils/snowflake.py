from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import OrderedDict, Tuple

from django.conf import settings
from django.db import IntegrityError

from sentry.utils import redis

_TTL = timedelta(minutes=5)
SENTRY_EPOCH_START = datetime(2022, 4, 26, 0, 0).timestamp()


class SnowflakeIdMixin:
    def save_with_snowflake_id(self, snowflake_redis_key, save_callback):
        for _ in range(settings.MAX_REDIS_SNOWFLAKE_RETY_COUNTER):
            if not self.id:
                self.id = snowflake_id_generation(snowflake_redis_key)
            try:
                save_callback()
                return
            except IntegrityError:
                self.id = None
        raise Exception("Max allowed ID retry reached. Please try again in a second")


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


ID_VALIDATOR = SnowflakeBitSegment(settings.SNOWFLAKE_ID_LENGTH, "Snowflake ID")

VERSION_ID = SnowflakeBitSegment(settings.SNOWFLAKE_VERSION_ID_LENGTH, "Version ID")
TIME_DIFFERENCE = SnowflakeBitSegment(settings.SNOWFLAKE_TIME_DIFFERENCE_LENGTH, "Time difference")
REGION_ID = SnowflakeBitSegment(settings.SNOWFLAKE_REGION_ID_LENGTH, "Region ID")
REGION_SEQUENCE = SnowflakeBitSegment(settings.SNOWFLAKE_REGION_SEQUENCE_LENGTH, "Region sequence")

MAX_AVAILABLE_REGION_SEQUENCES = 1 << REGION_SEQUENCE.length


def MSB_ordering(value, width):
    lsb_ordering = f"{value:0{width}b}"
    msb_ordering = lsb_ordering[::-1]
    return int(msb_ordering, 2)


def snowflake_id_generation(redis_key: str) -> int:
    segment_values = OrderedDict()
    segment_values[VERSION_ID] = MSB_ordering(1, VERSION_ID.length)
    segment_values[TIME_DIFFERENCE] = 0
    segment_values[REGION_ID] = 0
    segment_values[REGION_SEQUENCE] = 0

    current_time = datetime.now().timestamp()
    # supports up to 130 years
    segment_values[TIME_DIFFERENCE] = int(current_time - SENTRY_EPOCH_START)

    total_bits_to_allocate = ID_VALIDATOR.length
    snowflake_id = 0
    (
        segment_values[TIME_DIFFERENCE],
        segment_values[REGION_SEQUENCE],
    ) = get_sequence_value_from_redis(redis_key, segment_values[TIME_DIFFERENCE])

    for key, value in segment_values.items():
        if key.validate(value):
            total_bits_to_allocate -= key.length
            snowflake_id += value << (total_bits_to_allocate)

    ID_VALIDATOR.validate(snowflake_id)

    return snowflake_id


def get_redis_cluster(redis_key: str):
    return redis.clusters.get("default").get_local_client_for_key(redis_key)


def get_sequence_value_from_redis(redis_key: str, starting_timestamp: int) -> Tuple[int, int]:
    cluster = get_redis_cluster(redis_key)

    for i in range(int(_TTL.total_seconds())):
        timestamp = starting_timestamp - i

        # We are decreasing the value by 1 each time since the incr operation in redis
        # initializes the counter at 1. For our region sequences, we want the value to
        # be from 0-15 and not 1-16
        sequence_value = cluster.incr(timestamp)
        sequence_value -= 1

        if sequence_value == 0:
            cluster.expire(timestamp, int(_TTL.total_seconds()))

        if sequence_value < (MAX_AVAILABLE_REGION_SEQUENCES):
            return timestamp, sequence_value

    raise Exception("No available ID")
