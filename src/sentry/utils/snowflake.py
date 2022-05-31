import random
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, OrderedDict, Tuple

from django.conf import settings

from sentry.utils import json, redis

BASE_SEED = secrets.randbits(64)
_TTL = timedelta(minutes=5)
SENTRY_EPOCH_START = datetime(2022, 4, 26, 0, 0).timestamp()


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


"""
We want get_region_sequence_assignment_order to produce the same order if called
twice for the same timestamp, but if there are multiple server nodes doing the same
thing concurrently, we want to make sure they are seeded differently.
"""


def get_region_sequence_assignment_order(timestamp):
    values = list(range(MAX_AVAILABLE_REGION_SEQUENCES))
    r = random.Random(BASE_SEED ^ int(timestamp))
    r.shuffle(values)
    return values


def MSB_ordering(value):
    lsb_ordering = f"{value:05b}"
    msb_ordering = lsb_ordering[::-1]
    return int(msb_ordering, 2)


def snowflake_id_generation(redis_key: str) -> int:
    segment_values = OrderedDict()
    segment_values[VERSION_ID] = MSB_ordering(1)
    segment_values[TIME_DIFFERENCE] = 0
    segment_values[REGION_ID] = 0
    segment_values[REGION_SEQUENCE] = 0

    current_time = datetime.now().timestamp()
    # supports up to 130 years
    segment_values[TIME_DIFFERENCE] = int(current_time - SENTRY_EPOCH_START)

    region_sequence_order = get_region_sequence_assignment_order(segment_values[TIME_DIFFERENCE])

    total_bits_to_allocate = ID_VALIDATOR.length
    snowflake_id = 0

    region_sequence_order = removed_used_region_sequence_from_list(
        segment_values[TIME_DIFFERENCE], redis_key, region_sequence_order
    )
    # do we need to check whats been used already before we assign?
    if region_sequence_order:
        segment_values[REGION_SEQUENCE] = region_sequence_order.pop()
        #  store used region_seq to redis here
        store_snowflake_to_redis(
            redis_key,
            segment_values[TIME_DIFFERENCE],
            segment_values[REGION_SEQUENCE],
        )

    else:
        (
            segment_values[TIME_DIFFERENCE],
            segment_values[REGION_SEQUENCE],
        ) = get_snowflake_from_redis(redis_key, segment_values[TIME_DIFFERENCE])

    for key, value in segment_values.items():
        if key.validate(value):
            total_bits_to_allocate -= key.length
            snowflake_id += value << (total_bits_to_allocate)

    ID_VALIDATOR.validate(snowflake_id)

    return snowflake_id


def get_redis_cluster(redis_key: str):
    return redis.clusters.get("default").get_local_client_for_key(redis_key)


def store_snowflake_to_redis(redis_key: str, timestamp: int, used_sequence_value: int) -> None:
    cluster = get_redis_cluster(redis_key)
    used_region_sequence = cluster.get(str(timestamp))
    if used_region_sequence:
        used_region_sequence = json.loads(used_region_sequence)
    else:
        used_region_sequence = []
    used_region_sequence.append(used_sequence_value)
    cluster.setex(str(timestamp), int(_TTL.total_seconds()), json.dumps(used_region_sequence))


"""
There is a race condition between the Redis read (line 129) and write (line 141),
which we are aware of and accept as a "good enough" solution. The return value from
this function only indicates that the region sequence value is probably not already
taken, and should be used only to improve efficiency, not as a source of truth.
"""


def get_snowflake_from_redis(redis_key: str, starting_timestamp: int) -> Tuple[int, int]:
    cluster = get_redis_cluster(redis_key)

    for i in range(int(_TTL.total_seconds())):
        timestamp = starting_timestamp - i

        used_region_sequence = cluster.get(str(timestamp))

        if not used_region_sequence:
            used_region_sequence = []
        else:
            used_region_sequence = json.loads(used_region_sequence)

        if len(set(used_region_sequence)) == (MAX_AVAILABLE_REGION_SEQUENCES):
            continue

        for sequence_value in get_region_sequence_assignment_order(timestamp):
            if sequence_value not in used_region_sequence:
                store_snowflake_to_redis(redis_key, timestamp, sequence_value)
                return timestamp, sequence_value

    raise Exception("No available ID")


def removed_used_region_sequence_from_list(
    timestamp: int, redis_key: str, region_sequence_order: list
) -> List[int]:
    cluster = get_redis_cluster(redis_key)
    used_region_sequences = cluster.get(str(timestamp))
    if used_region_sequences:
        used_region_sequences = json.loads(used_region_sequences)

        used_sequence_set = set(used_region_sequences)

        return [sequence for sequence in region_sequence_order if sequence not in used_sequence_set]
