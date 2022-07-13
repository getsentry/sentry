import random
from unittest import mock

from django.utils import timezone

from sentry.models import GroupStatus
from sentry.testutils import TestCase
from sentry.utils.suspect_resolutions.metric_correlation import (
    calculate_pearson_correlation_coefficient,
    is_issue_error_rate_correlated,
)

START = 1656393600
END = 1656396780
WINDOW = 60


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
            (t, random.randint(0, 30)) for t in range(gen_random_start, gen_random_end, WINDOW)
        ]
        group2_data = [
            (t, random.randint(0, 30)) for t in range(gen_random_start, gen_random_end, WINDOW)
        ]

        group1_events = generate_issue_error_series(START, END, group1_data)
        group2_events = generate_issue_error_series(START, END, group2_data)

        mock_get_range.return_value = {group1.id: group1_events, group2.id: group2_events}

        assert is_issue_error_rate_correlated(group1, group2)

    @mock.patch("sentry.tsdb.get_range")
    def test_uncorrelated_issues(self, mock_get_range):
        group1 = self.create_group(status=GroupStatus.RESOLVED, resolved_at=timezone.now())
        group2 = self.create_group()

        group1_events = [(t, random.randint(0, 30)) for t in range(START, END, WINDOW)]
        group2_events = [(t, random.randint(0, 30)) for t in range(START, END, WINDOW)]

        mock_get_range.return_value = {group1.id: group1_events, group2.id: group2_events}

        assert not is_issue_error_rate_correlated(group1, group2)

    def test_custom_calculation_against_pearsonr(self):
        group1_events = [
            21,
            28,
            4,
            2,
            9,
            10,
            11,
            19,
            29,
            30,
            7,
            28,
            7,
            23,
            21,
            6,
            12,
            22,
            28,
            18,
            1,
            28,
            30,
            8,
            30,
            28,
            13,
            20,
            28,
            12,
        ]
        group2_events = [
            18,
            4,
            0,
            24,
            29,
            19,
            22,
            3,
            11,
            2,
            17,
            18,
            6,
            27,
            12,
            29,
            3,
            19,
            20,
            25,
            23,
            3,
            5,
            30,
            19,
            10,
            26,
            26,
            9,
            21,
        ]
        group3_events = [
            18,
            7,
            23,
            21,
            1,
            5,
            23,
            20,
            25,
            11,
            21,
            9,
            21,
            23,
            14,
            1,
            20,
            3,
            14,
            30,
            7,
            25,
            0,
            16,
            2,
            19,
            14,
            8,
            25,
            25,
        ]
        group4_events = [
            4,
            5,
            20,
            28,
            24,
            25,
            28,
            8,
            18,
            29,
            28,
            4,
            1,
            24,
            13,
            7,
            28,
            23,
            0,
            9,
            2,
            19,
            29,
            25,
            13,
            10,
            30,
            15,
            20,
            5,
        ]

        # used scipy.stats.pearsonr() to calculate the results below
        group1_group2_pearsonr_result = (-0.3652702353193248, 0.04716194093601093)
        group1_group3_pearsonr_result = (-0.07067218051579457, 0.7105599952548641)
        group1_group4_pearsonr_result = (-0.11589514295691093, 0.541946834089711)
        group2_group3_pearsonr_result = (-0.20442345494634662, 0.2785464088981273)
        group2_group4_pearsonr_result = (0.012262041164229425, 0.94872305565523)
        group3_group4_pearsonr_result = (0.0021439674812376275, 0.9910287736504696)

        assert round(
            calculate_pearson_correlation_coefficient(group1_events, group2_events), 14
        ) == round(group1_group2_pearsonr_result[0], 14)

        assert round(
            calculate_pearson_correlation_coefficient(group1_events, group3_events), 14
        ) == round(group1_group3_pearsonr_result[0], 14)

        assert round(
            calculate_pearson_correlation_coefficient(group1_events, group4_events), 14
        ) == round(group1_group4_pearsonr_result[0], 14)

        assert round(
            calculate_pearson_correlation_coefficient(group2_events, group3_events), 14
        ) == round(group2_group3_pearsonr_result[0], 14)

        assert round(
            calculate_pearson_correlation_coefficient(group2_events, group4_events), 14
        ) == round(group2_group4_pearsonr_result[0], 14)

        assert round(
            calculate_pearson_correlation_coefficient(group3_events, group4_events), 14
        ) == round(group3_group4_pearsonr_result[0], 14)
