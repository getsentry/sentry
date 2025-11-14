from __future__ import annotations
from typing import int

import time
from datetime import timedelta
from unittest import mock

import pytest
from django.db.models import F
from django.utils import timezone

from sentry.models.grouprelease import GroupRelease
from sentry.models.project import Project
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.repository import Repository
from sentry.release_health.release_monitor.base import BaseReleaseMonitorBackend
from sentry.release_health.release_monitor.metrics import MetricReleaseMonitorBackend
from sentry.release_health.tasks import (
    adopt_releases,
    has_been_adopted,
    monitor_release_adoption,
    process_projects_with_sessions,
    valid_and_adopted_release,
    valid_environment,
)
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import BaseMetricsTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics


class BaseTestReleaseMonitor(TestCase, BaseMetricsTestCase):
    __test__ = Abstract(__module__, __qualname__)

    backend_class: type[BaseReleaseMonitorBackend]

    def setUp(self) -> None:
        super().setUp()
        backend = self.backend_class()
        self.backend = mock.patch("sentry.release_health.tasks.release_monitor", backend)
        self.backend.__enter__()
        # no global option mocking needed
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
                "timestamp": before_now(seconds=10).isoformat(),
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

    def tearDown(self) -> None:
        self.backend.__exit__(None, None, None)

    def test_simple(self) -> None:
        self.bulk_store_sessions([self.build_session(project_id=self.project1) for _ in range(11)])
        self.bulk_store_sessions(
            [
                self.build_session(project_id=self.project2, environment=self.environment2.name)
                for _ in range(1)
            ]
        )
        assert not self.project1.flags.has_sessions
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
        project1 = Project.objects.get(id=self.project1.id)
        assert project1.flags.has_sessions

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

    def test_simple_no_sessions(self) -> None:
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

    def test_release_is_unadopted_with_sessions(self) -> None:
        # Releases that are returned with sessions but no longer meet the threshold get unadopted
        self.bulk_store_sessions([self.build_session(project_id=self.project1) for _ in range(1)])
        self.bulk_store_sessions(
            [
                self.build_session(project_id=self.project2, environment=self.environment2)
                for _ in range(11)
            ]
        )
        self.bulk_store_sessions(
            [self.build_session(project_id=self.project1, release=self.release2) for _ in range(20)]
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

        # Make sure re-adopting works
        self.bulk_store_sessions([self.build_session(project_id=self.project1) for _ in range(50)])
        time.sleep(1)
        process_projects_with_sessions(test_data[0]["org_id"][0], test_data[0]["project_id"])
        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release_id=self.release.id,
            environment_id=self.environment.id,
            adopted=now,  # doesn't get updated, unadopted just gets set to null
            unadopted=None,
        ).exists()

    def test_release_is_unadopted_without_sessions(self) -> None:
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

    def test_multi_proj_env_release_counter(self) -> None:
        self.bulk_store_sessions(
            [
                self.build_session(
                    project_id=self.project1,
                )
                for _ in range(11)
            ]
        )
        self.bulk_store_sessions(
            [
                self.build_session(project_id=self.project2, environment=self.environment2)
                for _ in range(1)
            ]
        )
        self.bulk_store_sessions(
            [self.build_session(project_id=self.project1, release=self.release2) for _ in range(1)]
        )
        self.bulk_store_sessions(
            [self.build_session(project_id=self.project1, release=self.release3) for _ in range(1)]
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

    def test_monitor_release_adoption(self) -> None:
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
                self.build_session(
                    org_id=self.org2,
                    project_id=self.org2_project,
                    release=self.org2_release,
                    environment=self.org2_environment,
                )
                for _ in range(20)
            ]
        )
        # Tests the scheduled task to ensure it properly processes each org
        self.bulk_store_sessions(
            [
                self.build_session(
                    project_id=self.project1,
                )
                for _ in range(11)
            ]
        )
        self.bulk_store_sessions(
            [
                self.build_session(project_id=self.project2, environment=self.environment2)
                for _ in range(1)
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

    def test_missing_rpe_is_created(self) -> None:
        self.bulk_store_sessions(
            [
                self.build_session(
                    project_id=self.project1, release=self.release2, environment="somenvname"
                )
                for _ in range(20)
            ]
        )
        self.bulk_store_sessions(
            [
                self.build_session(project_id=self.project1, release=self.release2, environment="")
                for _ in range(20)
            ]
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

    def test_has_releases_is_set(self) -> None:
        no_release_project = self.create_project()
        assert not no_release_project.flags.has_releases

        self.bulk_store_sessions(
            [
                self.build_session(
                    project_id=no_release_project, release=self.release2, environment="somenvname"
                )
            ]
        )
        process_projects_with_sessions(no_release_project.organization_id, [no_release_project.id])
        no_release_project.refresh_from_db()
        assert no_release_project.flags.has_releases

    def test_no_env(self) -> None:
        no_env_project = self.create_project()
        assert not no_env_project.flags.has_releases

        # If environment is None, we shouldn't make any changes
        self.bulk_store_sessions(
            [self.build_session(project_id=no_env_project, release=self.release2, environment=None)]
        )
        process_projects_with_sessions(no_env_project.organization_id, [no_env_project.id])
        no_env_project.refresh_from_db()
        assert not no_env_project.flags.has_releases

    def test_updates_last_seen_on_health_data(self) -> None:
        # Set last_seen sufficiently in the past so it qualifies for an update (>60s old)
        past = timezone.now() - timedelta(minutes=5)
        self.rpe.update(last_seen=past)

        # Ingest a session for the same project/release/environment
        self.bulk_store_sessions(
            [
                self.build_session(
                    project_id=self.project1,
                    release=self.release,
                    environment=self.environment,
                )
            ]
        )

        before_call = timezone.now()
        # Disable flag must be False to allow updates in this test
        # Patch sampling to ensure deterministic update during test
        with (
            mock.patch("sentry.release_health.tasks.LAST_SEEN_UPDATE_SAMPLE_RATE", 1.0),
            self.options({"release-health.disable-release-last-seen-update": False}),
        ):
            process_projects_with_sessions(self.organization.id, [self.project1.id])

        updated = ReleaseProjectEnvironment.objects.get(id=self.rpe.id)
        assert updated.last_seen >= before_call


class TestMetricReleaseMonitor(BaseTestReleaseMonitor, BaseMetricsTestCase):
    backend_class = MetricReleaseMonitorBackend


class TestAdoptReleasesPath(TestMetricReleaseMonitor):
    def test_adopt_releases_respects_environment_and_threshold(self) -> None:
        # Empty environment should be ignored
        adopt_releases(
            self.organization.id,
            {self.project1.id: {"": {"releases": {"0.1": 1}, "total_sessions": 1}}},
        )

        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id, environment__name=""
        ).exists()

        # Valid env with releases meeting 10% threshold should be adopted
        adopt_releases(
            self.organization.id,
            {
                self.project1.id: {
                    "prod": {"releases": {"0.1": 1, "0.3": 9}, "total_sessions": 10}
                },
                self.project2.id: {"prod": {"releases": {"0.1": 1, "0.2": 4}, "total_sessions": 5}},
            },
        )

        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release__version="0.1",
            environment__name="prod",
            adopted__isnull=False,
        ).exists()

        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release__version="0.3",
            environment__name="prod",
            adopted__isnull=False,
        ).exists()

        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release__version="0.1",
            environment__name="prod",
            adopted__isnull=False,
        ).exists()

        assert ReleaseProjectEnvironment.objects.filter(
            project_id=self.project2.id,
            release__version="0.2",
            environment__name="prod",
            adopted__isnull=False,
        ).exists()

        # Below threshold should not adopt
        adopt_releases(
            self.organization.id,
            {self.project1.id: {"prod": {"releases": {"0.1": 1}, "total_sessions": 100}}},
        )

        assert not ReleaseProjectEnvironment.objects.filter(
            project_id=self.project1.id,
            release__version="0.1",
            environment__name="prod",
            adopted__gt=timezone.now(),
        ).exists()


def test_valid_environment() -> None:
    """A valid environment is one that has at least one session and a non-empty name."""
    assert valid_environment("production", 20)
    assert not valid_environment("", 20)
    assert not valid_environment("production", 0)


def test_valid_and_adopted_release() -> None:
    """A valid release has a valid name and at least 10% of the environment's sessions."""
    assert valid_and_adopted_release("release", 10, 100)
    assert not valid_and_adopted_release("", 10, 100)
    assert not valid_and_adopted_release("\t", 10, 100)
    assert not valid_and_adopted_release("release", 10, 101)


def test_has_been_adopted() -> None:
    """An adopted session has at least 10% of the environment's sessions."""
    assert has_been_adopted(10, 1)
    assert has_been_adopted(100, 10)
    assert has_been_adopted(1000, 100)
    assert not has_been_adopted(100, 0)
    assert not has_been_adopted(100, 1)
    assert not has_been_adopted(100, 9)
