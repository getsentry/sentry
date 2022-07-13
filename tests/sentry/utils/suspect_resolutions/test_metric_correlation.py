import random
from unittest import mock

import scipy.stats
from django.utils import timezone

from sentry.models import GroupStatus
from sentry.testutils import TestCase
from sentry.utils.suspect_resolutions.metric_correlation import (
    calculate_pearson_correlation_coefficient,
    is_issue_error_rate_correlated,
)

start = 1656393600
end = 1656396780
window = 60


def generate_issue_error_series(
    start_timestamp, end_timestamp, data_fill, empty_fill=0, time_window=60
):
    return data_fill + [(t, empty_fill) for t in range(start_timestamp, end_timestamp, time_window)]


class TestMetricCorrelation(TestCase):
    @mock.patch("sentry.tsdb.get_range")
    def test_correlated_issues(self, mock_get_range):
        group1 = self.create_group(status=GroupStatus.RESOLVED, resolved_at=timezone.now())
        group2 = self.create_group()

        gen_random_start = 1656393120
        gen_random_end = 1656393600

        group1_data = [
            (t, random.randint(0, 30)) for t in range(gen_random_start, gen_random_end, window)
        ]
        group2_data = [
            (t, random.randint(0, 30)) for t in range(gen_random_start, gen_random_end, window)
        ]

        group1_events = generate_issue_error_series(start, end, group1_data)
        group2_events = generate_issue_error_series(start, end, group2_data)

        mock_get_range.return_value = {group1.id: group1_events, group2.id: group2_events}

        assert is_issue_error_rate_correlated(group1, group2)

    @mock.patch("sentry.tsdb.get_range")
    def test_uncorrelated_issues(self, mock_get_range):
        group1 = self.create_group(status=GroupStatus.RESOLVED, resolved_at=timezone.now())
        group2 = self.create_group()

        group1_events = [(t, random.randint(0, 30)) for t in range(start, end, window)]
        group2_events = [(t, random.randint(0, 30)) for t in range(start, end, window)]

        mock_get_range.return_value = {group1.id: group1_events, group2.id: group2_events}

        assert not is_issue_error_rate_correlated(group1, group2)

    @mock.patch("sentry.tsdb.get_range")
    def test_custom_calculation_against_pearsonr(self, mock_get_range):
        group1 = self.create_group(status=GroupStatus.RESOLVED, resolved_at=timezone.now())
        group2 = self.create_group()

        group1_events = [random.randint(0, 30) for _ in range(0, 30)]
        group2_events = [random.randint(0, 30) for _ in range(0, 30)]

        mock_get_range.return_value = {group1.id: group1_events, group2.id: group2_events}

        (r, p) = scipy.stats.pearsonr(group1_events, group2_events)

        assert round(
            calculate_pearson_correlation_coefficient(group1_events, group2_events), 14
        ) == round(r, 14)
