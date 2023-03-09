from unittest.mock import patch

from django.utils import timezone

from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox
from sentry.signals import inbox_in, inbox_out, issue_mark_reviewed, issue_unignored
from sentry.testutils import SnubaTestCase, TestCase


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
    def test_inbox_in(self, mock_record):
        inbox_in.send(
            project=self.project,
            group=self.group,
            user=None,
            sender="test_inbox_in",
            reason="new",
        )
        assert mock_record.called

    @patch("sentry.analytics.record")
    def test_inbox_out(self, mock_record):
        group_inbox = add_group_to_inbox(self.group, reason=GroupInboxReason.NEW)
        inbox_out.send(
            project=self.project,
            group=self.group,
            user=self.owner,
            sender="test_inbox_out",
            action="mark_reviewed",
            inbox_date_added=group_inbox.date_added,
            referrer="https://sentry.io/inbox",
        )
        assert mock_record.called
