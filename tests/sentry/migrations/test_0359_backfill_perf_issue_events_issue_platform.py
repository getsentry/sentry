from datetime import datetime, timedelta

from snuba_sdk import Column, Condition, Entity, Function, Op, Query, Request

from sentry.event_manager import EventManager
from sentry.issues.occurrence_consumer import lookup_event
from sentry.models import Group, GroupHash
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.testutils.cases import TestMigrations
from sentry.testutils.helpers import override_options
from sentry.testutils.performance_issues.event_generators import get_event
from tests.sentry.event_manager.test_event_manager import make_event


class TestDefaultFlag(TestMigrations):
    migrate_from = "0358_break_group_related_user_fks"
    migrate_to = "0359_backfill_perf_issue_events_issue_platform"
    QUERY_START_DATE = datetime(2008, 5, 8)
    QUERY_END_DATE = datetime.now() + timedelta(days=1)

    @override_options(
        {
            "performance.issues.compressed_assets.problem-creation": 1.0,
            "performance.issues.consecutive_db.problem-creation": 1.0,
            "performance.issues.n_plus_one_db.problem-creation": 1.0,
            "performance.issues.n_plus_one_db_ext.problem-creation": 1.0,
            "performance.issues.file_io_main_thread.problem-creation": 1.0,
            "performance.issues.n_plus_one_api_calls.problem-creation": 1.0,
            "performance.issues.slow_db_query.problem-creation": 1.0,
            "performance.issues.render_blocking_assets.problem-creation": 1.0,
            "performance.issues.all.problem-detection": 100.0,
        }
    )
    def setup_before_migration(self, apps):
        # event_data_2 = load_data(
        #     platform="transaction",
        #     fingerprint=[f"{PerformanceNPlusOneGroupType.type_id}-group3"],
        # )
        self.project = self.create_project()
        self.project.update_option("sentry:performance_issue_creation_rate", 100.0)

        perf_issue_files = [
            "n-plus-one-in-django-index-view",
            "n-plus-one-db-root-parent-span",
        ]
        for file in perf_issue_files:
            manager = EventManager(make_event(**get_event(file)))

            # manager = EventManager(event_data_2)
            manager.normalize()
            event = manager.save(project_id=self.project.id)

            assert len(event.groups) == 1
            group_id = event.groups[0].id
            assert Group.objects.filter(id=group_id).get()
            assert len(list(GroupHash.objects.filter(group_id=group_id))) == 1
            assert lookup_event(project_id=self.project.id, event_id=event.event_id)

        rows = self._query([self.project.id], self.QUERY_START_DATE, self.QUERY_END_DATE)

        assert len(rows) == 2

    def test_simple(self):
        assert self._query_search_issues(
            [self.project.id], self.QUERY_START_DATE, self.QUERY_END_DATE
        )

    def _query_search_issues(self, project_ids, start, end):
        snuba_request = Request(
            dataset=Dataset.IssuePlatform.value,
            app_id="migration",
            query=Query(
                match=Entity(EntityKey.IssuePlatform.value),
                select=[
                    Column("group_id"),
                    Column("project_id"),
                    Column("event_id"),
                ],
                where=[
                    Condition(Column("project_id"), Op.IN, project_ids),
                    Condition(Column("timestamp"), Op.GTE, start),
                    Condition(Column("timestamp"), Op.LT, end),
                ],
            ),
        )
        from sentry.utils.snuba import raw_snql_query

        result_snql = raw_snql_query(
            snuba_request,
            referrer="0359_duplicate_perf_issue_events_issue_platform._query_performance_issue_events",
            use_cache=False,
        )

        return result_snql["data"]

    def _query(self, project_ids, start, end):
        snuba_request = Request(
            dataset=Dataset.Transactions.value,
            app_id="migration",
            query=Query(
                match=Entity(EntityKey.Transactions.value),
                select=[
                    Function("arrayJoin", parameters=[Column("group_ids")], alias="group_id"),
                    Column("project_id"),
                    Column("event_id"),
                ],
                where=[
                    Condition(Column("group_ids"), Op.IS_NOT_NULL),
                    Condition(Column("project_id"), Op.IN, project_ids),
                    Condition(Column("finish_ts"), Op.GTE, start),
                    Condition(Column("finish_ts"), Op.LT, end),
                ],
            ),
        )
        from sentry.utils.snuba import raw_snql_query

        result_snql = raw_snql_query(
            snuba_request,
            referrer="0359_duplicate_perf_issue_events_issue_platform._query_performance_issue_events",
            use_cache=False,
        )

        return result_snql["data"]
