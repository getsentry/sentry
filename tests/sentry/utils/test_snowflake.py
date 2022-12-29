from sentry.testutils import TestCase
from sentry.utils.snowflake import generate_snowflake_id


class SnowflakeUtilsTest(TestCase):
    def test_generates_unique_ids(self):
        seen_ids = set()
        for i in range(30000):
            next_id = generate_snowflake_id()
            assert next_id not in seen_ids
            seen_ids.add(next_id)
