class BaseFetchProjectsWithRecentSessionsTest:
    backend_class = None

    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.project1 = self.create_project()
        self.project2 = self.create_project()
        self.environment = self.create_environment(project=self.project2)
        self.backend = self.backend_class()

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
        results = self.backend.fetch_projects_with_recent_sessions()
        assert results == {
            self.organization.id: [self.project1.id, self.project2.id],
            self.org2.id: [self.org2_project.id],
        }


class BaseFetchProjectReleaseHealthTotalsTest:
    backend_class = None

    def setUp(self):
        self.project1 = self.create_project()
        self.project2 = self.create_project()
        self.environment1 = self.create_environment(project=self.project1)
        self.environment2 = self.create_environment(project=self.project2)
        self.release1 = self.create_release(project=self.project1)
        self.release2 = self.create_release(project=self.project2)
        self.backend = self.backend_class()

    def test(self):
        self.bulk_store_sessions(
            [
                self.build_session(
                    project_id=self.project1,
                    environment=self.environment1.name,
                    release=self.release1.version,
                )
                for _ in range(5)
            ]
            + [
                self.build_session(
                    project_id=self.project2,
                    environment=self.environment2.name,
                    release=self.release2.version,
                )
            ]
        )

        totals = self.backend.fetch_project_release_health_totals(
            self.organization.id,
            [self.project.id, self.project1.id, self.project2.id],
        )
        assert totals == {
            self.project1.id: {
                self.environment1.name: {
                    "total_sessions": 5,
                    "releases": {self.release1.version: 5},
                }
            },
            self.project2.id: {
                self.environment2.name: {
                    "total_sessions": 1,
                    "releases": {self.release2.version: 1},
                }
            },
        }, totals

    def test_no_data(self):
        totals = self.backend.fetch_project_release_health_totals(
            self.organization.id,
            [self.project.id, self.project1.id, self.project2.id],
        )
        assert totals == {}
