import pytest

from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
class TestTranslateUotimeHeaderObjectsToListTakeTwo(TestMigrations):
    app = "uptime"
    migrate_from = "0022_add_trace_sampling_to_uptime_monitors"
    migrate_to = "0023_translate_uptime_object_headers_to_lists_take_two"

    def setup_initial_state(self):
        self.sub = self.create_uptime_subscription(headers={})
        self.sub2 = self.create_uptime_subscription(headers=[["Accept", "text/html"]])

        # These will not be touched since they will cause integrity errors
        self.sub_dup1 = self.create_uptime_subscription(url="https://simpsons.com", headers={})
        self.sub_dup2 = self.create_uptime_subscription(url="https://simpsons.com", headers=[])

    def test(self):
        self.sub.refresh_from_db()
        self.sub2.refresh_from_db()
        assert self.sub.headers == []
        assert self.sub2.headers == [["Accept", "text/html"]]

        # In the future we'll need to remove one of these, but for now just
        # make sure we did nothing to them
        self.sub_dup1.refresh_from_db()
        self.sub_dup2.refresh_from_db()
        assert self.sub_dup1.headers == {}
        assert self.sub_dup2.headers == []
