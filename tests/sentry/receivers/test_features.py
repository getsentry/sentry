from __future__ import absolute_import

from django.utils import timezone

from sentry.signals import issue_unignored
from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils.compat.mock import patch


class FeatureAdoptionTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(FeatureAdoptionTest, self).setUp()
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
            transition_type="automatic",
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
