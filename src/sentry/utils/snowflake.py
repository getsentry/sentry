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


class Snowflake:
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

    def snowflake_id_generation(self):
        segment_values = OrderedDict()
        segment_values[self.VERSION_ID] = 0
        segment_values[self.TIME_DIFFERENCE] = 0
        segment_values[self.REGION_ID] = 0
        segment_values[self.REGION_SEQUENCE] = 0

        current_time = datetime.now().timestamp()
        # supports up to 130 years
        segment_values[self.TIME_DIFFERENCE] = int(current_time - self.SENTRY_EPOCH_START)

        total_bits_to_allocate = self.SNOWFLAKE_ID_LENGTH
        snowflake_id = 0

        for key, value in segment_values.items():
            if key.validate(value):
                total_bits_to_allocate -= key.length
                snowflake_id += value << (total_bits_to_allocate)

        self.SNOWFLAKE_ID_VALIDATOR.validate(snowflake_id)

        return snowflake_id
