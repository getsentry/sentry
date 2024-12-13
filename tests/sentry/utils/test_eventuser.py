from __future__ import annotations

from datetime import timedelta
from unittest import mock
from unittest.mock import call

from django.utils import timezone
from snuba_sdk import BooleanOp

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.utils.eventuser import EventUser

now = before_now(days=1).replace(minute=10, second=0, microsecond=0, tzinfo=None)


@freeze_time(now)
class EventUserTestCase(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.project = self.create_project(date_added=(timezone.now() - timedelta(hours=2)))

        self.event_1 = self.store_event(
            data={
                "user": {
                    "id": 1,
                    "email": "foo@example.com",
                    "username": "foobar",
                    "ip_address": "127.0.0.1",
                },
                "timestamp": before_now(seconds=10).isoformat(),
            },
            project_id=self.project.id,
        )

        self.event_2 = self.store_event(
            data={
                "user": {
                    "id": 2,
                    "email": "nisanthan@sentry.io",
                    "username": "nisanthan",
                    "ip_address": "1.1.1.1",
                },
                "timestamp": before_now(seconds=20).isoformat(),
            },
            project_id=self.project.id,
        )

        self.event_3 = self.store_event(
            data={
                "user": {
                    "id": "myminion",
                    "email": "minion@universal.com",
                    "username": "minion",
                    "ip_address": "8.8.8.8",
                },
                "timestamp": before_now(seconds=30).isoformat(),
            },
            project_id=self.project.id,
        )

    @mock.patch("sentry.analytics.record")
    def test_for_projects_query_filter_id(self, mock_record):
        with mock.patch("time.time") as mock_time:
            mock_time.return_value = 0
            euser = EventUser.for_projects([self.project], {"id": ["2"]}, result_limit=1)

        assert len(euser) == 1
        assert euser[0].user_ident == self.event_2.data.get("user").get("id")
        assert euser[0].email == self.event_2.data.get("user").get("email")

        mock_record.assert_has_calls(
            [
                call(
                    "eventuser_snuba.query",
                    project_ids=[self.project.id],
                    query=f"MATCH (events)\nSELECT project_id, ip_address_v6, ip_address_v4, user_id, user_name, "
                    f"user_email, max(timestamp) AS `latest_timestamp`\nBY project_id, ip_address_v6, "
                    f"ip_address_v4, user_id, user_name, user_email\n"
                    f"WHERE project_id IN array({self.project.id}) AND timestamp < toDateTime('{now.isoformat()}') "
                    f"AND timestamp >= toDateTime('{(now - timedelta(hours=2)).isoformat()}') "
                    f"AND user_id IN array('2')\n"
                    f"ORDER BY latest_timestamp DESC\n"
                    f"LIMIT 1\nOFFSET 0",
                    query_try=0,
                    count_rows_returned=1,
                    count_rows_filtered=0,
                    query_time_ms=0,
                ),
                call(
                    "eventuser_snuba.for_projects",
                    project_ids=[self.project.id],
                    total_tries=1,
                    total_rows_returned=1,
                    total_time_ms=0,
                ),
            ],
        )

    def test_for_projects_query_filter_username(self):
        euser = EventUser.for_projects([self.project], {"username": ["minion"]}, result_limit=1)
        assert len(euser) == 1
        assert euser[0].user_ident == self.event_3.data.get("user").get("id")
        assert euser[0].email == self.event_3.data.get("user").get("email")

    def test_for_projects_query_filter_email(self):
        euser = EventUser.for_projects(
            [self.project], {"email": ["foo@example.com"]}, result_limit=1
        )
        assert len(euser) == 1
        assert euser[0].user_ident == self.event_1.data.get("user").get("id")
        assert euser[0].email == self.event_1.data.get("user").get("email")

    def test_for_projects_query_filter_ip(self):
        euser = EventUser.for_projects([self.project], {"ip": ["8.8.8.8"]}, result_limit=1)
        assert len(euser) == 1
        assert euser[0].user_ident == self.event_3.data.get("user").get("id")
        assert euser[0].email == self.event_3.data.get("user").get("email")

    def test_for_projects_query_multiple_OR_filters(self):
        eusers = EventUser.for_projects(
            [self.project],
            {"username": ["minion"], "email": ["foo@example.com"]},
            filter_boolean=BooleanOp.OR,
        )
        assert len(eusers) == 2

    def test_for_projects_query_multiple_AND_filters(self):
        eusers = EventUser.for_projects(
            [self.project],
            {"username": ["minion"], "email": ["minion@universal.com"], "ip": ["8.8.8.8"]},
        )
        assert len(eusers) == 1
        assert eusers[0].user_ident == self.event_3.data.get("user").get("id")
        assert eusers[0].email == self.event_3.data.get("user").get("email")

    def test_for_projects_query_with_multiple_eventuser_entries_different_ips(self):
        for i in range(10):
            self.store_event(
                data={
                    "user": {
                        "id": 2,
                        "email": "nisanthan@sentry.io",
                        "username": "nisanthan",
                        "ip_address": f"1.1.1.{i}",
                    },
                    "timestamp": before_now(seconds=30 + i).isoformat(),
                },
                project_id=self.project.id,
            )

        eusers = EventUser.for_projects(
            [self.project],
            {"username": ["nisanthan"]},
            filter_boolean=BooleanOp.OR,
        )
        assert len(eusers) == 1
        assert eusers[0].user_ident == self.event_2.data.get("user").get("id")
        assert eusers[0].email == self.event_2.data.get("user").get("email")
        assert eusers[0].ip_address == self.event_2.data.get("user").get("ip_address")

    def test_for_projects_query_with_multiple_eventuser_entries_different_ips_query_by_ip(self):
        for i in range(5):
            self.store_event(
                data={
                    "user": {
                        "id": 2,
                        "email": "nisanthan@sentry.io",
                        "username": "nisanthan",
                        "ip_address": f"1.1.1.{i}",
                    },
                    "timestamp": before_now(seconds=30 + i).isoformat(),
                },
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    "user": {
                        "id": "myminion",
                        "email": "minion@universal.com",
                        "username": "minion",
                        "ip_address": f"8.8.8.{i}",
                    },
                    "timestamp": before_now(seconds=40 + i).isoformat(),
                },
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    "user": {
                        "id": "gru",
                        "email": "gru@universal.com",
                        "username": "gru",
                        "ip_address": f"2001:0db8:0000:85a3:0000:0000:ac1f:800{i}",
                    },
                    "timestamp": before_now(seconds=50 + i).isoformat(),
                },
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    "user": {
                        "id": "scarlet",
                        "email": "scarlet@universal.com",
                        "username": "scarlet",
                        "ip_address": f"2001:db8:0:85a3::ac1f:{i}008",
                    },
                    "timestamp": before_now(seconds=60 + i).isoformat(),
                },
                project_id=self.project.id,
            )

        eusers = EventUser.for_projects(
            [self.project],
            {
                "ip": [
                    "2001:0db8:0000:85a3:0000:0000:ac1f:3008",
                    "2001:db8:0:85a3::ac1f:8001",
                    "8.8.8.4",
                    "1.1.1.2",
                ]
            },
            filter_boolean=BooleanOp.OR,
        )
        assert len(eusers) == 4
        assert eusers[0].email == "nisanthan@sentry.io"
        assert eusers[0].ip_address == "1.1.1.2"
        assert eusers[1].email == "minion@universal.com"
        assert eusers[1].ip_address == "8.8.8.4"
        assert eusers[2].email == "gru@universal.com"
        assert eusers[2].ip_address == "2001:db8:0:85a3::ac1f:8001"
        assert eusers[3].email == "scarlet@universal.com"
        assert eusers[3].ip_address == "2001:db8:0:85a3::ac1f:3008"

    @mock.patch("sentry.analytics.record")
    def test_for_projects_query_with_multiple_eventuser_entries_different_ips_query_by_username(
        self, mock_record
    ):
        for i in range(10):
            self.store_event(
                data={
                    "user": {
                        "id": 2,
                        "email": "nisanthan@sentry.io",
                        "username": "nisanthan",
                        "ip_address": f"1.1.1.{i}",
                    },
                    "timestamp": before_now(seconds=30 + i).isoformat(),
                },
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    "user": {
                        "id": "myminion",
                        "email": "minion@universal.com",
                        "username": "minion",
                        "ip_address": f"2001:0db8:0000:85a3:0000:0000:ac1f:800{i}",
                    },
                    "timestamp": before_now(seconds=40 + i).isoformat(),
                },
                project_id=self.project.id,
            )

        with mock.patch("time.time") as mock_time:
            # Define the mock values for time.time()
            mock_time.return_value = 1000

            eusers = EventUser.for_projects(
                [self.project],
                {"username": ["nisanthan", "minion"]},
                filter_boolean=BooleanOp.OR,
            )

        assert len(eusers) == 2
        assert eusers[0].user_ident == self.event_2.data.get("user").get("id")
        assert eusers[0].email == self.event_2.data.get("user").get("email")
        assert eusers[0].ip_address == self.event_2.data.get("user").get("ip_address")
        assert eusers[1].user_ident == self.event_3.data.get("user").get("id")
        assert eusers[1].email == self.event_3.data.get("user").get("email")
        assert eusers[1].ip_address == self.event_3.data.get("user").get("ip_address")

        mock_record.assert_has_calls(
            [
                call(
                    "eventuser_snuba.query",
                    project_ids=[self.project.id],
                    query=f"MATCH (events)\nSELECT project_id, ip_address_v6, ip_address_v4, user_id, user_name, "
                    f"user_email, max(timestamp) AS `latest_timestamp`\nBY project_id, ip_address_v6, "
                    f"ip_address_v4, user_id, user_name, user_email\n"
                    f"WHERE project_id IN array({self.project.id}) AND timestamp < toDateTime('{now.isoformat()}') "
                    f"AND timestamp >= toDateTime('{(now - timedelta(hours=2)).isoformat()}') "
                    f"AND user_name IN array('nisanthan', 'minion')\n"
                    f"ORDER BY latest_timestamp DESC",
                    query_try=0,
                    count_rows_returned=21,
                    count_rows_filtered=19,
                    query_time_ms=0,
                ),
                call(
                    "eventuser_snuba.for_projects",
                    project_ids=[self.project.id],
                    total_tries=1,
                    total_rows_returned=2,
                    total_time_ms=0,
                ),
            ],
        )

    @mock.patch("sentry.utils.eventuser.OVERFETCH_FACTOR", new=2)
    @mock.patch("sentry.analytics.record")
    def test_for_projects_multiple_query(self, mock_record):
        id_1 = "test1"
        email_1 = "test@sentry.io"
        for i in range(6):
            self.store_event(
                data={
                    "user": {
                        "id": id_1,
                        "email": email_1,
                        "username": "test",
                        "ip_address": f"1.1.1.{i}",
                    },
                    "timestamp": before_now(seconds=30 + i).isoformat(),
                },
                project_id=self.project.id,
            )
        id_2 = "test2"
        email_2 = "test2@sentry.io"
        for i in range(5, 8):
            self.store_event(
                data={
                    "user": {
                        "id": "test2",
                        "email": email_2,
                        "username": "test2",
                        "ip_address": f"2001:0db8:0000:85a3:0000:0000:ac1f:800{i}",
                    },
                    "timestamp": before_now(minutes=60 + i).isoformat(),
                },
                project_id=self.project.id,
            )

        with mock.patch("time.time") as mock_time:
            # Define the mock values for time.time()
            mock_time.return_value = 1000

            eusers = EventUser.for_projects(
                [self.project],
                {"username": ["test", "test2"]},
                filter_boolean=BooleanOp.OR,
                result_limit=2,
            )

        assert len(eusers) == 2
        assert eusers[0].user_ident == id_1
        assert eusers[0].email == email_1
        assert eusers[0].ip_address == "1.1.1.0"
        assert eusers[1].user_ident == id_2
        assert eusers[1].email == email_2
        assert eusers[1].ip_address == "2001:db8:0:85a3::ac1f:8005"

        mock_record.assert_has_calls(
            [
                call(
                    "eventuser_snuba.query",
                    project_ids=[self.project.id],
                    query=f"MATCH (events)\nSELECT project_id, ip_address_v6, ip_address_v4, user_id, user_name, "
                    f"user_email, max(timestamp) AS `latest_timestamp`\nBY project_id, ip_address_v6, "
                    f"ip_address_v4, user_id, user_name, user_email\n"
                    f"WHERE project_id IN array({self.project.id}) AND timestamp < toDateTime('{now.isoformat()}') "
                    f"AND timestamp >= toDateTime('{(now - timedelta(hours=2)).isoformat()}') "
                    f"AND user_name IN array('test', 'test2')\n"
                    f"ORDER BY latest_timestamp DESC\n"
                    f"LIMIT 5\nOFFSET 0",
                    query_try=0,
                    count_rows_returned=5,
                    count_rows_filtered=4,
                    query_time_ms=0,
                ),
                call(
                    "eventuser_snuba.query",
                    project_ids=[self.project.id],
                    query=f"MATCH (events)\nSELECT project_id, ip_address_v6, ip_address_v4, user_id, user_name, "
                    f"user_email, max(timestamp) AS `latest_timestamp`\nBY project_id, ip_address_v6, "
                    f"ip_address_v4, user_id, user_name, user_email\n"
                    f"WHERE project_id IN array({self.project.id}) AND timestamp < toDateTime('{now.isoformat()}') "
                    f"AND timestamp >= toDateTime('{(now - timedelta(hours=2)).isoformat()}') "
                    f"AND user_name IN array('test', 'test2')\n"
                    f"ORDER BY latest_timestamp DESC\n"
                    f"LIMIT 5\nOFFSET 5",
                    query_try=1,
                    count_rows_returned=4,
                    count_rows_filtered=3,
                    query_time_ms=0,
                ),
                call(
                    "eventuser_snuba.for_projects",
                    project_ids=[self.project.id],
                    total_tries=2,
                    total_rows_returned=2,
                    total_time_ms=0,
                ),
            ],
        )

    def test_tag_value_primary_is_user_ident(self):
        euser = EventUser.for_projects([self.project], {"id": ["2"]}, result_limit=1)
        assert len(euser) == 1
        assert euser[0].user_ident == "2"
        assert euser[0].tag_value == "id:2"

    def test_tag_value_primary_is_username(self):
        self.store_event(
            data={
                "user": {
                    "id": None,
                    "email": "cocoa@universal.com",
                    "username": "cocoa",
                    "ip_address": "8.8.8.8",
                },
                "timestamp": before_now(seconds=30).isoformat(),
            },
            project_id=self.project.id,
        )
        euser = EventUser.for_projects([self.project], {"username": ["cocoa"]}, result_limit=1)
        assert len(euser) == 1
        assert euser[0].user_ident is None
        assert euser[0].tag_value == "username:cocoa"

    def test_tag_value_primary_is_email(self):
        self.store_event(
            data={
                "user": {
                    "id": None,
                    "email": "cocoa@universal.com",
                    "username": None,
                    "ip_address": "8.8.8.8",
                },
                "timestamp": before_now(seconds=30).isoformat(),
            },
            project_id=self.project.id,
        )
        euser = EventUser.for_projects(
            [self.project], {"email": ["cocoa@universal.com"]}, result_limit=1
        )
        assert len(euser) == 1
        assert euser[0].user_ident is None
        assert euser[0].username is None
        assert euser[0].tag_value == "email:cocoa@universal.com"

    def test_tag_value_primary_is_ip(self):
        self.store_event(
            data={
                "user": {
                    "id": None,
                    "email": None,
                    "username": None,
                    "ip_address": "8.8.8.1",
                },
                "timestamp": before_now(seconds=30).isoformat(),
            },
            project_id=self.project.id,
        )
        euser = EventUser.for_projects([self.project], {"ip": ["8.8.8.1"]}, result_limit=1)
        assert len(euser) == 1
        assert euser[0].user_ident is None
        assert euser[0].username is None
        assert euser[0].email is None
        assert euser[0].tag_value == "ip:8.8.8.1"

    def test_for_tags(self):
        assert EventUser.for_tags(self.project.id, ["id:myminion"]) == {
            "id:myminion": EventUser.from_event(self.event_3)
        }
        assert EventUser.for_tags(self.project.id, ["id:doesnotexist"]) == {}
        assert EventUser.for_tags(self.project.id, ["id:myminion", "id:doesnotexist", "id:2"]) == {
            "id:myminion": EventUser.from_event(self.event_3),
            "id:2": EventUser.from_event(self.event_2),
        }
