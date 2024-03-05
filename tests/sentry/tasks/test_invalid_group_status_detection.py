from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.tasks.invalid_group_status_detection import detect_invalid_group_status
from sentry.testutils.cases import TestCase
from sentry.types.group import GroupSubStatus


@patch("sentry.tasks.invalid_group_status_detection.SAMPLE_SIZE", 4)
class DetectInvalidGroupStatusTest(TestCase):
    def setUp(self):
        self.ongoing_group = self.create_group(substatus=GroupSubStatus.ONGOING)
        self.new_group = self.create_group(substatus=GroupSubStatus.NEW)

        self.regressed_group = self.create_group(substatus=GroupSubStatus.REGRESSED)
        self.regressed_grouphistory = GroupHistory.objects.create(
            group=self.regressed_group,
            status=GroupHistoryStatus.REGRESSED,
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

        self.escalating_group = self.create_group(substatus=GroupSubStatus.ESCALATING)
        self.escalating_grouphistory = GroupHistory.objects.create(
            group=self.escalating_group,
            status=GroupHistoryStatus.ESCALATING,
            organization_id=self.organization.id,
            project_id=self.project.id,
        )

    @patch("sentry.tasks.invalid_group_status_detection.logger.error")
    def test_no_bad_groups(self, mock_logger):
        detect_invalid_group_status()
        assert not mock_logger.called

    @patch("sentry.tasks.invalid_group_status_detection.logger.error")
    def test_bad_new_group(self, mock_logger):
        self.new_group.update(
            first_seen=datetime.now(tz=timezone.utc) - timedelta(days=8),
            substatus=GroupSubStatus.NEW,
        )
        detect_invalid_group_status()
        assert mock_logger.called
        assert mock_logger.call_args[0][0] == "Found groups with incorrect substatus"
        assert mock_logger.call_args.kwargs["extra"]["count"] == 1
        assert mock_logger.call_args.kwargs["extra"]["new"] == [self.new_group.id]

    @patch("sentry.tasks.invalid_group_status_detection.logger.error")
    def test_bad_regressed_group(self, mock_logger):
        self.regressed_grouphistory.update(
            date_added=datetime.now(tz=timezone.utc) - timedelta(days=8),
        )
        detect_invalid_group_status()
        assert mock_logger.called
        assert mock_logger.call_args.kwargs["extra"]["count"] == 1
        assert mock_logger.call_args.kwargs["extra"]["regressed"] == [self.regressed_group.id]

    @patch("sentry.tasks.invalid_group_status_detection.logger.error")
    def test_bad_escalating_group(self, mock_logger):
        self.escalating_grouphistory.update(
            date_added=datetime.now(tz=timezone.utc) - timedelta(days=8),
        )
        detect_invalid_group_status()
        assert mock_logger.called
        assert mock_logger.call_args.kwargs["extra"]["count"] == 1
        assert mock_logger.call_args.kwargs["extra"]["escalating"] == [self.escalating_group.id]

    @patch("sentry.tasks.invalid_group_status_detection.logger.error")
    def test_multiple_bad_groups(self, mock_logger):
        self.new_group.update(
            first_seen=datetime.now(tz=timezone.utc) - timedelta(days=8),
            substatus=GroupSubStatus.NEW,
        )
        self.escalating_grouphistory.update(
            date_added=datetime.now(tz=timezone.utc) - timedelta(days=8),
        )
        detect_invalid_group_status()
        assert mock_logger.called
        assert mock_logger.call_args.kwargs["extra"]["count"] == 2
        assert mock_logger.call_args.kwargs["extra"]["new"] == [self.new_group.id]
        assert mock_logger.call_args.kwargs["extra"]["escalating"] == [self.escalating_group.id]

    @patch("sentry.tasks.invalid_group_status_detection.logger.error")
    def test_unsupported_status(self, mock_logger):
        bad_group = self.create_group()
        bad_group.update(
            status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.UNTIL_CONDITION_MET
        )
        detect_invalid_group_status()
        assert mock_logger.called
        assert mock_logger.call_args.kwargs["extra"]["count"] == 1
        assert mock_logger.call_args.kwargs["extra"]["archived_until_condition_met"] == [
            bad_group.id
        ]
