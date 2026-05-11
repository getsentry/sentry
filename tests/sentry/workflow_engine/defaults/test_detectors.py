from unittest.mock import patch

import pytest

from sentry.grouping.grouptype import ErrorGroupType
from sentry.testutils.cases import TestCase
from sentry.utils.locking import UnableToAcquireLock
from sentry.workflow_engine.defaults.detectors import (
    UnableToAcquireLockApiError,
    ensure_default_detectors,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.types import ERROR_DETECTOR_NAME, ISSUE_STREAM_DETECTOR_NAME
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
