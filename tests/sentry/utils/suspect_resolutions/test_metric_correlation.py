import datetime
import random
from unittest import mock

from django.utils import timezone

from sentry.models.group import GroupStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.suspect_resolutions.metric_correlation import (
    CandidateMetricCorrResult,
    calculate_pearson_correlation_coefficient,
    is_issue_error_rate_correlated,
)

WINDOW = 60


@region_silo_test
class MetricCorrelationTest(TestCase):
    def generate_timestamps(self):
        now = datetime.datetime.now()
        start = int((now - datetime.timedelta(hours=1)).timestamp())
        end = int(now.timestamp())
        return start, end

    def generate_empty_issue_events(
        self, start_timestamp, end_timestamp, data_fill, empty_fill=0, time_window=60
    ):
        """
        Fill the time-series data with 0 events within a specific time-window to model a scenario where there is a
        significant drop in events after an issue has been resolved
        """
        return data_fill + [
            (t, empty_fill) for t in range(start_timestamp, end_timestamp, time_window)
        ]

    def generate_random_issue_events(self, start, end, window):
        """
        Generate time-series data with a random number of events within a specific time-window
        """
        return [(t, random.randint(0, 30)) for t in range(start, end, window)]

    @mock.patch("sentry.tsdb.backend.get_range")
    def test_correlated_issues(self, mock_get_range):
        start, end = self.generate_timestamps()
        group1 = self.create_group(status=GroupStatus.RESOLVED, resolved_at=timezone.now())
        group2 = self.create_group()

        group1_data = self.generate_random_issue_events(start, end, WINDOW)
        group2_data = self.generate_random_issue_events(start, end, WINDOW)

        group1_events = self.generate_empty_issue_events(start, end, group1_data)
        group2_events = self.generate_empty_issue_events(start, end, group2_data)

        mock_get_range.return_value = {group1.id: group1_events, group2.id: group2_events}

        group1_pearson_values = [events for _, events in group1_events]
        group2_pearson_values = [events for _, events in group2_events]

        group1_total_events = sum(group1_pearson_values)
        group2_total_events = sum(group2_pearson_values)

        coefficient = calculate_pearson_correlation_coefficient(
            group1_pearson_values, group2_pearson_values
        )

        result = is_issue_error_rate_correlated(group1, [group2])
        assert result is not None

        assert result.candidate_metric_correlations == [
            CandidateMetricCorrResult(
                candidate_suspect_resolution_id=group2.id,
                is_correlated=True,
                coefficient=coefficient,
                candidate_issue_total_events=group2_total_events,
                resolved_issue_total_events=group1_total_events,
            )
        ]
        assert result.issue_resolved_time == group1.resolved_at

    @mock.patch("sentry.tsdb.backend.get_range")
    def test_uncorrelated_issues(self, mock_get_range):
        start, end = self.generate_timestamps()
        group1 = self.create_group(status=GroupStatus.RESOLVED, resolved_at=timezone.now())
        group2 = self.create_group()

        group1_events = self.generate_random_issue_events(start, end, WINDOW)
        group2_events = self.generate_random_issue_events(start, end, WINDOW)

        mock_get_range.return_value = {group1.id: group1_events, group2.id: group2_events}

        group1_pearson_values = [events for _, events in group1_events]
        group2_pearson_values = [events for _, events in group2_events]

        group1_total_events = sum(group1_pearson_values)
        group2_total_events = sum(group2_pearson_values)

        coefficient = calculate_pearson_correlation_coefficient(
            group1_pearson_values, group2_pearson_values
        )

        result = is_issue_error_rate_correlated(group1, [group2])
        assert result is not None

        assert result.candidate_metric_correlations == [
            CandidateMetricCorrResult(
                candidate_suspect_resolution_id=group2.id,
                is_correlated=False,
                coefficient=coefficient,
                candidate_issue_total_events=group2_total_events,
                resolved_issue_total_events=group1_total_events,
            )
        ]
        assert result.issue_resolved_time == group1.resolved_at

    @mock.patch("sentry.tsdb.backend.get_range")
    def test_perfect_correlation(self, mock_get_range):
        start, end = self.generate_timestamps()
        group1 = self.create_group(status=GroupStatus.RESOLVED, resolved_at=timezone.now())
        group2 = self.create_group()

        group1_events = self.generate_random_issue_events(start, end, WINDOW)

        mock_get_range.return_value = {group1.id: group1_events, group2.id: group1_events}

        group1_pearson_values = [events for _, events in group1_events]
        group2_pearson_values = [events for _, events in group1_events]

        group1_total_events = sum(group1_pearson_values)
        group2_total_events = sum(group2_pearson_values)

        coefficient = calculate_pearson_correlation_coefficient(
            group1_pearson_values, group2_pearson_values
        )

        result = is_issue_error_rate_correlated(group1, [group2])
        assert result is not None

        assert result.candidate_metric_correlations == [
            CandidateMetricCorrResult(
                candidate_suspect_resolution_id=group2.id,
                is_correlated=True,
                coefficient=coefficient,
                candidate_issue_total_events=group2_total_events,
                resolved_issue_total_events=group1_total_events,
            )
        ]
        assert result.issue_resolved_time == group1.resolved_at

    @mock.patch("sentry.tsdb.backend.get_range")
    def test_multiple_groups(self, mock_get_range):
        start, end = self.generate_timestamps()
        group1 = self.create_group(status=GroupStatus.RESOLVED, resolved_at=timezone.now())
        group2 = self.create_group()
        group3 = self.create_group()
        group4 = self.create_group()

        group1_data = self.generate_random_issue_events(start, end, WINDOW)
        group2_data = self.generate_random_issue_events(start, end, WINDOW)
        group3_data = self.generate_random_issue_events(start, end, WINDOW)
        group4_data = self.generate_random_issue_events(start, end, WINDOW)

        group1_events = self.generate_empty_issue_events(start, end, group1_data)
        group2_events = self.generate_empty_issue_events(start, end, group2_data)
        group3_events = self.generate_empty_issue_events(start, end, group3_data)
        group4_events = self.generate_empty_issue_events(start, end, group4_data)

        mock_get_range.return_value = {
            group1.id: group1_events,
            group2.id: group2_events,
            group3.id: group3_events,
            group4.id: group4_events,
        }

        group1_pearson_values = [events for _, events in group1_events]
        group2_pearson_values = [events for _, events in group2_events]
        group3_pearson_values = [events for _, events in group3_events]
        group4_pearson_values = [events for _, events in group4_events]

        group1_total_events = sum(group1_pearson_values)
        group2_total_events = sum(group2_pearson_values)
        group3_total_events = sum(group3_pearson_values)
        group4_total_events = sum(group4_pearson_values)

        coefficient_group2 = calculate_pearson_correlation_coefficient(
            group1_pearson_values, group2_pearson_values
        )
        coefficient_group3 = calculate_pearson_correlation_coefficient(
            group1_pearson_values, group3_pearson_values
        )
        coefficient_group4 = calculate_pearson_correlation_coefficient(
            group1_pearson_values, group4_pearson_values
        )

        result = is_issue_error_rate_correlated(group1, [group2, group3, group4])
        assert result is not None

        assert result.candidate_metric_correlations == [
            CandidateMetricCorrResult(
                candidate_suspect_resolution_id=group2.id,
                is_correlated=True,
                coefficient=coefficient_group2,
                candidate_issue_total_events=group2_total_events,
                resolved_issue_total_events=group1_total_events,
            ),
            CandidateMetricCorrResult(
                candidate_suspect_resolution_id=group3.id,
                is_correlated=True,
                coefficient=coefficient_group3,
                candidate_issue_total_events=group3_total_events,
                resolved_issue_total_events=group1_total_events,
            ),
            CandidateMetricCorrResult(
                candidate_suspect_resolution_id=group4.id,
                is_correlated=True,
                coefficient=coefficient_group4,
                candidate_issue_total_events=group4_total_events,
                resolved_issue_total_events=group1_total_events,
            ),
        ]
        assert result.issue_resolved_time == group1.resolved_at

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
