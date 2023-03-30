import random
from datetime import datetime, timedelta
from typing import Any, Dict, List
from unittest.mock import patch

from sentry.models.group import Group, GroupStatus
from sentry.models.groupforecast import GroupForecast
from sentry.models.groupsnooze import GroupSnooze
from sentry.tasks.weekly_escalating_forecast import run_escalating_forecast
from sentry.testutils.cases import APITestCase, SnubaTestCase


class TestWeeklyEscalatingForecast(APITestCase, SnubaTestCase):
    def get_mock_response(
        self, num_days: int, num_hours: int, groups: List[Group]
    ) -> Dict[str, Any]:
        data = []
        now = datetime.now()

        for group in groups:
            for day in range(num_days, 0, -1):
                time = now - timedelta(days=day)

                for hour in range(num_hours, 0, -1):
                    hourly_time = time - timedelta(hours=hour)
                    data.append(
                        {
                            "group_id": group.id,
                            "hourBucket": hourly_time.strftime("%Y-%m-%dT%H:%M:%S%f") + "+00:00",
                            "count()": random.randint(1, 10),
                        }
                    )

        return {
            "data": data,
            "meta": [
                {"name": "group_id", "type": "UInt64"},
                {"name": "hourBucket", "type": "DateTime"},
                {"name": "count()", "type": "UInt64"},
            ],
            "profile": {"bytes": 672, "blocks": 1, "rows": 16, "elapsed": 0.0073261260986328125},
            "trace_output": "",
            "timing": {
                "timestamp": 1679923790,
                "duration_ms": 34,
                "marks_ms": {
                    "cache_get": 0,
                    "cache_set": 1,
                    "execute": 7,
                    "get_configs": 0,
                    "prepare_query": 9,
                    "rate_limit": 1,
                    "validate_schema": 13,
                },
                "tags": {},
            },
        }

    @patch("sentry.tasks.weekly_escalating_forecast.query_groups_past_counts")
    def test_single_group_escalating_forecast(self, mock_query_groups_past_counts):
        group = self.create_group()
        group.status = GroupStatus.IGNORED
        group.save()

        group_snooze = GroupSnooze.objects.create(
            group=group,
            user_count=10,
            until=datetime.now() + timedelta(days=1),
            count=10,
            state={"times_seen": 0},
            until_escalating=True,
        )
        group_snooze.save()

        mock_query_groups_past_counts.return_value = self.get_mock_response(7, 1, [group])

        run_escalating_forecast()
        group_forecast = GroupForecast.objects.all()
        assert len(group_forecast) == 1
        assert group_forecast[0].group == group
