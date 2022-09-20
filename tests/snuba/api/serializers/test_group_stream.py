import time
from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import StreamGroupSerializerSnuba, snuba_tsdb
from sentry.models import Environment
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.cache import cache
from sentry.utils.hashlib import hash_values


@region_silo_test
class StreamGroupSerializerTestCase(APITestCase, SnubaTestCase):
    def test_environment(self):
        group = self.group

        environment = Environment.get_or_create(group.project, "production")

        with mock.patch(
            "sentry.api.serializers.models.group_stream.snuba_tsdb.get_range",
            side_effect=snuba_tsdb.get_range,
        ) as get_range:
            serialize(
                [group],
                serializer=StreamGroupSerializerSnuba(
                    environment_ids=[environment.id], stats_period="14d"
                ),
            )
            assert get_range.call_count == 1
            for args, kwargs in get_range.call_args_list:
                assert kwargs["environment_ids"] == [environment.id]

        with mock.patch(
            "sentry.api.serializers.models.group.snuba_tsdb.get_range",
            side_effect=snuba_tsdb.get_range,
        ) as get_range:
            serialize(
                [group],
                serializer=StreamGroupSerializerSnuba(environment_ids=None, stats_period="14d"),
            )
            assert get_range.call_count == 1
            for args, kwargs in get_range.call_args_list:
                assert kwargs["environment_ids"] is None

    def test_session_count(self):
        group = self.group

        environment = Environment.get_or_create(group.project, "prod")
        dev_environment = Environment.get_or_create(group.project, "dev")
        no_sessions_environment = Environment.get_or_create(group.project, "no_sessions")

        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_release = "foo@1.0.0"
        self.session_crashed_release = "foo@2.0.0"
        self.store_session(
            {
                "session_id": "5d52fd05-fcc9-4bf3-9dc9-267783670341",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102667",
                "status": "ok",
                "seq": 0,
                "release": self.session_release,
                "environment": "dev",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 1,
                "errors": 0,
                "started": self.session_started - 120,
                "received": self.received - 120,
            }
        )

        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102668",
                "status": "ok",
                "seq": 0,
                "release": self.session_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started - 240,
                "received": self.received - 240,
            }
        )

        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102669",
                "status": "exited",
                "seq": 1,
                "release": self.session_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 30.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        self.store_session(
            {
                "session_id": "a148c0c5-06a2-423b-8901-6b43b812cf82",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102660",
                "status": "crashed",
                "seq": 0,
                "release": self.session_crashed_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        result = serialize(
            [group],
            serializer=StreamGroupSerializerSnuba(stats_period="14d"),
        )
        assert "sessionCount" not in result[0]
        result = serialize(
            [group],
            serializer=StreamGroupSerializerSnuba(
                stats_period="14d",
                expand=["sessions"],
            ),
        )
        assert result[0]["sessionCount"] == 3
        result = serialize(
            [group],
            serializer=StreamGroupSerializerSnuba(
                environment_ids=[environment.id], stats_period="14d", expand=["sessions"]
            ),
        )
        assert result[0]["sessionCount"] == 2

        result = serialize(
            [group],
            serializer=StreamGroupSerializerSnuba(
                environment_ids=[no_sessions_environment.id],
                stats_period="14d",
                expand=["sessions"],
            ),
        )
        assert result[0]["sessionCount"] is None

        result = serialize(
            [group],
            serializer=StreamGroupSerializerSnuba(
                environment_ids=[dev_environment.id], stats_period="14d", expand=["sessions"]
            ),
        )
        assert result[0]["sessionCount"] == 1

        self.store_session(
            {
                "session_id": "a148c0c5-06a2-423b-8901-6b43b812cf83",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102627",
                "status": "ok",
                "seq": 0,
                "release": self.session_release,
                "environment": "dev",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started - 1590061,  # approximately 18 days
                "received": self.received - 1590061,  # approximately 18 days
            }
        )

        result = serialize(
            [group],
            serializer=StreamGroupSerializerSnuba(
                environment_ids=[dev_environment.id],
                stats_period="14d",
                expand=["sessions"],
                start=timezone.now() - timedelta(days=30),
                end=timezone.now() - timedelta(days=15),
            ),
        )
        assert result[0]["sessionCount"] == 1

        # Delete the cache from the query we did above, else this result comes back as 1 instead of 0.5
        key_hash = hash_values([group.project.id, "", "", f"{dev_environment.id}"])
        cache.delete(f"w-s:{key_hash}")
        project2 = self.create_project(
            organization=self.organization, teams=[self.team], name="Another project"
        )
        data = {
            "fingerprint": ["meow"],
            "timestamp": iso_format(timezone.now()),
            "type": "error",
            "exception": [{"type": "Foo"}],
        }
        event = self.store_event(data=data, project_id=project2.id)
        self.store_event(data=data, project_id=project2.id)
        self.store_event(data=data, project_id=project2.id)

        result = serialize(
            [group, event.group],
            serializer=StreamGroupSerializerSnuba(
                environment_ids=[dev_environment.id],
                stats_period="14d",
                expand=["sessions"],
            ),
        )
        assert result[0]["sessionCount"] == 2
        # No sessions in project2
        assert result[1]["sessionCount"] is None
