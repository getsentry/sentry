from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.eventuser import EventUser


@region_silo_test(stable=True)
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
                "timestamp": iso_format(before_now(seconds=10)),
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
                "timestamp": iso_format(before_now(seconds=20)),
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
                "timestamp": iso_format(before_now(seconds=30)),
            },
            project_id=self.project.id,
        )

    def test_for_projects_query_filter_id(self):
        euser = EventUser.for_projects([self.project], {"id": ["2"]})
        assert len(euser) == 1
        assert euser[0].user_ident == "2"
        assert euser[0].email == "nisanthan@sentry.io"

    def test_for_projects_query_filter_username(self):
        euser = EventUser.for_projects([self.project], {"username": ["minion"]})
        assert len(euser) == 1
        assert euser[0].user_ident == "myminion"
        assert euser[0].email == "minion@universal.com"

    def test_for_projects_query_filter_email(self):
        euser = EventUser.for_projects([self.project], {"email": ["foo@example.com"]})
        assert len(euser) == 1
        assert euser[0].user_ident == "1"
        assert euser[0].email == "foo@example.com"

    def test_for_projects_query_filter_ip(self):
        euser = EventUser.for_projects([self.project], {"ip": ["8.8.8.8"]})
        assert len(euser) == 1
        assert euser[0].user_ident == "myminion"
        assert euser[0].email == "minion@universal.com"

    def test_for_projects_query_multiple_OR_filters(self):
        eusers = EventUser.for_projects(
            [self.project],
            {"username": ["minion"], "email": ["foo@example.com"]},
            filter_boolean="OR",
            return_all=True,
        )
        assert len(eusers) == 2

    def test_for_projects_query_multiple_AND_filters(self):
        eusers = EventUser.for_projects(
            [self.project],
            {"username": ["minion"], "email": ["minion@universal.com"], "ip": ["8.8.8.8"]},
            return_all=True,
        )
        assert len(eusers) == 1

    def test_tag_value_primary_is_user_ident(self):
        euser = EventUser.for_projects([self.project], {"id": ["2"]})
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
                "timestamp": iso_format(before_now(seconds=30)),
            },
            project_id=self.project.id,
        )
        euser = EventUser.for_projects([self.project], {"username": ["cocoa"]})
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
                "timestamp": iso_format(before_now(seconds=30)),
            },
            project_id=self.project.id,
        )
        euser = EventUser.for_projects([self.project], {"email": ["cocoa@universal.com"]})
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
                "timestamp": iso_format(before_now(seconds=30)),
            },
            project_id=self.project.id,
        )
        euser = EventUser.for_projects([self.project], {"ip": ["8.8.8.1"]})
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
        assert EventUser.for_tags(self.project.id, ["id:myminion", "id:doesnotexist"]) == {
            "id:myminion": EventUser.from_event(self.event_3)
        }
