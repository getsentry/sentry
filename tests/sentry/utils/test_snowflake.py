from datetime import datetime

from freezegun import freeze_time

from sentry.testutils import TestCase
from sentry.utils.snowflake import SENTRY_EPOCH_START, snowflake_id_generation


class SnowflakeUtilsTest(TestCase):
    CURRENT_TIME = datetime(2022, 5, 1, 0, 0)

    @freeze_time(CURRENT_TIME)
    def test_generate_correct_ids(self):
        snowflake_id = snowflake_id_generation("test_redis_key")
        expected_value = (16 << 48) + (
            int(self.CURRENT_TIME.timestamp() - SENTRY_EPOCH_START) << 16
        )

        assert snowflake_id == expected_value

    @freeze_time(CURRENT_TIME)
    def test_generate_correct_ids_with_region_sequence(self):
        # next id in the same timestamp, should be 1 greater than last id up to 16 timestamps
        # the 17th will be at the previous timestamp
        snowflake_id = snowflake_id_generation("test_redis_key")

        for _ in range(15):
            new_snowflake_id = snowflake_id_generation("test_redis_key")

            assert new_snowflake_id - snowflake_id == 1
            snowflake_id = new_snowflake_id

        snowflake_id = snowflake_id_generation("test_redis_key")

        expected_value = (16 << 48) + (
            (int(self.CURRENT_TIME.timestamp() - SENTRY_EPOCH_START) - 1) << 16
        )

        assert snowflake_id == expected_value
