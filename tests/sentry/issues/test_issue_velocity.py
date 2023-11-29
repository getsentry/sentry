import math
from datetime import timedelta

from django.utils import timezone

from sentry.issues.issue_velocity import calculate_velocity_threshold_for_project
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

        threshold = calculate_velocity_threshold_for_project(self.project)
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
        actual_threshold = calculate_velocity_threshold_for_project(self.project)

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

        threshold = calculate_velocity_threshold_for_project(self.project)
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

        threshold = calculate_velocity_threshold_for_project(self.project)
        assert math.isnan(threshold)
