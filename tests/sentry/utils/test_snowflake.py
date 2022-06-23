from datetime import datetime

import pytest
from freezegun import freeze_time

from sentry.testutils import TestCase
from sentry.utils.snowflake import (
    _TTL,
    MAX_AVAILABLE_REGION_SEQUENCES,
    SENTRY_EPOCH_START,
    generate_snowflake_id,
    get_redis_cluster,
)


class SnowflakeUtilsTest(TestCase):
    CURRENT_TIME = datetime(2022, 6, 21, 6, 0)

    @freeze_time(CURRENT_TIME)
    def test_generate_correct_ids(self):
        snowflake_id = generate_snowflake_id("test_redis_key")
        expected_value = (16 << 48) + (
            int(self.CURRENT_TIME.timestamp() - SENTRY_EPOCH_START) << 16
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
            (int(self.CURRENT_TIME.timestamp() - SENTRY_EPOCH_START) - 1) << 16
        )

        assert snowflake_id == expected_value

    @freeze_time(CURRENT_TIME)
    def test_out_of_region_sequences(self):
        cluster = get_redis_cluster("test_redis_key")
        current_timestamp = int(datetime.now().timestamp() - SENTRY_EPOCH_START)
        for i in range(int(_TTL.total_seconds())):
            timestamp = current_timestamp - i
            cluster.set(str(timestamp), 16)

        with pytest.raises(Exception) as context:
            generate_snowflake_id("test_redis_key")

        assert str(context.value) == "No available ID"
