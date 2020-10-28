from __future__ import absolute_import

import six

from datetime import timedelta
from django.utils import timezone
from freezegun import freeze_time

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils.compat import map


class GroupEventsTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(GroupEventsTest, self).setUp()
        self.min_ago = before_now(minutes=1)

    def test_simple(self):
        self.login_as(user=self.user)

        event_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "fingerprint": ["1"],
                "timestamp": iso_format(self.min_ago),
            },
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "fingerprint": ["1"],
                "timestamp": iso_format(self.min_ago),
            },
            project_id=self.project.id,
        )

        url = u"/api/0/issues/{}/events/".format(event_1.group.id)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(
            [six.text_type(event_1.event_id), six.text_type(event_2.event_id)]
        )

    def test_tags(self):
        self.login_as(user=self.user)
        event_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "fingerprint": ["1"],
                "tags": {"foo": "baz", "bar": "buz"},
                "timestamp": iso_format(self.min_ago),
            },
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "fingerprint": ["1"],
                "tags": {"bar": "biz"},
                "timestamp": iso_format(before_now(seconds=61)),
            },
            project_id=self.project.id,
        )
        url = u"/api/0/issues/{}/events/".format(event_1.group.id)
        response = self.client.get(url + "?query=foo:baz", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == six.text_type(event_1.event_id)

        response = self.client.get(url + "?query=!foo:baz", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == six.text_type(event_2.event_id)

        response = self.client.get(url + "?query=bar:biz", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == six.text_type(event_2.event_id)

        response = self.client.get(url + "?query=bar:biz%20foo:baz", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + "?query=bar:buz%20foo:baz", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == six.text_type(event_1.event_id)

        response = self.client.get(url + "?query=bar:baz", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + "?query=a:b", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + "?query=bar:b", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + "?query=bar:baz", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + "?query=!bar:baz", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert set([e["eventID"] for e in response.data]) == set(
            [event_1.event_id, event_2.event_id]
        )

    def test_search_event_by_id(self):
        self.login_as(user=self.user)
        event_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "fingerprint": ["group-1"],
                "timestamp": iso_format(self.min_ago),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "fingerprint": ["group-1"],
                "timestamp": iso_format(self.min_ago),
            },
            project_id=self.project.id,
        )
        url = u"/api/0/issues/{}/events/?query={}".format(event_1.group.id, event_1.event_id)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == event_1.event_id

    def test_search_event_by_message(self):
        self.login_as(user=self.user)

        event_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "fingerprint": ["group-1"],
                "message": "foo bar hello world",
                "timestamp": iso_format(self.min_ago),
            },
            project_id=self.project.id,
        )
        group = event_1.group
        event_2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "fingerprint": ["group-1"],
                "message": "this bar hello world",
                "timestamp": iso_format(self.min_ago),
            },
            project_id=self.project.id,
        )
        assert group == event_2.group

        query_1 = "foo"
        query_2 = "hello+world"

        # Single Word Query
        url = u"/api/0/issues/{}/events/?query={}".format(group.id, query_1)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == event_1.event_id

        # Multiple Word Query
        url = u"/api/0/issues/{}/events/?query={}".format(group.id, query_2)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(
            [six.text_type(event_1.event_id), six.text_type(event_2.event_id)]
        )

    def test_search_by_release(self):
        self.login_as(user=self.user)
        self.create_release(self.project, version="first-release")
        event_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "fingerprint": ["group-1"],
                "timestamp": iso_format(self.min_ago),
                "release": "first-release",
            },
            project_id=self.project.id,
        )
        url = u"/api/0/issues/{}/events/?query=release:latest".format(event_1.group.id)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == event_1.event_id

    def test_environment(self):
        self.login_as(user=self.user)
        events = {}

        for name in ["production", "development"]:
            events[name] = self.store_event(
                data={
                    "fingerprint": ["put-me-in-group1"],
                    "timestamp": iso_format(self.min_ago),
                    "environment": name,
                },
                project_id=self.project.id,
            )

        # Asserts that all are in the same group
        (group_id,) = set(e.group.id for e in events.values())

        url = u"/api/0/issues/{}/events/".format(group_id)
        response = self.client.get(url + "?environment=production", format="json")

        assert response.status_code == 200, response.content
        assert set(map(lambda x: x["eventID"], response.data)) == set(
            [six.text_type(events["production"].event_id)]
        )

        response = self.client.get(
            url, data={"environment": ["production", "development"]}, format="json"
        )
        assert response.status_code == 200, response.content
        assert set(map(lambda x: x["eventID"], response.data)) == set(
            [six.text_type(event.event_id) for event in events.values()]
        )

        response = self.client.get(url + "?environment=invalid", format="json")

        assert response.status_code == 200, response.content
        assert response.data == []

        response = self.client.get(
            url + "?environment=production&query=environment:development", format="json"
        )

        assert response.status_code == 200, response.content
        assert response.data == []

    def test_filters_based_on_retention(self):
        self.login_as(user=self.user)
        self.store_event(
            data={"fingerprint": ["group_1"], "timestamp": iso_format(before_now(days=2))},
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={"fingerprint": ["group_1"], "timestamp": iso_format(self.min_ago)},
            project_id=self.project.id,
        )
        group = event_2.group

        with self.options({"system.event-retention-days": 1}):
            response = self.client.get(u"/api/0/issues/{}/events/".format(group.id))

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(
            [six.text_type(event_2.event_id)]
        )

    def test_search_event_has_tags(self):
        self.login_as(user=self.user)
        event = self.store_event(
            data={
                "timestamp": iso_format(self.min_ago),
                "message": "foo",
                "tags": {"logger": "python"},
            },
            project_id=self.project.id,
        )

        response = self.client.get(u"/api/0/issues/{}/events/".format(event.group.id))

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert {"key": "logger", "value": "python"} in response.data[0]["tags"]

    @freeze_time()
    def test_date_filters(self):
        self.login_as(user=self.user)
        event_1 = self.store_event(
            data={"timestamp": iso_format(before_now(days=5)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={"timestamp": iso_format(before_now(days=1)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        group = event_1.group
        assert group == event_2.group

        response = self.client.get(
            u"/api/0/issues/{}/events/".format(group.id), data={"statsPeriod": "6d"}
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(
            [six.text_type(event_1.event_id), six.text_type(event_2.event_id)]
        )

        response = self.client.get(
            u"/api/0/issues/{}/events/".format(group.id), data={"statsPeriod": "2d"}
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == six.text_type(event_2.event_id)

    def test_invalid_period(self):
        self.login_as(user=self.user)
        first_seen = timezone.now() - timedelta(days=5)
        group = self.create_group(first_seen=first_seen)
        response = self.client.get(
            u"/api/0/issues/{}/events/".format(group.id), data={"statsPeriod": "lol"}
        )
        assert response.status_code == 400

    def test_invalid_query(self):
        self.login_as(user=self.user)
        first_seen = timezone.now() - timedelta(days=5)
        group = self.create_group(first_seen=first_seen)
        response = self.client.get(
            u"/api/0/issues/{}/events/".format(group.id),
            data={"statsPeriod": "7d", "query": "foo(bar"},
        )
        assert response.status_code == 400

    def test_multiple_group(self):
        self.login_as(user=self.user)

        event_1 = self.store_event(
            data={
                "fingerprint": ["group_1"],
                "event_id": "a" * 32,
                "message": "foo",
                "timestamp": iso_format(self.min_ago),
            },
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={
                "fingerprint": ["group_2"],
                "event_id": "b" * 32,
                "message": "group2",
                "timestamp": iso_format(self.min_ago),
            },
            project_id=self.project.id,
        )

        for event in (event_1, event_2):
            url = u"/api/0/issues/{}/events/".format(event.group.id)
            response = self.client.get(url, format="json")
            assert response.status_code == 200, response.content
            assert len(response.data) == 1, response.data
            assert map(lambda x: x["eventID"], response.data) == [six.text_type(event.event_id)]
