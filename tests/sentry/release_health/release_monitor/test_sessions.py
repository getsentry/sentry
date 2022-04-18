from sentry.release_health import release_monitor
from sentry.testutils import SnubaTestCase, TestCase


class TestFetchProjectsWithRecentSessions(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.project1 = self.create_project()
        self.project2 = self.create_project()
        self.environment = self.create_environment(project=self.project2)

    def test_monitor_release_adoption(self):
        self.org2 = self.create_organization()
        self.org2_project = self.create_project(organization=self.org2)
        self.org2_release = self.create_release(project=self.org2_project, version="org@2.0.0")
        self.org2_environment = self.create_environment(project=self.org2_project)
        self.bulk_store_sessions(
            [
                self.build_session(
                    org_id=self.org2,
                    project_id=self.org2_project,
                    release=self.org2_release,
                    environment=self.org2_environment,
                )
                for _ in range(2)
            ]
            + [self.build_session(project_id=self.project1) for _ in range(3)]
            + [
                self.build_session(project_id=self.project2, environment=self.environment)
                for _ in range(1)
            ]
        )
        results = release_monitor.fetch_projects_with_recent_sessions()
        assert results == {
            self.organization.id: [self.project1.id, self.project2.id],
            self.org2.id: [self.org2_project.id],
        }
