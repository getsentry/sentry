from sentry.models.dashboard import Dashboard
from sentry.testutils.cases import TestCase


class IncrementalNameTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization

    def test_no_conflict(self):
        assert Dashboard.incremental_name(self.organization, "Stats") == "Stats"

    def test_one_preexisting(self):
        self.create_dashboard(title="Stats")

        assert Dashboard.incremental_name(self.organization, "Stats") == "Stats Copy"

    def test_two_consecutive_preexisting(self):
        self.create_dashboard(title="Stats")
        self.create_dashboard(title="Stats Copy")

        assert Dashboard.incremental_name(self.organization, "Stats") == "Stats Copy 2"

    def test_two_preexisting_non_starting(self):
        self.create_dashboard(title="Stats Copy 4")
        self.create_dashboard(title="Stats Copy 5")

        assert Dashboard.incremental_name(self.organization, "Stats") == "Stats Copy 6"

    def test_two_preexisting_non_starting_non_consecutive(self):
        self.create_dashboard(title="Stats Copy 4")
        self.create_dashboard(title="Stats Copy 17")

        assert Dashboard.incremental_name(self.organization, "Stats") == "Stats Copy 18"
