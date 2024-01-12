from datetime import timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import no_silo_test
from sentry.utils.samples import load_data

FEATURE_NAMES = ["organizations:performance-view"]


def make_span_id() -> str:
    return uuid4().hex[:16]


@no_silo_test
class PerformanceTraceDetailTest(AcceptanceTestCase, SnubaTestCase):
    def create_error(self, platform, trace_id, span_id, project_id, timestamp):
        data = load_data(platform, timestamp=timestamp)
        if "contexts" not in data:
            data["contexts"] = {}
        data["contexts"]["trace"] = {"type": "trace", "trace_id": trace_id, "span_id": span_id}
        return self.store_event(data, project_id=project_id)

    def create_transaction(
        self,
        transaction,
        trace_id,
        span_id,
        parent_span_id,
        spans,
        project_id,
        start_timestamp,
        duration,
        transaction_id=None,
    ):
        timestamp = start_timestamp + timedelta(milliseconds=duration)

        data = load_data(
            "transaction",
            trace=trace_id,
            span_id=span_id,
            spans=spans,
            start_timestamp=start_timestamp,
            timestamp=timestamp,
        )
        if transaction_id is not None:
            data["event_id"] = transaction_id
        data["transaction"] = transaction
        data["contexts"]["trace"]["parent_span_id"] = parent_span_id
        return self.store_event(data, project_id=project_id)

    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.frontend_project = self.create_project(
            organization=self.org, teams=[self.team], name="Frontend", platform="javascript"
        )
        self.backend_project = self.create_project(
            organization=self.org, teams=[self.team], name="Backend", platform="python"
        )
        self.service_project = self.create_project(
            organization=self.org, teams=[self.team], name="Service", platform="go"
        )
        self.task_project = self.create_project(
            organization=self.org, teams=[self.team], name="Task", platform="rust"
        )
        self.login_as(self.user)

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.trace_id = "a" * 32

        self.frontend_transaction_id = "b" * 16
        self.frontend_span_ids = [make_span_id() for _ in range(3)]
        self.backend_transaction_ids = [make_span_id() for _ in range(3)]

        # a chain of transactions that are orphans
        self.task_transactions = []
        last_transaction_id = make_span_id()
        for i in range(3):
            transaction_id = make_span_id()
            timestamp = self.day_ago + timedelta(seconds=i, microseconds=30000)
            self.create_error(
                platform="python",
                trace_id=self.trace_id,
                span_id=transaction_id,
                project_id=self.task_project.id,
                timestamp=timestamp,
            )
            self.task_transactions.append(
                self.create_transaction(
                    transaction=f"task_transaction_{i}",
                    trace_id=self.trace_id,
                    span_id=transaction_id,
                    parent_span_id=last_transaction_id,
                    spans=None,
                    project_id=self.task_project.id,
                    start_timestamp=timestamp,
                    duration=700 + 100 * (i + 1),
                )
            )
            last_transaction_id = transaction_id

        # two transactions attached to the same span
        self.service_transaction_s = [
            self.create_transaction(
                transaction=f"service_transaction_{i}",
                trace_id=self.trace_id,
                span_id=make_span_id(),
                parent_span_id=self.backend_transaction_ids[1],
                spans=None,
                project_id=self.service_project.id,
                start_timestamp=self.day_ago
                + timedelta(seconds=1, microseconds=100000 + i * 50000),
                duration=750 * (i + 1),
            )
            for i in range(2)
        ]

        # single transaction attached to the root span
        self.service_transaction_2 = self.create_transaction(
            transaction="service_transaction_2",
            trace_id=self.trace_id,
            span_id=make_span_id(),
            parent_span_id=self.backend_transaction_ids[2],
            spans=None,
            project_id=self.service_project.id,
            start_timestamp=self.day_ago + timedelta(microseconds=400000),
            duration=1000,
        )

        # 3 transactions attached to 3 different spans on the same transaction
        self.backend_transactions = [
            self.create_transaction(
                transaction=f"backend_transaction_{i}",
                trace_id=self.trace_id,
                span_id=backend_transaction_id,
                parent_span_id=frontend_span_id,
                spans=None,
                project_id=self.backend_project.id,
                start_timestamp=self.day_ago + timedelta(microseconds=100000 + i * 50000),
                duration=2500 + i * 500,
            )
            for i, (frontend_span_id, backend_transaction_id) in enumerate(
                zip(self.frontend_span_ids, self.backend_transaction_ids)
            )
        ]

        self.frontend_error = self.create_error(
            platform="javascript",
            trace_id=self.trace_id,
            span_id=self.frontend_span_ids[1],
            project_id=self.frontend_project.id,
            timestamp=self.day_ago,
        )
        self.frontend_transaction = self.create_transaction(
            transaction="frontend_transaction",
            trace_id=self.trace_id,
            span_id=self.frontend_transaction_id,
            parent_span_id=None,
            spans=[
                {
                    "same_process_as_parent": True,
                    "op": "http",
                    "description": f"GET gen1-{i}",
                    "span_id": frontend_span_id,
                    "trace_id": self.trace_id,
                }
                for i, frontend_span_id in enumerate(self.frontend_span_ids)
            ],
            project_id=self.frontend_project.id,
            start_timestamp=self.day_ago,
            duration=4000,
            transaction_id="c" * 32,
        )

    @property
    def path(self):
        return "/organizations/{}/performance/trace/{}/?pageStart={}&pageEnd={}".format(
            self.org.slug,
            self.trace_id,
            iso_format(before_now(days=1).replace(hour=9, minute=0, second=0, microsecond=0)),
            iso_format(before_now(days=1).replace(hour=11, minute=0, second=0, microsecond=0)),
        )

    @patch("django.utils.timezone.now")
    def test_with_data(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=timezone.utc)

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            row_title = self.browser.elements('[data-test-id="transaction-row-title"]')[1]
            # HACK: Use JavaScript to execute click to avoid click intercepted issues
            self.browser.driver.execute_script("arguments[0].click()", row_title)
