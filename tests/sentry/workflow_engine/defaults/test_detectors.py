from unittest.mock import patch

import pytest

from sentry.grouping.grouptype import ErrorGroupType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
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

    def test_ensure_default_detector__already_exists(self) -> None:
        project = self.create_project()
        existing = Detector.objects.filter(project=project)

        with patch("sentry.workflow_engine.defaults.detectors.locks.get") as mock_lock:
            default_detectors = ensure_default_detectors(project)
            assert {d.id for d in default_detectors.values()} == {d.id for d in existing}
            # No lock if it already exists.
            mock_lock.assert_not_called()

    def test_ensure_default_detector__lock_fails(self) -> None:
        with patch("sentry.workflow_engine.defaults.detectors.locks.get") as mock_lock:
            mock_lock.return_value.blocking_acquire.side_effect = UnableToAcquireLock
            with pytest.raises(UnableToAcquireLockApiError):
                project = self.create_project()
                ensure_default_detectors(project)

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

    def test_duplicate_detectors_raises(self) -> None:
        org = self.create_organization()
        self.create_all_projects_detector(org)
        self.create_all_projects_detector(org)

        with pytest.raises(Detector.MultipleObjectsReturned):
            ensure_default_all_projects_detector(org.id)

    def test_returns_none_when_option_disabled(self) -> None:
        result = ensure_default_organization_detectors(self.organization)
        assert result == {}
