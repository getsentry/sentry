from datetime import datetime

import pytest
from django.conf import settings
from django.test import override_settings

from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.region import override_regions
from sentry.types.region import Region, RegionCategory
from sentry.utils import snowflake
from sentry.utils.snowflake import (
    _TTL,
    MAX_AVAILABLE_REGION_SEQUENCES,
    SnowflakeBitSegment,
    generate_snowflake_id,
    get_redis_cluster,
)


class SnowflakeUtilsTest(TestCase):
    CURRENT_TIME = datetime(2022, 7, 21, 6, 0)

    @freeze_time(CURRENT_TIME)
    def test_generate_correct_ids(self):
        snowflake_id = generate_snowflake_id("test_redis_key")
        expected_value = (16 << 48) + (
            int(self.CURRENT_TIME.timestamp() - settings.SENTRY_SNOWFLAKE_EPOCH_START) << 16
        )

        assert snowflake_id == expected_value

    @freeze_time(CURRENT_TIME)
    def test_generate_correct_ids_with_region_sequence(self):
        # next id in the same timestamp, should be 1 greater than last id up to 16 timestamps
        # the 17th will be at the previous timestamp
        snowflake_id = generate_snowflake_id("test_redis_key")

        for _ in range(MAX_AVAILABLE_REGION_SEQUENCES - 1):
            new_snowflake_id = generate_snowflake_id("test_redis_key")

            assert new_snowflake_id - snowflake_id == 1
            snowflake_id = new_snowflake_id

        snowflake_id = generate_snowflake_id("test_redis_key")

        expected_value = (16 << 48) + (
            (int(self.CURRENT_TIME.timestamp() - settings.SENTRY_SNOWFLAKE_EPOCH_START) - 1) << 16
        )

        assert snowflake_id == expected_value

    @freeze_time(CURRENT_TIME)
    def test_out_of_region_sequences(self):
        cluster = get_redis_cluster("test_redis_key")
        current_timestamp = int(datetime.now().timestamp() - settings.SENTRY_SNOWFLAKE_EPOCH_START)
        for i in range(int(_TTL.total_seconds())):
            timestamp = current_timestamp - i
            cluster.set(str(timestamp), 16)

        with pytest.raises(Exception) as context:
            generate_snowflake_id("test_redis_key")

        assert str(context.value) == "No available ID"

    @freeze_time(CURRENT_TIME)
    def test_generate_correct_ids_with_region_id(self):
        regions = [
            r1 := Region("test-region-1", 1, "localhost:8001", RegionCategory.MULTI_TENANT),
            r2 := Region("test-region-2", 2, "localhost:8002", RegionCategory.MULTI_TENANT),
        ]
        with override_settings(SILO_MODE=SiloMode.REGION):

            with override_regions(regions, r1):
                snowflake1 = generate_snowflake_id("test_redis_key")
            with override_regions(regions, r2):
                snowflake2 = generate_snowflake_id("test_redis_key")

            def recover_segment_value(segment: SnowflakeBitSegment, value: int) -> int:
                for s in reversed(snowflake.BIT_SEGMENT_SCHEMA):
                    if s == segment:
                        return value & ((1 << s.length) - 1)
                    value >>= s.length
                raise AssertionError("unreachable")

            assert recover_segment_value(snowflake.REGION_ID, snowflake1) == r1.snowflake_id
            assert recover_segment_value(snowflake.REGION_ID, snowflake2) == r2.snowflake_id
