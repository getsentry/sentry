from datetime import datetime

from sentry.api.serializers import serialize
from sentry.rules.history.base import TimeSeriesValue
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.endpoints.serializers.timeseries_value_serializer import (
    TimeSeriesValueSerializer,
    fetch_workflow_hourly_stats,
)
from sentry.workflow_engine.models import WorkflowFireHistory

pytestmark = [requires_snuba]


class TimeSeriesValueSerializerTest(TestCase):
    def test(self) -> None:
        time_series_value = TimeSeriesValue(datetime.now(), 30)
        result = serialize([time_series_value], self.user, TimeSeriesValueSerializer())
        assert result == [
            {
                "date": time_series_value.bucket,
                "count": time_series_value.count,
            }
        ]


@freeze_time()
class WorkflowHourlyStatsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group()
        self.project = self.group.project
        self.organization = self.project.organization

        self.history: list[WorkflowFireHistory] = []
        self.workflow = self.create_workflow(organization=self.organization)

        for i in range(3):
            for _ in range(i + 1):
                self.history.append(
                    WorkflowFireHistory(
                        workflow=self.workflow,
                        group=self.group,
                    )
                )

        self.workflow_2 = self.create_workflow(organization=self.organization)
        for i in range(2):
            self.history.append(
                WorkflowFireHistory(
                    workflow=self.workflow_2,
                    group=self.group,
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

        self.base_triggered_date = before_now(days=1)

        self.login_as(self.user)

    def test_workflow_hourly_stats(self) -> None:
        results = fetch_workflow_hourly_stats(self.workflow, before_now(hours=6), before_now())
        assert len(results) == 6
        assert [result.count for result in results] == [
            0,
            0,
            3,
            2,
            1,
            0,
        ]  # last zero is for the current hour

    def test_workflow_hourly_stats__past_date_range(self) -> None:
        results = fetch_workflow_hourly_stats(
            self.workflow_2, before_now(hours=6), before_now(hours=2)
        )
        assert len(results) == 4
        assert [result.count for result in results] == [1, 1, 0, 0]
