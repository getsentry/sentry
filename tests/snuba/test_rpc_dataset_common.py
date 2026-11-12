from datetime import timedelta
from typing import Any

from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.rpc_dataset_common import LimitBy
from sentry.snuba.spans_rpc import Spans
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class RPCTableLimitByTest(TestCase, SnubaTestCase, SpanTestCase):
    def test_limit_by_caps_rows_per_group(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        other_project = self.create_project(organization=organization)
        timestamp = before_now(minutes=15)

        def span(project: Project, op: str, offset: int) -> dict[str, Any]:
            return self.create_span(
                {"sentry_tags": {"op": op}},
                organization=organization,
                project=project,
                start_ts=timestamp + timedelta(seconds=offset),
            )

        self.store_spans(
            [
                span(project, "http.server", 0),
                span(project, "http.server", 1),
                span(project, "http.server", 2),
                span(project, "db", 3),
                span(project, "db", 4),
                span(project, "cache", 5),
                span(other_project, "queue", 6),
            ]
        )

        result = Spans.run_table_query(
            params=SnubaParams(
                start=timestamp - timedelta(minutes=1),
                end=timestamp + timedelta(minutes=1),
                projects=[project, other_project],
                organization=organization,
            ),
            query_string="",
            selected_columns=["project.id", "span.op", "count()"],
            orderby=["project.id", "-count()"],
            offset=0,
            limit=50,
            referrer="api.organization-events",
            config=SearchResolverConfig(auto_fields=True),
            limit_by=LimitBy(columns=["project.id"], limit=2),
        )

        rows = [(row["project.id"], row["span.op"], row["count()"]) for row in result["data"]]
        assert rows == [
            (project.id, "http.server", 3),
            (project.id, "db", 2),
            (other_project.id, "queue", 1),
        ]
