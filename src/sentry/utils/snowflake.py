from dataclasses import dataclass
from datetime import datetime
from typing import OrderedDict

from django.conf import settings


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


SENTRY_EPOCH_START = datetime(2022, 4, 26, 0, 0).timestamp()
ID_VALIDATOR = SnowflakeBitSegment(settings.SNOWFLAKE_ID_LENGTH, "Snowflake ID")

VERSION_ID = SnowflakeBitSegment(settings.SNOWFLAKE_VERSION_ID_LENGTH, "Version ID")
TIME_DIFFERENCE = SnowflakeBitSegment(settings.SNOWFLAKE_TIME_DIFFERENCE_LENGTH, "Time difference")
REGION_ID = SnowflakeBitSegment(settings.SNOWFLAKE_REGION_ID_LENGTH, "Region ID")
REGION_SEQUENCE = SnowflakeBitSegment(settings.SNOWFLAKE_REGION_SEQUENCE_LENGTH, "Region sequence")


def snowflake_id_generation():
    segment_values = OrderedDict()
    segment_values[VERSION_ID] = 1
    segment_values[TIME_DIFFERENCE] = 0
    segment_values[REGION_ID] = 0
    segment_values[REGION_SEQUENCE] = 0

    current_time = datetime.now().timestamp()
    # supports up to 130 years
    segment_values[TIME_DIFFERENCE] = int(current_time - SENTRY_EPOCH_START)

    total_bits_to_allocate = ID_VALIDATOR.length
    snowflake_id = 0

    for key, value in segment_values.items():
        if key.validate(value):
            total_bits_to_allocate -= key.length
            snowflake_id += value << (total_bits_to_allocate)

    ID_VALIDATOR.validate(snowflake_id)

    return snowflake_id
