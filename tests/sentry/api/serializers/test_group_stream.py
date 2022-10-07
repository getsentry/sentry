from unittest import mock

from freezegun import freeze_time

from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import (
    StreamGroupSerializer,
    StreamGroupSerializerSnuba,
)
from sentry.models import Environment
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType


@region_silo_test
class StreamGroupSerializerTestCase(TestCase):
    def test_environment(self):
        group = self.group

        environment = Environment.get_or_create(group.project, "production")

        from sentry.api.serializers.models.group_stream import tsdb

        with mock.patch(
            "sentry.api.serializers.models.group_stream.tsdb.get_range", side_effect=tsdb.get_range
        ) as get_range:
            serialize(
                [group],
                serializer=StreamGroupSerializer(
                    environment_func=lambda: environment, stats_period="14d"
                ),
            )
            assert get_range.call_count == 1
            for args, kwargs in get_range.call_args_list:
                assert kwargs["environment_ids"] == [environment.id]

        def get_invalid_environment():
            raise Environment.DoesNotExist()

        with mock.patch(
            "sentry.api.serializers.models.group_stream.tsdb.make_series",
            side_effect=tsdb.make_series,
        ) as make_series:
            serialize(
                [group],
                serializer=StreamGroupSerializer(
                    environment_func=get_invalid_environment, stats_period="14d"
                ),
            )
            assert make_series.call_count == 1

    @freeze_time(before_now(days=1).replace(hour=13, minute=30, second=0, microsecond=0))
    def test_perf_issue(self):
        cur_time = before_now(minutes=5)
        event_data = {
            "type": "transaction",
            "level": "info",
            "message": "transaction message",
            "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            "timestamp": cur_time.timestamp(),
            "start_timestamp": cur_time.timestamp(),
            "received": cur_time.timestamp(),
            "fingerprint": [f"{GroupType.PERFORMANCE_N_PLUS_ONE.value}-group1"],
        }
        event = self.store_event(
            data=event_data,
            project_id=self.project.id,
        )
        group = event.groups[0]
        serialized = serialize(group, serializer=StreamGroupSerializerSnuba(stats_period="24h"))
        assert serialized["count"] == "1"
        assert serialized["issueCategory"] == "performance"
        assert serialized["issueType"] == "performance_n_plus_one"
        assert [stat[1] for stat in serialized["stats"]["24h"][:-1]] == [0] * 23
        assert serialized["stats"]["24h"][-1][1] == 1
