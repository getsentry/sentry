from dataclasses import dataclass

from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import APIException

from sentry.types.region import RegionContextError, get_local_region


class MaxSnowflakeRetryError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Max allowed ID retry reached. Please try again in a second"


class SnowflakeIdMixin:
    def save_with_snowflake_id(self, snowflake_redis_key, save_callback):
        if not self.id:
            self.id = generate_snowflake_id()
        save_callback()


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

NULL_REGION_ID = 0


def msb_0_ordering(value, width):
    """
    MSB 0 Ordering refers to when the bit numbering starts at zero for the
    most significant bit (MSB) the numbering scheme is called MSB 0.
    """
    lsb_0_ordering = f"{value:0{width}b}"
    msb_0_ordering = lsb_0_ordering[::-1]
    return int(msb_0_ordering, 2)


def generate_snowflake_id(redis_key: str = "") -> int:
    from sentry.models import SnowflakeSeq

    segment_values = {}
    segment_values[VERSION_ID] = msb_0_ordering(settings.SNOWFLAKE_VERSION_ID, VERSION_ID.length)

    try:
        segment_values[REGION_ID] = get_local_region().id
    except RegionContextError:  # expected if running in monolith mode
        segment_values[REGION_ID] = NULL_REGION_ID

    sequence = SnowflakeSeq.next_seq()
    # supports up to 130 years
    segment_values[TIME_DIFFERENCE] = sequence >> REGION_SEQUENCE.length
    segment_values[REGION_SEQUENCE] = sequence % (1 << REGION_SEQUENCE.length)

    snowflake_id = 0
    for segment in BIT_SEGMENT_SCHEMA:
        segment.validate(segment_values[segment])
        snowflake_id = (snowflake_id << segment.length) | segment_values[segment]

    ID_VALIDATOR.validate(snowflake_id)

    return snowflake_id
