from unittest.mock import patch

from sentry.models.rule import Rule
from sentry.tasks.check_new_issue_threshold_met import (
    NEW_ISSUE_WEEKLY_THRESHOLD,
    calculate_threshold_met,
    check_new_issue_threshold_met,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class CheckNewIssueThresholdMetTest(TestCase):
    def setUp(self):
        self.rule = Rule.objects.create(
            project=self.project,
            label="my rule",
            data={
                "conditions": [
                    {"id": "sentry.rules.conditions.high_priority_issue.HighPriorityIssueCondition"}
                ]
            },
        )

    def test_task_persistent_name(self):
        assert check_new_issue_threshold_met.name == "sentry.tasks.check_new_issue_threshold_met"

    def test_threshold_not_met(self):
        assert "new_issue_threshold_met" not in self.rule.data
        check_new_issue_threshold_met(self.project.id)
        self.rule.refresh_from_db()

        assert "new_issue_threshold_met" not in self.rule.data

    @patch("sentry.tasks.check_new_issue_threshold_met.calculate_threshold_met")
    def test_with_no_high_priority_rules(self, mock_calculate):
        Rule.objects.all().delete()

        check_new_issue_threshold_met(self.project.id)
        assert mock_calculate.call_count == 0

    @patch("sentry.tasks.check_new_issue_threshold_met.calculate_threshold_met")
    def test_threshold_already_met(self, mock_calculate):
        self.rule.data["new_issue_threshold_met"] = True
        self.rule.save()
        check_new_issue_threshold_met(self.project.id)

        self.rule.refresh_from_db()

        assert mock_calculate.call_count == 0
        assert self.rule.data["new_issue_threshold_met"]

    def test_threshold_met_for_some_rules(self):
        assert "new_issue_threshold_met" not in self.rule.data
        rule = Rule.objects.create(
            project=self.project,
            label="my rule 2",
            data={
                "conditions": [
                    {"id": "sentry.rules.conditions.high_priority_issue.HighPriorityIssueCondition"}
                ],
                "new_issue_threshold_met": True,
            },
        )

        check_new_issue_threshold_met(self.project.id)

        self.rule.refresh_from_db()
        rule.refresh_from_db()

        assert self.rule.data["new_issue_threshold_met"]
        assert rule.data["new_issue_threshold_met"]

    @patch("sentry.tasks.check_new_issue_threshold_met.calculate_threshold_met", return_value=True)
    def test_threshold_newly_met(self, mock_calculate):
        assert "new_issue_threshold_met" not in self.rule.data
        check_new_issue_threshold_met(self.project.id)

        self.rule.refresh_from_db()

        assert self.rule.data["new_issue_threshold_met"]


class CalculateThresholdMetTest(TestCase):
    def test_threshold_not_met(self):
        assert not calculate_threshold_met(self.project.id)

    def test_threshold_met_condition_1(self):
        for weeks in range(3):
            for i in range(NEW_ISSUE_WEEKLY_THRESHOLD):
                self.store_event(
                    data={
                        "fingerprint": [f"group-{weeks}-{i}"],
                        "timestamp": iso_format(before_now(days=7 * weeks)),
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
                        "timestamp": iso_format(before_now(days=7 * weeks)),
                    },
                    project_id=self.project.id,
                )

        assert calculate_threshold_met(self.project.id)
