import math
from datetime import datetime, timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.issues.issue_velocity import (
    DEFAULT_TTL,
    FALLBACK_TTL,
    LEGACY_STALE_DATE_KEY,
    STALE_DATE_KEY,
    STRING_TO_DATETIME,
    THRESHOLD_KEY,
    TIME_TO_USE_EXISTING_THRESHOLD,
    calculate_threshold,
    fallback_to_stale_or_zero,
    get_latest_threshold,
    get_redis_client,
    update_threshold,
)
from sentry.tasks.post_process import locks
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.silo import region_silo_test
from tests.sentry.issues.test_utils import SearchIssueTestMixin

WEEK_IN_HOURS = 7 * 24


@region_silo_test
class IssueVelocityTests(TestCase, SnubaTestCase, SearchIssueTestMixin):
    def setUp(self):
        self.now = timezone.now()
        self.utcnow = datetime.utcnow()
        super().setUp()

    def test_calculation_simple(self):
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

    def test_calculation_multiple_issues(self):
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

        # with 5 issues that are older than a week, p99 should be approximately the hourly event
        # rate of the most frequent issue
        expected_threshold = 6 / WEEK_IN_HOURS
        actual_threshold = calculate_threshold(self.project)

        # clickhouse's quantile function is approximate
        # https://clickhouse.com/docs/en/sql-reference/aggregate-functions/reference/quantile
        assert actual_threshold is not None
        assert math.isclose(expected_threshold, actual_threshold, abs_tol=10**-3)

    def test_calculation_for_issues_first_seen_recently(self):
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

    def test_calculation_excludes_issues_with_only_one_event_in_past_week(self):
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

    def test_calculation_excludes_issues_newer_than_an_hour(self):
        """
        Tests that issues that were first seen within the past hour are excluded from the calculation.
        """
        self.store_search_issue(
            project_id=self.project.id,
            user_id=self.user.id,
            fingerprints=["group-1"],
            insert_time=(self.now - timedelta(minutes=2)),
        )

        self.store_search_issue(
            project_id=self.project.id,
            user_id=self.user.id,
            fingerprints=["group-1"],
            insert_time=(self.now - timedelta(minutes=1)),
        )

        threshold = calculate_threshold(self.project)
        assert threshold is not None
        assert math.isnan(threshold)

    @patch("sentry.issues.issue_velocity.update_threshold")
    def test_get_latest_threshold_simple(self, mock_update):
        """
        Tests that we get the last threshold stored when the stale date has not passed yet.
        """
        redis_client = get_redis_client()
        redis_client.set(THRESHOLD_KEY.format(project_id=self.project.id), 0.1)
        redis_client.set(STALE_DATE_KEY.format(project_id=self.project.id), str(self.utcnow))
        threshold = get_latest_threshold(self.project)
        mock_update.assert_not_called()
        assert threshold == 0.1

    @patch("sentry.issues.issue_velocity.update_threshold")
    def test_get_latest_threshold_outdated(self, mock_update):
        """
        Tests that we update the threshold when the stale date has passed.
        """
        redis_client = get_redis_client()
        redis_client.set(THRESHOLD_KEY.format(project_id=self.project.id), 1.2)
        redis_client.set(
            STALE_DATE_KEY.format(project_id=self.project.id),
            str(self.utcnow - timedelta(days=1)),
        )
        mock_update.return_value = 1.5
        assert get_latest_threshold(self.project) == 1.5

    @patch("sentry.issues.issue_velocity.update_threshold")
    def test_get_latest_threshold_when_none_saved(self, mock_update):
        """
        Tests that we update the threshold when it is non-existent.
        """
        mock_update.return_value = 10.7
        assert get_latest_threshold(self.project) == 10.7

    @patch("sentry.issues.issue_velocity.update_threshold")
    def test_get_latest_threshold_locked(self, mock_update):
        """
        Tests that we return the stale threshold when another process has the lock.
        """
        redis_client = get_redis_client()
        redis_client.set(THRESHOLD_KEY.format(project_id=self.project.id), 0.7)
        redis_client.set(
            STALE_DATE_KEY.format(project_id=self.project.id),
            str(self.utcnow - timedelta(days=1)),
        )

        lock = locks.get(
            f"calculate_project_thresholds:{self.project.id}",
            duration=10,
            name="calculate_project_thresholds",
        )
        with lock.acquire():
            threshold = get_latest_threshold(self.project)
            mock_update.assert_not_called()
            assert threshold == 0.7

    @patch("sentry.issues.issue_velocity.update_threshold")
    def test_get_latest_threshold_locked_no_stale(self, mock_update):
        """
        Tests that we return 0 when another process has the lock and there is no stale value.
        """
        lock = locks.get(
            f"calculate_project_thresholds:{self.project.id}",
            duration=10,
            name="calculate_project_thresholds",
        )
        with lock.acquire():
            threshold = get_latest_threshold(self.project)
            mock_update.assert_not_called()
            assert threshold == 0

    @patch("sentry.issues.issue_velocity.calculate_threshold", return_value=2)
    def test_legacy_date_format_compatibility(self, mock_calculation):
        """Tests that the logic does not break if a stale date was stored with the legacy format."""
        redis_client = get_redis_client()
        redis_client.set(THRESHOLD_KEY.format(project_id=self.project.id), 1)
        redis_client.set(LEGACY_STALE_DATE_KEY.format(project_id=self.project.id), 20231220)
        threshold = get_latest_threshold(self.project)
        assert threshold == 2

        # the legacy stale date key is not updated but the current version of the stale date key is
        assert (
            redis_client.get(LEGACY_STALE_DATE_KEY.format(project_id=self.project.id)) == "20231220"
        )
        assert redis_client.get(STALE_DATE_KEY.format(project_id=self.project.id)) is not None

    @patch("sentry.issues.issue_velocity.calculate_threshold")
    def test_update_threshold_simple(self, mock_calculation):
        """
        Tests that we save the newly calculated threshold at the default TTL and return it.
        """
        mock_calculation.return_value = 5
        threshold = update_threshold(self.project.id, "threshold-key", "date-key")
        assert threshold == 5
        redis_client = get_redis_client()
        assert redis_client.get("threshold-key") == "5"
        stored_date = redis_client.get("date-key")
        assert isinstance(stored_date, str)
        # self.utcnow and the datetime.utcnow() used in the update method may vary in milliseconds so we can't do a direct comparison
        assert (
            0
            <= (datetime.strptime(stored_date, STRING_TO_DATETIME) - self.utcnow).total_seconds()
            < 1
        )
        assert redis_client.ttl("threshold-key") == DEFAULT_TTL
        assert redis_client.ttl("date-key") == DEFAULT_TTL

    @patch("sentry.issues.issue_velocity.calculate_threshold")
    def test_update_threshold_with_stale(self, mock_calculation):
        """
        Tests that we return the stale threshold if the calculation method returns None.
        """
        mock_calculation.return_value = None
        redis_client = get_redis_client()
        redis_client.set("threshold-key", 0.5, ex=86400)

        assert update_threshold(self.project, "threshold-key", "date-key", 0.5) == 0.5

    @patch("sentry.issues.issue_velocity.calculate_threshold")
    def test_update_threshold_none(self, mock_calculation):
        """
        Tests that we return 0 if the calculation method returns None and we don't have a stale
        threshold.
        """
        mock_calculation.return_value = None
        assert update_threshold(self.project, "threshold-key", "date-key") == 0

    @patch("sentry.issues.issue_velocity.calculate_threshold")
    def test_update_threshold_nan(self, mock_calculation):
        """
        Tests that we return 0 and save a threshold for the default TTL if the calculation returned NaN.
        """
        mock_calculation.return_value = float("nan")
        assert update_threshold(self.project, "threshold-key", "date-key") == 0
        redis_client = get_redis_client()
        assert redis_client.get("threshold-key") == "0"
        stored_date = redis_client.get("date-key")
        assert isinstance(stored_date, str)
        assert (
            0
            <= (datetime.strptime(stored_date, STRING_TO_DATETIME) - self.utcnow).total_seconds()
            < 1
        )
        assert redis_client.ttl("threshold-key") == DEFAULT_TTL

    def test_fallback_to_stale(self):
        """
        Tests that we return the stale threshold and maintain its TTL, and update the stale date to
        make the threshold usable for the next ten minutes as a fallback.
        """
        redis_client = get_redis_client()
        redis_client.set("threshold-key", 0.5, ex=86400)

        assert fallback_to_stale_or_zero("threshold-key", "date-key", 0.5) == 0.5
        assert redis_client.get("threshold-key") == "0.5"
        stored_date = redis_client.get("date-key")
        assert isinstance(stored_date, str)
        assert (
            0
            <= (
                datetime.strptime(stored_date, STRING_TO_DATETIME)
                - (
                    self.utcnow
                    - timedelta(seconds=TIME_TO_USE_EXISTING_THRESHOLD)
                    + timedelta(seconds=FALLBACK_TTL)
                )
            ).total_seconds()
            < 1
        )

        assert redis_client.ttl("threshold-key") == 86400
        assert redis_client.ttl("date-key") == 86400

    def test_fallback_to_zero(self):
        """
        Tests that we return 0 and store it in Redis for the next ten minutes as a fallback if we
        do not have a stale threshold.
        """
        assert fallback_to_stale_or_zero("threshold-key", "date-key", None) == 0
        redis_client = get_redis_client()
        assert redis_client.get("threshold-key") == "0"
        stored_date = redis_client.get("date-key")
        assert isinstance(stored_date, str)
        assert (
            0
            <= (
                datetime.strptime(stored_date, STRING_TO_DATETIME)
                - (
                    self.utcnow
                    - timedelta(seconds=TIME_TO_USE_EXISTING_THRESHOLD)
                    + timedelta(seconds=FALLBACK_TTL)
                )
            ).total_seconds()
            < 1
        )
        assert redis_client.ttl("threshold-key") == FALLBACK_TTL
        assert redis_client.ttl("date-key") == FALLBACK_TTL

    def test_fallback_to_stale_zero_ttl(self):
        """
        Tests that we return 0 and store it in Redis for the next ten minutes as a fallback if our
        stale threshold has a TTL <= 0.
        """
        redis_client = get_redis_client()
        assert fallback_to_stale_or_zero("threshold-key", "date-key", 0.5) == 0
        assert redis_client.get("threshold-key") == "0"
        stored_date = redis_client.get("date-key")
        assert isinstance(stored_date, str)
        assert (
            0
            <= (
                datetime.strptime(stored_date, STRING_TO_DATETIME)
                - (
                    self.utcnow
                    - timedelta(seconds=TIME_TO_USE_EXISTING_THRESHOLD)
                    + timedelta(seconds=FALLBACK_TTL)
                )
            ).total_seconds()
            < 1
        )

        assert redis_client.ttl("threshold-key") == FALLBACK_TTL
        assert redis_client.ttl("date-key") == FALLBACK_TTL
