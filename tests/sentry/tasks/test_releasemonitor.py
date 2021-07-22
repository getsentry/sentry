import time
from uuid import uuid4

from django.db.models import F
from django.utils import timezone

from sentry.models import GroupRelease, Project, ReleaseProjectEnvironment, Repository
from sentry.tasks.releasemonitor import monitor_release_adoption, process_projects_with_sessions
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class TestReleaseMonitor(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.project1 = self.create_project()
        self.project2 = self.create_project()

        self.project1.update(flags=F("flags").bitor(Project.flags.has_releases))
        self.project2.update(flags=F("flags").bitor(Project.flags.has_releases))

        self.repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )
        self.release = self.create_release(project=self.project, version="foo@1.0.0")
        self.release2 = self.create_release(project=self.project, version="foo@2.0.0")
        self.release3 = self.create_release(project=self.project2, version="bar@1.0.0")
        self.environment = self.create_environment(name="prod", project=self.project1)
        self.environment2 = self.create_environment(name="canary", project=self.project2)
        self.group = self.create_group(
            project=self.project, message="Kaboom!", first_release=self.release
        )
        self.rpe = ReleaseProjectEnvironment.objects.create(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
        )
        self.rpe1 = ReleaseProjectEnvironment.objects.create(
            project_id=self.project1.id,
            release_id=self.release2.id,
            environment_id=self.environment.id,
        )
        self.rpe2 = ReleaseProjectEnvironment.objects.create(
            project_id=self.project1.id,
            release_id=self.release3.id,
            environment_id=self.environment.id,
        )
        self.rpe3 = ReleaseProjectEnvironment.objects.create(
            project_id=self.project2.id,
            release_id=self.release.id,
            environment_id=self.environment2.id,
        )
        GroupRelease.objects.create(
            group_id=self.group.id, release_id=self.release.id, project_id=self.project.id
        )

        self.event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": iso_format(before_now(seconds=10)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "handle_set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": True,
                            "lineno": 30,
                            "filename": "sentry/tasks.py",
                        },
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/release.py",
                        },
                    ]
                },
                "tags": {"sentry:release": self.release.version},
                "fingerprint": ["finterpring"],
            },
            project_id=self.project.id,
        )
        GroupRelease.objects.create(
            group_id=self.event.group.id, project_id=self.project.id, release_id=self.release.id
        )

    def session_dict(self, i, project, release_version, environment_name):
        received = time.time()
        session_started = received // 60 * 60
        return dict(
            distinct_id=uuid4().hex,
            session_id=uuid4().hex,
            org_id=project.organization_id,
            project_id=project.id,
            status="ok",
            seq=0,
            release=release_version,
            environment=environment_name,
            retention_days=90,
            duration=None,
            errors=0,
            started=session_started,
            received=received,
        )

    def test_simple(self):
        self.bulk_store_sessions(
            [
                self.session_dict(
                    i,
                    self.project1,
                    self.release.version,
                    self.environment.name,
                )
                for i in range(11)
            ]
        )
        self.bulk_store_sessions(
            [
                self.session_dict(i, self.project2, self.release.version, self.environment2.name)
                for i in range(1)
            ]
        )
        now = timezone.now()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=None,
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release_id=self.release.id,
            environment_id=self.environment2.id,
            adopted=None,
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted__gte=now,
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release_id=self.release.id,
            environment_id=self.environment2.id,
            adopted__gte=now,
        ).exists()

        test_data = [
            {
                "org_id": [self.organization.id],
                "project_id": [self.project2.id, self.project1.id],
            },
        ]
        process_projects_with_sessions(test_data[0]["org_id"][0], test_data[0]["project_id"])

        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=None,
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted__gte=now,
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release_id=self.release.id,
            environment_id=self.environment2.id,
            adopted__gte=now,
        ).exists()

    def test_simple_no_sessions(self):
        now = timezone.now()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=None,
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release_id=self.release.id,
            environment_id=self.environment2.id,
            adopted=None,
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted__gte=now,
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release_id=self.release.id,
            environment_id=self.environment2.id,
            adopted__gte=now,
        ).exists()

        test_data = [
            {
                "org_id": [self.organization.id],
                "project_id": [self.project2.id, self.project1.id],
            },
        ]
        process_projects_with_sessions(test_data[0]["org_id"][0], test_data[0]["project_id"])

        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=None,
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release_id=self.release.id,
            environment_id=self.environment2.id,
            adopted=None,
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted__gte=now,
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release_id=self.release.id,
            environment_id=self.environment2.id,
            adopted__gte=now,
        ).exists()

    def test_release_is_unadopted_with_sessions(self):
        # Releases that are returned with sessions but no longer meet the threshold get unadopted
        self.bulk_store_sessions(
            [
                self.session_dict(
                    i,
                    self.project1,
                    self.release.version,
                    self.environment.name,
                )
                for i in range(1)
            ]
        )
        self.bulk_store_sessions(
            [
                self.session_dict(i, self.project2, self.release.version, self.environment2.name)
                for i in range(11)
            ]
        )
        self.bulk_store_sessions(
            [
                self.session_dict(i, self.project1, self.release2.version, self.environment.name)
                for i in range(20)
            ]
        )
        now = timezone.now()
        self.rpe.update(adopted=now)
        self.rpe1.update(adopted=now)
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=now,
            unadopted=None,
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release2.id,
            environment_id=self.environment.id,
            adopted=now,
            unadopted=None,
        ).exists()
        test_data = [
            {
                "org_id": [self.organization.id],
                "project_id": [self.project2.id, self.project1.id],
            },
        ]
        process_projects_with_sessions(test_data[0]["org_id"][0], test_data[0]["project_id"])
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=now,
            unadopted__gte=now,
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release2.id,
            environment_id=self.environment.id,
            adopted=now,
            unadopted__gte=now,
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release_id=self.release.id,
            environment_id=self.environment2.id,
            adopted=now,
            unadopted__gte=now,
        ).exists()

    def test_release_is_unadopted_without_sessions(self):
        # This test should verify that releases that have no sessions (i.e. no result from snuba)
        # get marked as unadopted
        now = timezone.now()
        self.rpe.update(adopted=now)
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=now,
            unadopted=None,
        ).exists()
        test_data = [
            {
                "org_id": [self.organization.id],
                "project_id": [self.project2.id, self.project1.id],
            },
        ]
        process_projects_with_sessions(test_data[0]["org_id"][0], test_data[0]["project_id"])

        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=now,
            unadopted__gte=now,
        ).exists()

    def test_multi_proj_env_release_counter(self):
        self.bulk_store_sessions(
            [
                self.session_dict(
                    i,
                    self.project1,
                    self.release.version,
                    self.environment.name,
                )
                for i in range(11)
            ]
        )
        self.bulk_store_sessions(
            [
                self.session_dict(i, self.project2, self.release.version, self.environment2.name)
                for i in range(1)
            ]
        )
        self.bulk_store_sessions(
            [
                self.session_dict(i, self.project1, self.release2.version, self.environment.name)
                for i in range(1)
            ]
        )
        self.bulk_store_sessions(
            [
                self.session_dict(i, self.project1, self.release3.version, self.environment.name)
                for i in range(1)
            ]
        )
        now = timezone.now()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=None,
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release_id=self.release.id,
            environment_id=self.environment2.id,
            adopted=None,
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted__gte=now,
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release_id=self.release.id,
            environment_id=self.environment2.id,
            adopted__gte=now,
        ).exists()

        test_data = [
            {
                "org_id": [self.organization.id],
                "project_id": [self.project2.id, self.project1.id],
            },
        ]
        process_projects_with_sessions(test_data[0]["org_id"][0], test_data[0]["project_id"])

        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=None,
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted__gte=now,
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release_id=self.release.id,
            environment_id=self.environment2.id,
            adopted__gte=now,
        ).exists()

    def test_monitor_release_adoption(self):
        now = timezone.now()
        self.org2 = self.create_organization(
            name="Yet Another Test Org",
            owner=self.user,
        )
        self.org2_project = self.create_project(organization=self.org2)
        self.org2_project.update(flags=F("flags").bitor(Project.flags.has_releases))
        self.org2_release = self.create_release(project=self.org2_project, version="org@2.0.0")
        self.org2_environment = self.create_environment(name="yae", project=self.org2_project)
        self.org2_rpe = ReleaseProjectEnvironment.objects.create(
            project_id=self.org2_project.id,
            release_id=self.org2_release.id,
            environment_id=self.org2_environment.id,
        )
        self.bulk_store_sessions(
            [
                self.session_dict(
                    i,
                    self.org2_project,
                    self.org2_release.version,
                    self.org2_environment.name,
                )
                for i in range(20)
            ]
        )
        # Tests the scheduled task to ensure it properly processes each org
        self.bulk_store_sessions(
            [
                self.session_dict(
                    i,
                    self.project1,
                    self.release.version,
                    self.environment.name,
                )
                for i in range(11)
            ]
        )
        self.bulk_store_sessions(
            [
                self.session_dict(i, self.project2, self.release.version, self.environment2.name)
                for i in range(1)
            ]
        )

        with self.tasks():
            monitor_release_adoption()

        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted__gte=now,
            unadopted=None,
        ).exists()

        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.org2_project.id,
            release_id=self.org2_release.id,
            environment_id=self.org2_environment.id,
            adopted__gte=now,
            unadopted=None,
        ).exists()

    def test_missing_rpe_is_created(self):
        self.bulk_store_sessions(
            [
                self.session_dict(i, self.project1, self.release2.version, "somenvname")
                for i in range(20)
            ]
        )
        self.bulk_store_sessions(
            [self.session_dict(i, self.project1, self.release2.version, "") for i in range(20)]
        )
        now = timezone.now()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment__name="somenvname",
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release2.id,
            environment__name="",
        ).exists()

        test_data = [
            {
                "org_id": [self.organization.id],
                "project_id": [self.project2.id, self.project1.id],
            },
        ]
        # This will make the appropriate models (Environment, ReleaseProject, ReleaseEnvironment and ReleaseProjectEnvironment)
        process_projects_with_sessions(test_data[0]["org_id"][0], test_data[0]["project_id"])
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release2.id,
            environment__name="somenvname",
            adopted__gte=now,
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release2.id,
            environment__name="",
        ).exists()
