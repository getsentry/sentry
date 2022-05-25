from datetime import datetime

from freezegun import freeze_time

from sentry.testutils import TestCase
from sentry.utils.snowflake import SENTRY_EPOCH_START, snowflake_id_generation


class SnowflakeUtilsTest(TestCase):
    CURRENT_TIME = datetime(2022, 5, 1, 0, 0)

    @freeze_time(CURRENT_TIME)
    def test_generate_correct_id(self):
        snowflake_id = snowflake_id_generation()
        expected_value = (1 << 48) + (int(self.CURRENT_TIME.timestamp() - SENTRY_EPOCH_START) << 16)

        assert snowflake_id == expected_value
