import pytest

from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
class TestTranslateUotimeHeaderObjectsToList(TestMigrations):
    app = "uptime"
    migrate_from = "0015_headers_deafult_empty_list"
    migrate_to = "0016_translate_uptime_object_headers_to_lists"

    def setup_initial_state(self):
        self.sub = self.create_uptime_subscription(headers={})
        self.sub2 = self.create_uptime_subscription(headers=[["Accept", "text/html"]])

    def test(self):
        self.sub.refresh_from_db()
        self.sub2.refresh_from_db()
        assert self.sub.headers == []
        assert self.sub2.headers == [["Accept", "text/html"]]
