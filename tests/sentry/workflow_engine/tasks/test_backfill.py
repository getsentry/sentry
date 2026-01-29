from unittest.mock import MagicMock, patch

from sentry.grouping.grouptype import ErrorGroupType
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DetectorGroup
from sentry.workflow_engine.tasks.backfill import backfill_error_detector_groups


class BackfillErrorDetectorGroupsTest(TestCase):
    @patch("sentry.workflow_engine.processors.backfill.backfill_project_range")
    def test_calls_processor_function(self, mock_backfill: MagicMock) -> None:
        min_id = 100
        max_id = 200

        backfill_error_detector_groups(min_id, max_id)

        mock_backfill.assert_called_once_with(min_id, max_id)

    def test_integration_processes_projects(self) -> None:
        project1 = self.create_project()
        project2 = self.create_project()

        detector1 = self.create_detector(project=project1, type=ErrorGroupType.slug)
        detector2 = self.create_detector(project=project2, type=ErrorGroupType.slug)

        self.create_group(project=project1, type=ErrorGroupType.type_id)
        self.create_group(project=project2, type=ErrorGroupType.type_id)

        min_id = min(project1.id, project2.id)
        max_id = max(project1.id, project2.id)

        backfill_error_detector_groups(min_id, max_id)

        assert DetectorGroup.objects.filter(detector=detector1).exists()
        assert DetectorGroup.objects.filter(detector=detector2).exists()
