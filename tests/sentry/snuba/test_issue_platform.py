from __future__ import annotations

from unittest.mock import Mock, patch

from sentry.search.events.types import SnubaParams
from sentry.snuba import issue_platform
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now


class _FakeDiscoverBuilder:
    tips = {"query": set(), "columns": set()}

    def __init__(self, *args, **kwargs):
        pass

    def add_conditions(self, conditions):
        pass

    def run_query(self, referrer, query_source=None):
        return {
            "data": [{"id": "control-event", "count()": 1}],
            "meta": {"fields": {"id": "string", "count()": "integer"}},
        }

    def process_results(self, result):
        return result

    def get_snql_query(self):
        return Mock(query="SELECT 1")


class IssuePlatformQueryTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.snuba_params = SnubaParams(
            start=before_now(hours=1),
            end=before_now(minutes=1),
            organization=self.organization,
            projects=[self.project],
            environments=[],
        )

    @patch("sentry.snuba.issue_platform.DiscoverQueryBuilder", new=_FakeDiscoverBuilder)
    @patch("sentry.snuba.issue_platform.Occurrences.run_table_query")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_query_uses_referrer_for_rollout_callsite(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_table_query: Mock,
    ) -> None:
        should_check_experiment.return_value = True
        run_table_query.return_value = {
            "data": [{"id": "exp-event", "count()": 1}],
            "meta": {"fields": {"id": "string", "count()": "integer"}},
        }
        check_and_choose.return_value = [{"id": "control-event", "count()": 1}]

        issue_platform.query(
            selected_columns=["id", "count()"],
            query="",
            snuba_params=self.snuba_params,
            limit=10,
            referrer="api.organization-issue-replay-count",
        )

        expected_callsite = "snuba.issue_platform.query:api.organization-issue-replay-count"
        should_check_experiment.assert_called_once_with(expected_callsite)
        assert check_and_choose.call_args.args[2] == expected_callsite

    @patch("sentry.snuba.issue_platform.DiscoverQueryBuilder", new=_FakeDiscoverBuilder)
    @patch("sentry.snuba.issue_platform.Occurrences.run_table_query")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_query_skips_experimental_when_conditions_present(
        self,
        should_check_experiment: Mock,
        run_table_query: Mock,
    ) -> None:
        issue_platform.query(
            selected_columns=["id", "count()"],
            query="",
            snuba_params=self.snuba_params,
            conditions=[["foo", "=", "bar"]],
            referrer="api.organization-events",
        )

        should_check_experiment.assert_not_called()
        run_table_query.assert_not_called()

    @patch("sentry.snuba.issue_platform.DiscoverQueryBuilder", new=_FakeDiscoverBuilder)
    @patch("sentry.snuba.issue_platform.Occurrences.run_table_query")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_query_can_return_experimental_rows_when_chosen(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_table_query: Mock,
    ) -> None:
        should_check_experiment.return_value = True
        experimental_rows = [{"id": "exp-event", "count()": 1}]
        run_table_query.return_value = {
            "data": experimental_rows,
            "meta": {"fields": {"id": "string", "count()": "integer"}},
        }
        check_and_choose.return_value = experimental_rows

        result = issue_platform.query(
            selected_columns=["id", "count()"],
            query="",
            snuba_params=self.snuba_params,
            limit=10,
            referrer="api.organization-events",
        )

        assert result["data"] == experimental_rows

    @patch("sentry.snuba.issue_platform.DiscoverQueryBuilder", new=_FakeDiscoverBuilder)
    @patch("sentry.snuba.issue_platform.Occurrences.run_table_query")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.check_and_choose")
    @patch("sentry.snuba.issue_platform.EAPOccurrencesComparator.should_check_experiment")
    def test_query_normalizes_issue_id_from_eap_response(
        self,
        should_check_experiment: Mock,
        check_and_choose: Mock,
        run_table_query: Mock,
    ) -> None:
        should_check_experiment.return_value = True
        run_table_query.return_value = {
            "data": [{"group_id": 17, "count()": 2}],
            "meta": {"fields": {"group_id": "integer", "count()": "integer"}},
            "confidence": [],
        }
        check_and_choose.side_effect = lambda _ctl, exp, *_args, **_kwargs: exp

        result = issue_platform.query(
            selected_columns=["issue.id", "count()"],
            query="issue.id:17",
            snuba_params=self.snuba_params,
            referrer="api.organization-events",
            limit=10,
        )

        assert result["data"] == [{"issue.id": 17, "count()": 2}]
