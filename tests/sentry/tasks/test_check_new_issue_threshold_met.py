from unittest.mock import patch

from sentry.tasks.check_new_issue_threshold_met import (
    NEW_ISSUE_WEEKLY_THRESHOLD,
    calculate_threshold_met,
    check_new_issue_threshold_met,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now


class CheckNewIssueThresholdMetTest(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.project.flags.has_high_priority_alerts = False
        self.project.save()

    @patch("sentry.tasks.check_new_issue_threshold_met.calculate_threshold_met", return_value=False)
    def test_threshold_not_met(self, mock_calculate):
        assert not self.project.flags.has_high_priority_alerts

        check_new_issue_threshold_met(self.project.id)
        self.project.refresh_from_db()

        assert mock_calculate.call_count == 1
        assert not self.project.flags.has_high_priority_alerts

    @patch("sentry.tasks.check_new_issue_threshold_met.calculate_threshold_met")
    def test_threshold_already_met(self, mock_calculate):
        self.project.flags.has_high_priority_alerts = True
        self.project.save()

        check_new_issue_threshold_met(self.project.id)

        self.project.refresh_from_db()

        assert mock_calculate.call_count == 0
        assert self.project.flags.has_high_priority_alerts

    @patch("sentry.tasks.check_new_issue_threshold_met.calculate_threshold_met", return_value=True)
    def test_threshold_newly_met(self, mock_calculate):
        assert not self.project.flags.has_high_priority_alerts
        check_new_issue_threshold_met(self.project.id)

        self.project.refresh_from_db()

        assert mock_calculate.call_count == 1
        assert self.project.flags.has_high_priority_alerts


class CalculateThresholdMetTest(TestCase):
    def test_threshold_not_met(self):
        assert not calculate_threshold_met(self.project.id)

    def test_threshold_met_condition_1(self):
        for weeks in range(3):
            for i in range(NEW_ISSUE_WEEKLY_THRESHOLD):
                self.store_event(
                    data={
                        "fingerprint": [f"group-{weeks}-{i}"],
                        "timestamp": before_now(days=7 * weeks).isoformat(),
                    },
                    project_id=self.project.id,
                )

        assert calculate_threshold_met(self.project.id)

    def test_threshold_met_condition_2(self):
        for weeks in range(2):
            for i in range(2 * NEW_ISSUE_WEEKLY_THRESHOLD):
                self.store_event(
                    data={
                        "fingerprint": [f"group-{weeks}-{i}"],
                        "timestamp": before_now(days=7 * weeks).isoformat(),
                    },
                    project_id=self.project.id,
                )

        assert calculate_threshold_met(self.project.id)
