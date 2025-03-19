import pytest

from sentry.testutils.cases import TestMigrations


class TestTranslateUotimeHeaderObjectsToListTakeTwo(TestMigrations):
    app = "uptime"
    migrate_from = "0030_status_update_date"
    migrate_to = "0031_translate_uptime_object_headers_to_lists_take_three"

    def setup_initial_state(self):
        self.sub = self.create_uptime_subscription(headers={})
        self.sub2 = self.create_uptime_subscription(headers=[["Accept", "text/html"]])

    @pytest.mark.skip(reason="Causes problems in pipeline")
    def test(self):
        self.sub.refresh_from_db()
        self.sub2.refresh_from_db()
        assert self.sub.headers == []
        assert self.sub2.headers == [["Accept", "text/html"]]
