import random
from unittest import mock

from django.utils import timezone

from sentry.models import GroupStatus
from sentry.suspect_resolutions.metric_correlation import is_issue_error_rate_correlated
from sentry.testutils import TestCase


class TestMetricCorrelation(TestCase):
    @mock.patch("sentry.tsdb.get_range")
    def test_correlated_issues(self, mock_get_range):
        group1 = self.create_group(status=GroupStatus.RESOLVED, resolved_at=timezone.now())
        group2 = self.create_group()

        group1_events = [
            (1656393120, 4),
            (1656393180, 2),
            (1656393240, 2),
            (1656393300, 1),
            (1656393360, 3),
            (1656393420, 2),
            (1656393480, 0),
            (1656393540, 3),
        ] + [(t, 0) for t in range(1656393600, 1656396780, 60)]

        group2_events = [
            (1656393120, 17),
            (1656393180, 17),
            (1656393240, 15),
            (1656393300, 16),
            (1656393360, 16),
            (1656393420, 14),
            (1656393480, 13),
            (1656393540, 19),
        ] + [(t, 0) for t in range(1656393600, 1656396780, 60)]

        mock_get_range.return_value = {group1.id: group1_events, group2.id: group2_events}

        assert is_issue_error_rate_correlated(group1.id, group2.id)

    @mock.patch("sentry.tsdb.get_range")
    def test_uncorrelated_issues(self, mock_get_range):
        group1 = self.create_group(status=GroupStatus.RESOLVED, resolved_at=timezone.now())
        group2 = self.create_group()

        group1_events = [(t, random.randint(0, 30)) for t in range(1656393600, 1656396780, 60)]
        group2_events = [(t, random.randint(0, 30)) for t in range(1656393600, 1656396780, 60)]

        mock_get_range.return_value = {group1.id: group1_events, group2.id: group2_events}

        assert not is_issue_error_rate_correlated(group1.id, group2.id)
