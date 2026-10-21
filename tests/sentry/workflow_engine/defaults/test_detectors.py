import time
from datetime import timedelta
from threading import Event
from unittest.mock import patch

import pytest
from django.db import connections, router, transaction
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.project import Project
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.locking import UnableToAcquireLock
from sentry.workflow_engine.defaults.detectors import (
    UnableToAcquireLockApiError,
    ensure_default_all_projects_detector,
    ensure_default_detectors,
    ensure_default_organization_detectors,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.types import (
    ALL_PROJECTS_DETECTOR_NAME,
    ERROR_DETECTOR_NAME,
    ISSUE_STREAM_DETECTOR_NAME,
)
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


class TestEnsureDefaultDetectors(TestCase):
    def setUp(self) -> None:
        self.slugs = [ErrorGroupType.slug, IssueStreamGroupType.slug]
        self.names = [ERROR_DETECTOR_NAME, ISSUE_STREAM_DETECTOR_NAME]

    def test_ensure_default_detector(self) -> None:
        project = self.create_project()
        detectors = ensure_default_detectors(project)

        error_detector = detectors[ErrorGroupType.slug]
        assert error_detector.name == ERROR_DETECTOR_NAME
        assert error_detector.project_id == project.id
        assert error_detector.type == ErrorGroupType.slug

        issue_stream_detector = detectors[IssueStreamGroupType.slug]
        assert issue_stream_detector.name == ISSUE_STREAM_DETECTOR_NAME
        assert issue_stream_detector.project_id == project.id
        assert issue_stream_detector.type == IssueStreamGroupType.slug

    def _project_row_locks(self, queries: CaptureQueriesContext) -> list[str]:
        return [
            q["sql"]
            for q in queries.captured_queries
            if 'FROM "sentry_project"' in q["sql"] and "FOR NO KEY UPDATE" in q["sql"]
        ]

    def test_ensure_default_detector__already_exists(self) -> None:
        project = self.create_project()
        existing = Detector.objects.filter(project=project)

        with CaptureQueriesContext(connections[router.db_for_write(Project)]) as queries:
            default_detectors = ensure_default_detectors(project)
        assert {d.id for d in default_detectors.values()} == {d.id for d in existing}
        # No lock if it already exists.
        assert self._project_row_locks(queries) == []

    def test_ensure_default_detector__locks_project_row(self) -> None:
        project = self.create_project(create_default_detectors=False)

        with CaptureQueriesContext(connections[router.db_for_write(Project)]) as queries:
            ensure_default_detectors(project)

        # One row lock for each detector that is created.
        assert len(self._project_row_locks(queries)) == len(self.slugs)
        assert set(Detector.objects.filter(project=project).values_list("type", flat=True)) == set(
            self.slugs
        )

    def test_ensure_default_detector__does_not_duplicate(self) -> None:
        project = self.create_project(create_default_detectors=False)

        first = ensure_default_detectors(project)
        second = ensure_default_detectors(project)

        assert {d.id for d in first.values()} == {d.id for d in second.values()}
        assert Detector.objects.filter(project=project).count() == len(self.slugs)

    def test_project_create_in_transaction_creates_detectors(self) -> None:
        organization = self.create_organization()
        with transaction.atomic(router.db_for_write(Project)):
            project = Project.objects.create(organization=organization, name="Detectors")

        assert set(Detector.objects.filter(project=project).values_list("type", flat=True)) == set(
            self.slugs
        )

    @override_options({"workflow_engine.auto_creation.all_projects_detector": True})
    def test_ensure_default_organization_detectors_creates_all_projects(self) -> None:
        ensure_default_organization_detectors(self.organization)

        all_projects = Detector.objects.filter(
            type=IssueStreamGroupType.slug,
            name=ALL_PROJECTS_DETECTOR_NAME,
            project__isnull=True,
            config__organization_id=self.organization.id,
        )
        assert all_projects.count() == 1

    def test_ensure_default_detectors_does_not_create_all_projects(self) -> None:
        project = self.create_project()
        ensure_default_detectors(project)

        assert not Detector.objects.filter(
            type=IssueStreamGroupType.slug, project__isnull=True
        ).exists()


class TestEnsureDefaultDetectorsConcurrency(TransactionTestCase):
    def test_concurrent_caller_waits_for_detectors(self) -> None:
        project = self.create_project(create_default_detectors=False)
        db = router.db_for_write(Project)
        worker_pid: list[int] = []
        started = Event()

        def ensure_in_other_connection() -> dict[str, Detector]:
            try:
                with connections[db].cursor() as cursor:
                    cursor.execute("SELECT pg_backend_pid()")
                    worker_pid.append(cursor.fetchone()[0])
                started.set()
                return ensure_default_detectors(project)
            finally:
                connections.close_all()

        with ContextPropagatingThreadPoolExecutor(max_workers=1) as executor:
            with transaction.atomic(db):
                first = ensure_default_detectors(project)
                future = executor.submit(ensure_in_other_connection)
                assert started.wait(timeout=10)
                # The other caller cannot see our detectors before we commit, so it
                # must wait on the project row lock.
                self._wait_for_lock_wait(db, worker_pid[0])

            second = future.result(timeout=10)

        assert {d.id for d in first.values()} == {d.id for d in second.values()}
        assert Detector.objects.filter(project=project).count() == 2

    def _wait_for_lock_wait(self, db: str, pid: int) -> None:
        deadline = time.monotonic() + 10
        with connections[db].cursor() as cursor:
            while time.monotonic() < deadline:
                cursor.execute("SELECT 1 FROM pg_locks WHERE pid = %s AND NOT granted", [pid])
                if cursor.fetchone():
                    return
                time.sleep(0.05)
        raise AssertionError(f"Connection {pid} did not wait on a lock")


class TestEnsureDefaultAllProjectsDetector(TestCase):
    def test_creates_detector(self) -> None:
        org = self.create_organization()
        detector = ensure_default_all_projects_detector(org.id)

        assert detector.type == IssueStreamGroupType.slug
        assert detector.project is None
        assert detector.config == {"organization_id": org.id}
        assert detector.name == ALL_PROJECTS_DETECTOR_NAME
        assert detector.enabled is True

    def test_idempotent(self) -> None:
        org = self.create_organization()
        first = ensure_default_all_projects_detector(org.id)
        second = ensure_default_all_projects_detector(org.id)
        assert first.id == second.id
        assert (
            Detector.objects.filter(
                type=IssueStreamGroupType.slug,
                project__isnull=True,
                config__organization_id=org.id,
            ).count()
            == 1
        )

    def test_separate_orgs(self) -> None:
        org1 = self.create_organization()
        org2 = self.create_organization()
        d1 = ensure_default_all_projects_detector(org1.id)
        d2 = ensure_default_all_projects_detector(org2.id)
        assert d1.id != d2.id
        assert d1.config["organization_id"] == org1.id
        assert d2.config["organization_id"] == org2.id

    def test_lock_failure(self) -> None:
        with patch("sentry.workflow_engine.defaults.detectors.locks.get") as mock_lock:
            mock_lock.return_value.blocking_acquire.side_effect = UnableToAcquireLock
            with pytest.raises(UnableToAcquireLockApiError):
                ensure_default_all_projects_detector(self.organization.id)

    def test_duplicate_detectors_are_handled(self) -> None:
        org = self.create_organization()
        with freeze_time(timezone.now() - timedelta(hours=2)):
            first = self.create_all_projects_detector(org)
        with freeze_time(timezone.now() - timedelta(hours=1)):
            _second = self.create_all_projects_detector(org)
        with freeze_time(timezone.now()):
            _third = self.create_all_projects_detector(org)

        result = ensure_default_all_projects_detector(org.id)
        assert result.id == first.id

    def test_returns_none_when_option_disabled(self) -> None:
        result = ensure_default_organization_detectors(self.organization)
        assert result == {}
