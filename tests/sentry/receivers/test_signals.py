from unittest.mock import patch

from django.utils import timezone

from sentry.signals import issue_mark_reviewed, issue_unignored, issue_update_priority
from sentry.testutils.cases import SnubaTestCase, TestCase


class SignalsTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.now = timezone.now()
        self.owner = self.create_user()
        self.organization = self.create_organization(owner=self.owner)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(teams=[self.team])

    @patch("sentry.analytics.record")
    def test_unignored_manually(self, mock_record):
        issue_unignored.send(
            project=self.project,
            group=self.group,
            user_id=self.owner.id,
            transition_type="manual",
            sender=type(self.project),
        )
        assert mock_record.called

    @patch("sentry.analytics.record")
    def test_unignored_automatically(self, mock_record):
        issue_unignored.send(
            project=self.project,
            group=self.group,
            user_id=None,
            transition_type="automatic",
            sender="clear_expired_snoozes",
        )
        assert mock_record.called

    @patch("sentry.analytics.record")
    def test_mark_reviewed(self, mock_record):
        issue_mark_reviewed.send(
            project=self.project, group=self.group, user=None, sender="test_mark_reviewed"
        )
        assert mock_record.called

    @patch("sentry.analytics.record")
    def test_update_priority(self, mock_record):
        issue_update_priority.send(
            project=self.project,
            group=self.group,
            new_priority="high",
            previous_priority="low",
            user_id=2,
            sender="test_update_priority",
            reason="reason",
        )
        mock_record.assert_called_once_with(
            "issue.update_priority",
            group_id=self.group.id,
            new_priority="high",
            organization_id=self.organization.id,
            project_id=self.project.id,
            user_id=2,
            previous_priority="low",
            reason="reason",
            issue_category="error",
            issue_type="error",
        )
