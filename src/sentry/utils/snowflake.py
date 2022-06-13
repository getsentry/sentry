from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Tuple

from django.conf import settings
from django.db import IntegrityError

from sentry.utils import redis

_TTL = timedelta(minutes=5)
SENTRY_EPOCH_START = datetime(2022, 4, 26, 0, 0).timestamp()


class SnowflakeIdMixin:
    def save_with_snowflake_id(self, snowflake_redis_key, save_callback):
        for _ in range(settings.MAX_REDIS_SNOWFLAKE_RETRY_COUNTER):
            if not self.id:
                self.id = generate_snowflake_id(snowflake_redis_key)
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

    def __post_init__(self):
        if self.length <= 0:
            raise Exception("The length should be a positive number")

    def validate(self, value):
        if value >> self.length != 0:
            raise Exception(f"{self.name} exceed max bit value of {self.length}")
        return True


BIT_SEGMENT_SCHEMA = (
    VERSION_ID := SnowflakeBitSegment(5, "Version ID"),
    TIME_DIFFERENCE := SnowflakeBitSegment(32, "Time difference"),
    REGION_ID := SnowflakeBitSegment(12, "Region ID"),
    REGION_SEQUENCE := SnowflakeBitSegment(4, "Region sequence"),
)

ID_VALIDATOR = SnowflakeBitSegment(
    sum(segment.length for segment in BIT_SEGMENT_SCHEMA), "Snowflake ID"
)
assert ID_VALIDATOR.length == 53

MAX_AVAILABLE_REGION_SEQUENCES = 1 << REGION_SEQUENCE.length


def msb_0_ordering(value, width):
    """
    MSB 0 Ordering refers to when the bit numbering starts at zero for the
    most significant bit (MSB) the numbering scheme is called MSB 0.
    """
    lsb_0_ordering = f"{value:0{width}b}"
    msb_0_ordering = lsb_0_ordering[::-1]
    return int(msb_0_ordering, 2)


def generate_snowflake_id(redis_key: str) -> int:
    segment_values = {
        VERSION_ID: msb_0_ordering(1, VERSION_ID.length),
        TIME_DIFFERENCE: 0,
        REGION_ID: 0,
        REGION_SEQUENCE: 0,
    }

    current_time = datetime.now().timestamp()
    # supports up to 130 years
    segment_values[TIME_DIFFERENCE] = int(current_time - SENTRY_EPOCH_START)

    snowflake_id = 0
    (
        segment_values[TIME_DIFFERENCE],
        segment_values[REGION_SEQUENCE],
    ) = get_sequence_value_from_redis(redis_key, segment_values[TIME_DIFFERENCE])

    for segment in BIT_SEGMENT_SCHEMA:
        if segment.validate(segment_values[segment]):
            snowflake_id = (snowflake_id << segment.length) | segment_values[segment]

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
