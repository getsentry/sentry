from sentry.models.dashboard import Dashboard, DashboardProject
from sentry.testutils.cases import TestCase


class IncrementalNameTest(TestCase):
    def test_no_conflict(self):
        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats"

    def test_one_preexisting(self):
        self.create_dashboard(title="Stats", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy"

    def test_two_consecutive_preexisting(self):
        self.create_dashboard(title="Stats", organization=self.organization)
        self.create_dashboard(title="Stats copy", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy 1"

    def test_two_preexisting_non_starting(self):
        self.create_dashboard(title="Stats copy 4", organization=self.organization)
        self.create_dashboard(title="Stats copy 5", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy 6"

    def test_two_preexisting_non_starting_non_consecutive(self):
        self.create_dashboard(title="Stats copy 4", organization=self.organization)
        self.create_dashboard(title="Stats copy 17", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy 18"

    def test_copy_of_copy(self):
        self.create_dashboard(title="Stats copy 4", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats copy 4") == "Stats copy 5"

    def test_name_with_copy_in_it(self):
        assert Dashboard.incremental_title(self.organization, "Stats copy 4") == "Stats copy 4"

    def test_similar_names(self):
        self.create_dashboard(title="Stats", organization=self.organization)
        self.create_dashboard(title="Statstististicks", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy"

    def test_similar_name_substring(self):
        self.create_dashboard(title="Statstististicks", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats"

    def test_across_organizations(self):
        first_organization = self.create_organization()
        second_organization = self.create_organization()

        self.create_dashboard(title="My Stuff", organization=first_organization)
        self.create_dashboard(title="My Stuff copy", organization=first_organization)
        self.create_dashboard(title="My Stuff copy 1", organization=first_organization)

        assert Dashboard.incremental_title(first_organization, "My Stuff") == "My Stuff copy 2"
        assert Dashboard.incremental_title(second_organization, "My Stuff") == "My Stuff"


class DashboardProjectTest(TestCase):
    def test_delete_project_cascade(self):
        project = self.create_project()
        remaining_project = self.create_project()

        dashboard = self.create_dashboard()
        remaining_dashboard = self.create_dashboard()

        dashboard.projects.set([project])
        remaining_dashboard.projects.set([project, remaining_project])

        assert DashboardProject.objects.filter(dashboard=dashboard, project=project).exists()

        # Delete the project to trigger the cascade
        deleted_project_id = project.id
        project.delete()

        # No entries for the dashboard project relationship with just the deleted project
        assert not DashboardProject.objects.filter(
            dashboard=dashboard, project_id=deleted_project_id
        ).exists()
        # Other dashboard still has entries for the remaining project
        assert DashboardProject.objects.filter(
            dashboard=remaining_dashboard, project=remaining_project
        ).exists()

    def test_delete_dashboard_cascade(self):
        project = self.create_project()

        dashboard = self.create_dashboard()
        remaining_dashboard = self.create_dashboard()

        dashboard.projects.set([project])
        remaining_dashboard.projects.set([project])

        assert DashboardProject.objects.filter(dashboard=dashboard, project=project).exists()

        # Delete the dashboard to trigger the cascade
        deleted_dashboard_id = dashboard.id
        dashboard.delete()

        # The deleted dashboard cascaded and deletes the dashboard-project relationship
        assert not DashboardProject.objects.filter(
            project=project, dashboard_id=deleted_dashboard_id
        ).exists()

        # The remaining dashboard still has a relationship entry
        assert DashboardProject.objects.filter(
            project=project, dashboard=remaining_dashboard
        ).exists()
