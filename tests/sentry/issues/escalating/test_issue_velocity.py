import math
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.issues.escalating.issue_velocity import (
    DEFAULT_TTL,
    FALLBACK_TTL,
    STALE_DATE_KEY,
    THRESHOLD_KEY,
    TIME_TO_USE_EXISTING_THRESHOLD,
    _calculate_threshold_eap,
    _calculate_threshold_snuba,
    calculate_threshold,
    fallback_to_stale_or_zero,
    get_latest_threshold,
    get_redis_client,
    update_threshold,
)
from sentry.tasks.post_process import locks
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time

WEEK_IN_HOURS = 7 * 24


@freeze_time()
class IssueVelocityTests(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        self.now = timezone.now()
        self.utcnow = datetime.utcnow()
        super().setUp()

    def test_calculation_simple(self) -> None:
        """
        Tests threshold calculation for a single issue with the minimum number of events
        in the past week.
        """
        self.store_event(
            project_id=self.project.id,
            data={
                "fingerprint": ["group-1"],
                "timestamp": (self.now - timedelta(days=8)).isoformat(),
                "user": {"id": self.user.id, "email": self.user.email},
            },
        )
        for _ in range(2):
            self.store_event(
                project_id=self.project.id,
                data={
                    "fingerprint": ["group-1"],
                    "timestamp": (self.now - timedelta(days=1)).isoformat(),
                    "user": {"id": self.user.id, "email": self.user.email},
                },
            )

        threshold = calculate_threshold(self.project)
        assert threshold == 2 / WEEK_IN_HOURS

    def test_calculation_multiple_issues(self) -> None:
        """
        Tests that we receive the approximate 90th percentile for multiple issues older than a week
        with multiple events in the past week.
        """
        for i in range(5):
            # ensure the velocity for each issue is calculated using the whole week
            self.store_event(
                project_id=self.project.id,
                data={
                    "fingerprint": [f"group-{i}"],
                    "timestamp": (self.now - timedelta(days=8)).isoformat(),
                    "user": {"id": self.user.id, "email": self.user.email},
                },
            )
            for _ in range(i + 2):
                # fill with events that happened in the previous week
                self.store_event(
                    project_id=self.project.id,
                    data={
                        "fingerprint": [f"group-{i}"],
                        "timestamp": (self.now - timedelta(days=1)).isoformat(),
                        "user": {"id": self.user.id, "email": self.user.email},
                    },
                )

        # approximate calculation of 95th percentile for small sample
        expected_threshold = 6 * 0.95 / WEEK_IN_HOURS
        actual_threshold = calculate_threshold(self.project)

        # clickhouse's quantile function is approximate
        # https://clickhouse.com/docs/en/sql-reference/aggregate-functions/reference/quantile
        assert actual_threshold is not None
        assert math.isclose(expected_threshold, actual_threshold, abs_tol=10**-3)

    def test_calculation_for_issues_first_seen_recently(self) -> None:
        """
        Tests that issues first seen within the past week use the difference in hours between now
        and when they were first seen to calculate frequency instead of the full week in hours.
        """
        for _ in range(2):
            self.store_event(
                project_id=self.project.id,
                data={
                    "fingerprint": ["group-1"],
                    "timestamp": (self.now - timedelta(days=1)).isoformat(),
                    "user": {"id": self.user.id, "email": self.user.email},
                },
            )
        threshold = calculate_threshold(self.project)
        assert threshold == 2 / 24

    def test_calculation_excludes_issues_with_only_one_event_in_past_week(self) -> None:
        """
        Tests that issues with only one event in the past week are excluded from the calculation.
        """
        self.store_event(
            project_id=self.project.id,
            data={
                "fingerprint": ["group-1"],
                "timestamp": (self.now - timedelta(days=8)).isoformat(),
                "user": {"id": self.user.id, "email": self.user.email},
            },
        )

        self.store_event(
            project_id=self.project.id,
            data={
                "fingerprint": ["group-1"],
                "timestamp": (self.now - timedelta(days=1)).isoformat(),
                "user": {"id": self.user.id, "email": self.user.email},
            },
        )

        threshold = calculate_threshold(self.project)
        assert threshold is not None
        assert math.isnan(threshold)

    def test_calculation_excludes_issues_newer_than_an_hour(self) -> None:
        """
        Tests that issues that were first seen within the past hour are excluded from the calculation.
        """
        self.store_event(
            project_id=self.project.id,
            data={
                "fingerprint": ["group-1"],
                "timestamp": (self.now - timedelta(minutes=1)).isoformat(),
                "user": {"id": self.user.id, "email": self.user.email},
            },
        )

        self.store_event(
            project_id=self.project.id,
            data={
                "fingerprint": ["group-1"],
                "timestamp": (self.now - timedelta(minutes=1)).isoformat(),
                "user": {"id": self.user.id, "email": self.user.email},
            },
        )

        threshold = calculate_threshold(self.project)
        assert threshold is not None
        assert math.isnan(threshold)

    @patch("sentry.issues.escalating.issue_velocity.update_threshold")
    def test_get_latest_threshold_simple(self, mock_update: MagicMock) -> None:
        """
        Tests that we get the last threshold stored when the stale date has not passed yet.
        """
        redis_client = get_redis_client()
        redis_client.set(THRESHOLD_KEY.format(project_id=self.project.id), 0.1)
        redis_client.set(STALE_DATE_KEY.format(project_id=self.project.id), str(self.utcnow))
        threshold = get_latest_threshold(self.project)
        mock_update.assert_not_called()
        assert threshold == 0.1

    @patch("sentry.issues.escalating.issue_velocity.update_threshold")
    def test_get_latest_threshold_outdated(self, mock_update: MagicMock) -> None:
        """
        Tests that we update the threshold when the stale date has passed.
        """
        redis_client = get_redis_client()
        redis_client.set(THRESHOLD_KEY.format(project_id=self.project.id), 1.2)
        redis_client.set(
            STALE_DATE_KEY.format(project_id=self.project.id),
            str(self.utcnow - timedelta(days=1, seconds=1)),
        )
        mock_update.return_value = 1.5
        assert get_latest_threshold(self.project) == 1.5

    @patch("sentry.issues.escalating.issue_velocity.update_threshold")
    def test_get_latest_threshold_when_none_saved(self, mock_update: MagicMock) -> None:
        """
        Tests that we update the threshold when it is non-existent.
        """
        mock_update.return_value = 10.7
        assert get_latest_threshold(self.project) == 10.7

    @patch("sentry.issues.escalating.issue_velocity.update_threshold")
    def test_get_latest_threshold_locked(self, mock_update: MagicMock) -> None:
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

    @patch("sentry.issues.escalating.issue_velocity.update_threshold")
    def test_get_latest_threshold_locked_no_stale(self, mock_update: MagicMock) -> None:
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

    @patch("sentry.issues.escalating.issue_velocity.calculate_threshold")
    def test_update_threshold_simple(self, mock_calculation: MagicMock) -> None:
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
        assert datetime.fromisoformat(stored_date) == self.utcnow
        assert redis_client.ttl("threshold-key") == DEFAULT_TTL
        assert redis_client.ttl("date-key") == DEFAULT_TTL

    @patch("sentry.issues.escalating.issue_velocity.calculate_threshold")
    def test_update_threshold_with_stale(self, mock_calculation: MagicMock) -> None:
        """
        Tests that we return the stale threshold if the calculation method returns None.
        """
        mock_calculation.return_value = None
        redis_client = get_redis_client()
        redis_client.set("threshold-key", 0.5, ex=86400)

        assert update_threshold(self.project, "threshold-key", "date-key", 0.5) == 0.5

    @patch("sentry.issues.escalating.issue_velocity.calculate_threshold")
    def test_update_threshold_none(self, mock_calculation: MagicMock) -> None:
        """
        Tests that we return 0 if the calculation method returns None and we don't have a stale
        threshold.
        """
        mock_calculation.return_value = None
        assert update_threshold(self.project, "threshold-key", "date-key") == 0

    @patch("sentry.issues.escalating.issue_velocity.calculate_threshold")
    def test_update_threshold_nan(self, mock_calculation: MagicMock) -> None:
        """
        Tests that we return 0 and save a threshold for the default TTL if the calculation returned NaN.
        """
        mock_calculation.return_value = float("nan")
        assert update_threshold(self.project, "threshold-key", "date-key") == 0
        redis_client = get_redis_client()
        assert redis_client.get("threshold-key") == "0"
        stored_date = redis_client.get("date-key")
        assert isinstance(stored_date, str)
        assert datetime.fromisoformat(stored_date) == self.utcnow
        assert redis_client.ttl("threshold-key") == DEFAULT_TTL

    def test_fallback_to_stale(self) -> None:
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
        assert datetime.fromisoformat(stored_date) == (
            self.utcnow
            - timedelta(seconds=TIME_TO_USE_EXISTING_THRESHOLD)
            + timedelta(seconds=FALLBACK_TTL)
        )

        assert redis_client.ttl("threshold-key") == 86400
        assert redis_client.ttl("date-key") == 86400

    def test_fallback_to_zero(self) -> None:
        """
        Tests that we return 0 and store it in Redis for the next ten minutes as a fallback if we
        do not have a stale threshold.
        """
        assert fallback_to_stale_or_zero("threshold-key", "date-key", None) == 0
        redis_client = get_redis_client()
        assert redis_client.get("threshold-key") == "0"
        stored_date = redis_client.get("date-key")
        assert isinstance(stored_date, str)
        assert datetime.fromisoformat(stored_date) == (
            self.utcnow
            - timedelta(seconds=TIME_TO_USE_EXISTING_THRESHOLD)
            + timedelta(seconds=FALLBACK_TTL)
        )
        assert redis_client.ttl("threshold-key") == FALLBACK_TTL
        assert redis_client.ttl("date-key") == FALLBACK_TTL

    def test_fallback_to_stale_zero_ttl(self) -> None:
        """
        Tests that we return 0 and store it in Redis for the next ten minutes as a fallback if our
        stale threshold has a TTL <= 0.
        """
        redis_client = get_redis_client()
        assert fallback_to_stale_or_zero("threshold-key", "date-key", 0.5) == 0
        assert redis_client.get("threshold-key") == "0"
        stored_date = redis_client.get("date-key")
        assert isinstance(stored_date, str)
        assert datetime.fromisoformat(stored_date) == (
            self.utcnow
            - timedelta(seconds=TIME_TO_USE_EXISTING_THRESHOLD)
            + timedelta(seconds=FALLBACK_TTL)
        )

        assert redis_client.ttl("threshold-key") == FALLBACK_TTL
        assert redis_client.ttl("date-key") == FALLBACK_TTL


class TestEAPIssueVelocityThreshold(TestCase, SnubaTestCase):
    FROZEN_TIME = before_now(hours=24).replace(hour=6, minute=0, second=0, microsecond=0)

    def _event_timestamp(self, hours_ago: int = 0) -> float:
        return (self.FROZEN_TIME - timedelta(hours=hours_ago)).timestamp()

    @freeze_time(FROZEN_TIME)
    def test_eap_threshold_simple(self) -> None:
        self.store_events_to_snuba_and_eap(
            "group-1", count=1, timestamp=self._event_timestamp(hours_ago=192)
        )
        self.store_events_to_snuba_and_eap(
            "group-1", count=2, timestamp=self._event_timestamp(hours_ago=24)
        )

        eap_threshold = _calculate_threshold_eap(self.project)
        snuba_threshold = _calculate_threshold_snuba(self.project)

        assert eap_threshold == 2 / WEEK_IN_HOURS
        assert snuba_threshold == eap_threshold

    @freeze_time(FROZEN_TIME)
    def test_eap_threshold_recent_issue(self) -> None:
        self.store_events_to_snuba_and_eap(
            "group-1", count=2, timestamp=self._event_timestamp(hours_ago=24)
        )

        eap_threshold = _calculate_threshold_eap(self.project)
        snuba_threshold = _calculate_threshold_snuba(self.project)

        assert eap_threshold == 2 / 24
        assert snuba_threshold == eap_threshold

    @freeze_time(FROZEN_TIME)
    def test_eap_threshold_excludes_single_event_issues(self) -> None:
        self.store_events_to_snuba_and_eap(
            "group-1", count=1, timestamp=self._event_timestamp(hours_ago=192)
        )
        self.store_events_to_snuba_and_eap(
            "group-1", count=1, timestamp=self._event_timestamp(hours_ago=24)
        )

        eap_threshold = _calculate_threshold_eap(self.project)
        snuba_threshold = _calculate_threshold_snuba(self.project)

        assert eap_threshold is not None and math.isnan(eap_threshold)
        assert snuba_threshold is not None and math.isnan(snuba_threshold)

    @freeze_time(FROZEN_TIME)
    def test_eap_threshold_excludes_very_recent_issues(self) -> None:
        recent_ts = (self.FROZEN_TIME - timedelta(minutes=30)).timestamp()
        self.store_events_to_snuba_and_eap("group-1", count=2, timestamp=recent_ts)

        eap_threshold = _calculate_threshold_eap(self.project)
        snuba_threshold = _calculate_threshold_snuba(self.project)

        assert eap_threshold is not None and math.isnan(eap_threshold)
        assert snuba_threshold is not None and math.isnan(snuba_threshold)

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_threshold_match_multiple_issues(self) -> None:
        for i in range(5):
            self.store_events_to_snuba_and_eap(
                f"group-{i}", count=1, timestamp=self._event_timestamp(hours_ago=192)
            )
            self.store_events_to_snuba_and_eap(
                f"group-{i}", count=i + 2, timestamp=self._event_timestamp(hours_ago=24)
            )

        eap_threshold = _calculate_threshold_eap(self.project)
        snuba_threshold = _calculate_threshold_snuba(self.project)

        assert eap_threshold is not None
        assert snuba_threshold is not None
        assert math.isclose(eap_threshold, snuba_threshold, abs_tol=10**-3)
