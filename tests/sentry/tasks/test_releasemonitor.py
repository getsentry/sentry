import time
from uuid import uuid4

from django.db.models import F
from django.utils import timezone

from sentry.models import GroupRelease, Project, ReleaseProjectEnvironment, Repository
from sentry.tasks.releasemonitor import process_projects_with_sessions
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class TestReleaseMonitor(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.project_with_session_data = self.create_project()
        self.project2 = self.create_project()

        self.project_with_session_data.update(flags=F("flags").bitor(Project.flags.has_releases))
        self.project2.update(flags=F("flags").bitor(Project.flags.has_releases))

        self.repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )
        self.release = self.create_release(project=self.project, version="foo@1.0.0")
        self.environment = self.create_environment(
            name="prod", project=self.project_with_session_data
        )
        self.environment2 = self.create_environment(name="canary", project=self.project2)
        self.group = self.create_group(
            project=self.project, message="Kaboom!", first_release=self.release
        )
        self.rpe = ReleaseProjectEnvironment.objects.create(
            project_id=self.project_with_session_data.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
        )
        self.rpe2 = ReleaseProjectEnvironment.objects.create(
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

    def session_dict(self, i, project_id, release_version, environment_name):
        received = time.time()
        session_started = received // 60 * 60
        return dict(
            distinct_id=uuid4().hex,
            session_id=uuid4().hex,
            org_id=self.project.organization_id,
            project_id=project_id,
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
                    self.project_with_session_data.id,
                    self.release.version,
                    self.environment.name,
                )
                for i in range(11)
            ]
        )
        self.bulk_store_sessions(
            [
                self.session_dict(i, self.project2.id, self.release.version, self.environment2.name)
                for i in range(1)
            ]
        )
        now = timezone.now()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project_with_session_data.id,
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
            project_id=self.project_with_session_data.id,
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
                "project_id": [self.project2.id, self.project_with_session_data.id],
            },
        ]
        process_projects_with_sessions(test_data)

        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project_with_session_data.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=None,
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project_with_session_data.id,
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

    def test_simple_no_sessions(self):
        now = timezone.now()
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project_with_session_data.id,
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
            project_id=self.project_with_session_data.id,
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
                "project_id": [self.project2.id, self.project_with_session_data.id],
            },
        ]
        process_projects_with_sessions(test_data)

        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project_with_session_data.id,
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
            project_id=self.project_with_session_data.id,
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
                    self.project_with_session_data.id,
                    self.release.version,
                    self.environment.name,
                )
                for i in range(1)
            ]
        )
        self.bulk_store_sessions(
            [
                self.session_dict(i, self.project2.id, self.release.version, self.environment2.name)
                for i in range(11)
            ]
        )
        now = timezone.now()
        self.rpe.update(adopted=now)
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project_with_session_data.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=now,
            unadopted=None,
        ).exists()
        test_data = [
            {
                "org_id": [self.organization.id],
                "project_id": [self.project2.id, self.project_with_session_data.id],
            },
        ]
        process_projects_with_sessions(test_data)
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project_with_session_data.id,
            release_id=self.release.id,
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

    # def test_release_is_unadopted_without_sessions(self):
    # TODO: This isn't supported yet because I haven't implemented step 4
    # This test should verify that releases that have no sessions (i.e. no result from snuba)
    # get marked as unadopted
    #     now = timezone.now()
    #     self.rpe.update(adopted=now)
    #     assert ReleaseProjectEnvironment.objects.filter(
    #         project_id=self.project_with_session_data.id,
    #         release_id=self.release.id,
    #         environment_id=self.environment.id,
    #         adopted=now,
    #         unadopted=None
    #     ).exists()
    #     test_data = [
    # {
    # "org_id":self.organization.id,
    # "project_id":[self.project2.id,self.project_with_session_data.id]
    # },
    # ]
    # process_projects_with_sessions(test_data)
    #     assert ReleaseProjectEnvironment.objects.filter(
    #         project_id=self.project_with_session_data.id,
    #         release_id=self.release.id,
    #         environment_id=self.environment.id,
    #         adopted=now,
    #         unadopted__gte=now
    #     ).exists()

    # # def test_multi_org(self):
    #     # TODO: Implement a multi-org test
    #     # pass
