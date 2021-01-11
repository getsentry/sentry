from __future__ import absolute_import

from django.utils import timezone

from sentry.signals import issue_unignored, issue_mark_reviewed, inbox_in
from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils.compat.mock import patch


class SignalsTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(SignalsTest, self).setUp()
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
            user=self.owner,
            transition_type="manual",
            sender=type(self.project),
        )
        assert mock_record.called

    @patch("sentry.analytics.record")
    def test_unignored_automatically(self, mock_record):
        issue_unignored.send(
            project=self.project,
            group=self.group,
            user=None,
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
            sender="test_mark_reviewed",
            reason="new",
        )
        assert mock_record.called
