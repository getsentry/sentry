from datetime import datetime, timedelta
from typing import Any, Dict

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


class BackfillPerformanceIssuesTest(TestMigrations):
    migrate_from = "0371_monitor_make_org_slug_unique"
    migrate_to = "0372_backfill_perf_issue_events_issue_platform"
    QUERY_START_DATE = datetime(2008, 5, 8)
    QUERY_END_DATE = datetime.now() + timedelta(days=2)

    def setup_initial_state(self):
        self.project = self.create_project(name="my_proj")
        self.project.update_option("sentry:performance_issue_creation_rate", 100.0)

        # TODO: add more perf issues to this
        perf_issue_files = [
            "n-plus-one-in-django-index-view",
            "n-plus-one-db-root-parent-span",
        ]

        keys = []
        self.events = []
        self.groups = []
        for file in perf_issue_files:
            event_data = make_event(**get_event(file))
            event = self.__ingest_transaction(event_data, self.project.id)
            self.events.append(event)

            assert (
                len(event.groups) == 1
            )  # TODO: need to update this so an event can be associated with multiple groups
            self.groups.append(event.groups[0])

            assert lookup_event(project_id=self.project.id, event_id=event.event_id)
            keys.append(
                {
                    "project_id": self.project.id,
                    "group_id": event.groups[0].id,
                    "event_id": event.event_id,
                }
            )

        search_issues = self._query_search_issue_events(
            self.project.id, self.QUERY_START_DATE, self.QUERY_END_DATE
        )
        assert len(search_issues) == 0

        rows = self._query_performance_issue_transactions(
            self.project.id, self.QUERY_START_DATE, self.QUERY_END_DATE
        )
        assert len(rows) == len(perf_issue_files)

        assert len(rows) == len(keys)
        self.perf_issue_keys = keys

        assert Group.objects.all().count() == len(perf_issue_files)

    def __ingest_transaction(self, event_data: Dict[str, Any], project_id: int):
        event_data["timestamp"] = (datetime.utcnow() - timedelta(days=1)).isoformat()
        if "datetime" in event_data:
            del event_data["datetime"]
        if "location" in event_data:
            del event_data["location"]
        if "title" in event_data:
            del event_data["title"]

        manager = EventManager(event_data)
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
            event = manager.save(project_id=project_id)

        return event

    def setUp(self):
        super().setUp()
        import time

        # XXX: it takes a while for search_issues to process and hit the db, add a delay to ensure it persists
        time.sleep(5)

    def test_simple(self):
        assert Group.objects.all().count() == len(self.groups)
        assert GroupHash.objects.all().count() == len(self.groups)

        rows = self._query_performance_issue_transactions(
            self.project.id, self.QUERY_START_DATE, self.QUERY_END_DATE
        )
        assert len(rows) == len(self.events)

        search_issues = self._query_search_issue_events(
            self.project.id, self.QUERY_START_DATE, self.QUERY_END_DATE
        )
        assert len(search_issues) == len(self.events)

        event_keys = {key["event_id"] for key in self.perf_issue_keys}
        search_issue_event_keys = {search_issue["event_id"] for search_issue in search_issues}

        assert len(event_keys) == len(search_issue_event_keys)
        assert event_keys == search_issue_event_keys

    def _query_search_issue_events(self, project_id, start, end):
        snuba_request = Request(
            dataset=Dataset.IssuePlatform.value,
            app_id="migration",
            query=Query(
                match=Entity(EntityKey.IssuePlatform.value),
                select=[
                    Column("group_id"),
                    Column("project_id"),
                    Column("event_id"),
                    Column("occurrence_id"),
                ],
                where=[
                    Condition(Column("project_id"), Op.EQ, project_id),
                    Condition(Column("timestamp"), Op.GTE, start),
                    Condition(Column("timestamp"), Op.LT, end),
                ],
                orderby=[
                    OrderBy(Column("project_id"), direction=Direction.ASC),
                    OrderBy(Column("group_id"), direction=Direction.ASC),
                    OrderBy(Column("event_id"), direction=Direction.ASC),
                ],
            ),
        )

        result_snql = raw_snql_query(
            snuba_request,
            referrer=f"{self.migrate_to}._query_search_issue_events",
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
            referrer=f"{self.migrate_to}._query_performance_issue_transactions",
            use_cache=False,
        )

        return result_snql["data"]
