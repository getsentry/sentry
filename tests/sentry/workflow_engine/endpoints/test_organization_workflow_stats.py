from datetime import timedelta

from django.utils import timezone

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import WorkflowFireHistory

pytestmark = [requires_snuba]


@freeze_time()
class WorkflowStatsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-workflow-stats"

    def setUp(self) -> None:
        super().setUp()

        self.workflow = self.create_workflow(organization=self.organization)
        self.workflow_2 = self.create_workflow(organization=self.organization)

        self.history: list[WorkflowFireHistory] = []
        for i in range(3):
            for _ in range(i + 1):
                self.history.append(
                    WorkflowFireHistory(
                        workflow=self.workflow,
                        group=self.group,
                        date_added=before_now(hours=i + 1),
                    )
                )

        for i in range(2):
            self.history.append(
                WorkflowFireHistory(
                    workflow=self.workflow_2,
                    group=self.group,
                    date_added=before_now(hours=i + 1),
                )
            )

        histories: list[WorkflowFireHistory] = WorkflowFireHistory.objects.bulk_create(self.history)

        # manually update date_added
        index = 0
        for i in range(3):
            for _ in range(i + 1):
                histories[index].update(date_added=before_now(hours=i + 1))
                index += 1

        for i in range(2):
            histories[i + 6].update(date_added=before_now(hours=i + 4))

        self.login_as(self.user)

    def test(self) -> None:
        start = before_now(days=6)
        end = before_now(days=0)
        resp = self.get_success_response(
            self.organization.slug,
            self.workflow.id,
            start=start,
            end=end,
        )
        assert resp.data["meta"] == {
            "dataset": "workflow",
            "start": start.timestamp() * 1000,
            "end": end.timestamp() * 1000,
        }
        time_series = resp.data["timeSeries"][0]
        assert time_series["yAxis"] == "count()"
        assert time_series["meta"] == {
            "interval": 60 * 60 * 1000,
            "valueType": "integer",
            "valueUnit": None,
        }
        assert len(time_series["values"]) == 144
        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        assert time_series["values"][-4:] == [
            {
                "timestamp": (now - timedelta(hours=3)).timestamp() * 1000,
                "value": 3,
                "incomplete": False,
            },
            {
                "timestamp": (now - timedelta(hours=2)).timestamp() * 1000,
                "value": 2,
                "incomplete": False,
            },
            {
                "timestamp": (now - timedelta(hours=1)).timestamp() * 1000,
                "value": 1,
                "incomplete": False,
            },
            {
                "timestamp": now.timestamp() * 1000,
                "value": 0,
                "incomplete": False,
            },
        ]

    def test_one_hour_range_returns_bounds_for_single_bucket(self) -> None:
        start = before_now(hours=1)
        end = before_now()
        resp = self.get_success_response(
            self.organization.slug,
            self.workflow.id,
            start=start,
            end=end,
        )

        assert len(resp.data["timeSeries"][0]["values"]) == 1
        assert resp.data["meta"]["start"] == start.timestamp() * 1000
        assert resp.data["meta"]["end"] == end.timestamp() * 1000

    def test_invalid_dates_error(self) -> None:
        self.get_error_response(
            self.organization.slug,
            self.workflow.id,
            start="This is not a date",
            end=before_now(days=6),
            status_code=400,
        )
