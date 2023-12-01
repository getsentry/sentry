import math
from datetime import datetime, timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.issues.issue_velocity import calculate_threshold, get_latest_threshold, update_threshold
from sentry.locks import locks
from sentry.testutils.cases import SnubaTestCase, TestCase
from tests.sentry.issues.test_utils import SearchIssueTestMixin

WEEK_IN_HOURS = 7 * 24


class VelocityThresholdCalculationTests(TestCase, SnubaTestCase, SearchIssueTestMixin):
    def setUp(self):
        self.now = timezone.now()
        super().setUp()

    def test_simple(self):
        """
        Tests threshold calculation for a single issue with the minimum number of events
        in the past week.
        """
        self.store_search_issue(
            project_id=self.project.id,
            user_id=self.user.id,
            fingerprints=["group-1"],
            insert_time=(self.now - timedelta(days=8)),
        )
        for _ in range(2):
            self.store_search_issue(
                project_id=self.project.id,
                user_id=self.user.id,
                fingerprints=["group-1"],
                insert_time=(self.now - timedelta(days=1)),
            )

        threshold = calculate_threshold(self.project)
        assert threshold == 2 / WEEK_IN_HOURS

    def test_multiple_issues(self):
        """
        Tests that we receive the approximate 90th percentile for multiple issues older than a week
        with multiple events in the past week.
        """
        for i in range(5):
            # ensure the velocity for each issue is calculated using the whole week
            self.store_search_issue(
                project_id=self.project.id,
                user_id=self.user.id,
                fingerprints=[f"group-{i}"],
                insert_time=(self.now - timedelta(days=8)),
            )
            for _ in range(i + 2):
                # fill with events that happened in the previous week
                self.store_search_issue(
                    project_id=self.project.id,
                    user_id=self.user.id,
                    fingerprints=[f"group-{i}"],
                    insert_time=(self.now - timedelta(days=1)),
                )

        # with 5 issues that are older than a week, p90 should be approximately in between the
        # first and second most frequent issues, which in this case have 6 and 5 events respectively
        expected_threshold = ((6 / WEEK_IN_HOURS) + (5 / WEEK_IN_HOURS)) / 2
        actual_threshold = calculate_threshold(self.project)
        assert actual_threshold is not None

        # clickhouse's quantile function is approximate
        # https://clickhouse.com/docs/en/sql-reference/aggregate-functions/reference/quantile
        assert math.isclose(expected_threshold, actual_threshold, abs_tol=10**-3)

    def test_for_issues_first_seen_recently(self):
        """
        Tests that issues first seen within the past week use the difference in hours between now
        and when they were first seen to calculate frequency instead of the full week in hours.
        """
        for _ in range(2):
            self.store_search_issue(
                project_id=self.project.id,
                user_id=self.user.id,
                fingerprints=["group-1"],
                insert_time=(self.now - timedelta(days=1)),
            )

        threshold = calculate_threshold(self.project)
        assert threshold == 2 / 24

    def test_excludes_issues_with_only_one_event_in_past_week(self):
        """
        Tests that issues with only one event in the past week are excluded from the calculation.
        """
        self.store_search_issue(
            project_id=self.project.id,
            user_id=self.user.id,
            fingerprints=["group-1"],
            insert_time=(self.now - timedelta(days=8)),
        )

        self.store_search_issue(
            project_id=self.project.id,
            user_id=self.user.id,
            fingerprints=["group-1"],
            insert_time=(self.now - timedelta(days=1)),
        )

        threshold = calculate_threshold(self.project)
        assert threshold is not None
        assert math.isnan(threshold)

    @patch("sentry.issues.issue_velocity.update_threshold")
    @patch("sentry.issues.issue_velocity.get_redis_client")
    def test_get_latest_threshold_simple(self, mock_client, mock_update):
        """
        Tests that we get the last threshold stored when the stale date has not passed yet.
        """
        mock_client.return_value.mget.return_value = [
            0.1,
            (datetime.utcnow() + timedelta(hours=1)).timestamp(),
        ]
        threshold = get_latest_threshold(self.project)
        mock_update.assert_not_called()
        assert threshold == 0.1

    @patch("sentry.issues.issue_velocity.update_threshold")
    @patch("sentry.issues.issue_velocity.get_redis_client")
    def test_get_latest_threshold_outdated(self, mock_client, mock_update):
        """
        Tests that we update the threshold when the stale date has passed.
        """
        mock_client.return_value.mget.return_value = [
            1.2,
            (datetime.utcnow() - timedelta(days=1)).timestamp(),
        ]
        mock_update.return_value = 1.5
        assert get_latest_threshold(self.project) == 1.5

    @patch("sentry.issues.issue_velocity.update_threshold")
    @patch("sentry.issues.issue_velocity.get_redis_client")
    def test_get_latest_threshold_when_none_saved(self, mock_client, mock_update):
        """
        Tests that we update the threshold when it is non-existent.
        """
        mock_client.return_value.mget.return_value = [None, None]
        mock_update.return_value = 10.7
        assert get_latest_threshold(self.project) == 10.7

    @patch("sentry.issues.issue_velocity.update_threshold")
    @patch("sentry.issues.issue_velocity.get_redis_client")
    def test_get_latest_threshold_locked(self, mock_client, mock_update):
        """
        Tests that we return the stale threshold when another process has the lock.
        """
        mock_client.return_value.mget.return_value = [None, datetime.utcnow().timestamp()]

        lock = locks.get(
            f"calculate_project_thresholds:{self.project.id}",
            duration=10,
            name="calculate_project_thresholds",
        )
        with lock.acquire():
            threshold = get_latest_threshold(self.project)
            mock_update.assert_not_called()
            assert threshold is None

    @patch("sentry.issues.issue_velocity.calculate_threshold")
    def test_update_threshold_nan(self, mock_calculation):
        """
        Tests that we return None if the calculation returns NaN.
        """
        mock_calculation.return_value = float("nan")
        assert update_threshold(self.project, "dummy-key-1", "dummy-key-2") is None
