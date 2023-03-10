from datetime import datetime, timedelta

from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Limit,
    Offset,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.event_manager import EventManager
from sentry.issues.occurrence_consumer import lookup_event
from sentry.models import Group, GroupHash
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.testutils.cases import TestMigrations
from sentry.testutils.helpers import override_options
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.utils.snuba import raw_snql_query
from tests.sentry.event_manager.test_event_manager import make_event


class TestDefaultFlag(TestMigrations):
    migrate_from = "0371_monitor_make_org_slug_unique"
    migrate_to = "0372_backfill_perf_issue_events_issue_platform"
    QUERY_START_DATE = datetime(2008, 5, 8)
    QUERY_END_DATE = datetime.now() + timedelta(days=1)

    def setup_initial_state(self):
        self.project = self.create_project(name="my_proj")
        self.project.update_option("sentry:performance_issue_creation_rate", 100.0)

        perf_issue_files = [
            "n-plus-one-in-django-index-view",
            "n-plus-one-db-root-parent-span",
        ]

        keys = []
        self.events = []
        self.groups = []
        for file in perf_issue_files:
            evt = make_event(**get_event(file))
            evt["timestamp"] = datetime.utcnow().isoformat()
            if "datetime" in evt:
                del evt["datetime"]
            if "location" in evt:
                del evt["location"]
            if "title" in evt:
                del evt["title"]

            manager = EventManager(evt)
            manager.normalize()

            with override_options(
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
            ):
                # this assumes the old style of creating perf issue is preserved
                # since we'll be dual-writing the perf issue to transactions and search_issues, this should work fine
                event = manager.save(project_id=self.project.id)
                self.events.append(event)
                assert len(event.groups) == 1

            self.groups.append(event.groups[0])
            assert lookup_event(project_id=self.project.id, event_id=event.event_id)
            keys.append(
                {
                    "group_id": event.groups[0].id,
                    "project_id": self.project.id,
                    "event_id": event.event_id,
                }
            )

        rows = self._query_performance_issue_transactions(
            self.project.id, self.QUERY_START_DATE, self.QUERY_END_DATE
        )

        assert len(rows) == len(keys)
        self.keys = keys

        assert Group.objects.all().count() == 2

    def test_simple(self):
        assert Group.objects.all().count() == 2
        assert GroupHash.objects.all().count() == 2

        rows = self._query_performance_issue_transactions(
            self.project.id, self.QUERY_START_DATE, self.QUERY_END_DATE
        )
        assert len(rows) == 2

        event_keys = {key["event_id"] for key in self.keys}
        search_issues = self._query_search_issue_events(
            [self.project.id], self.QUERY_START_DATE, self.QUERY_END_DATE
        )
        search_issue_event_keys = {search_issue["event_id"] for search_issue in search_issues}

        assert len(event_keys) == len(search_issue_event_keys)
        assert event_keys == search_issue_event_keys

    def _query_search_issue_events(self, project_ids, start, end):
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
                groupby=[Column("group_id"), Column("project_id"), Column("event_id")],
                orderby=[
                    OrderBy(Column("project_id"), direction=Direction.ASC),
                    OrderBy(Column("group_id"), direction=Direction.ASC),
                    OrderBy(Column("event_id"), direction=Direction.ASC),
                ],
            ),
        )

        result_snql = raw_snql_query(
            snuba_request,
            referrer=f"{self.migrate_to}._query_search_issues",
            use_cache=False,
        )

        return result_snql["data"]

    def _query_performance_issue_transactions(self, project_id, start, end):
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
                    Condition(Column("project_id"), Op.EQ, project_id),
                    Condition(Column("finish_ts"), Op.GTE, start),
                    Condition(Column("finish_ts"), Op.LT, end),
                ],
                groupby=[Column("group_id"), Column("project_id"), Column("event_id")],
                limit=Limit(10000),
                offset=Offset(0),
            ),
        )

        result_snql = raw_snql_query(
            snuba_request,
            referrer=f"{self.migrate_to}._query",
            use_cache=False,
        )

        return result_snql["data"]
