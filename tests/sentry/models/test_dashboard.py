from sentry.models.dashboard import Dashboard
from sentry.testutils.cases import TestCase


class IncrementalNameTest(TestCase):
    def test_no_conflict(self):
        assert Dashboard.incremental_name(self.organization, "Stats") == "Stats"

    def test_one_preexisting(self):
        self.create_dashboard(title="Stats", organization=self.organization)

        assert Dashboard.incremental_name(self.organization, "Stats") == "Stats Copy"

    def test_two_consecutive_preexisting(self):
        self.create_dashboard(title="Stats", organization=self.organization)
        self.create_dashboard(title="Stats Copy", organization=self.organization)

        assert Dashboard.incremental_name(self.organization, "Stats") == "Stats Copy 2"

    def test_two_preexisting_non_starting(self):
        self.create_dashboard(title="Stats Copy 4", organization=self.organization)
        self.create_dashboard(title="Stats Copy 5", organization=self.organization)

        assert Dashboard.incremental_name(self.organization, "Stats") == "Stats Copy 6"

    def test_two_preexisting_non_starting_non_consecutive(self):
        self.create_dashboard(title="Stats Copy 4", organization=self.organization)
        self.create_dashboard(title="Stats Copy 17", organization=self.organization)

        assert Dashboard.incremental_name(self.organization, "Stats") == "Stats Copy 18"

    def test_similar_names(self):
        self.create_dashboard(title="Stats", organization=self.organization)
        self.create_dashboard(title="Statstististicks", organization=self.organization)

        assert Dashboard.incremental_name(self.organization, "Stats") == "Stats Copy"

    def test_similar_name_substring(self):
        self.create_dashboard(title="Statstististicks", organization=self.organization)

        assert Dashboard.incremental_name(self.organization, "Stats") == "Stats"

    def test_across_organizations(self):
        first_organization = self.create_organization()
        second_organization = self.create_organization()

        self.create_dashboard(title="My Stuff", organization=first_organization)
        self.create_dashboard(title="My Stuff Copy", organization=first_organization)
        self.create_dashboard(title="My Stuff Copy 2", organization=first_organization)

        assert Dashboard.incremental_name(first_organization, "My Stuff") == "My Stuff Copy 3"
        assert Dashboard.incremental_name(second_organization, "My Stuff") == "My Stuff"
