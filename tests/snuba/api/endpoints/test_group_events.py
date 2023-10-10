from datetime import timedelta

from django.utils import timezone

from sentry.issues.grouptype import ProfileFileIOGroupType
from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.silo import region_silo_test
from tests.sentry.issues.test_utils import SearchIssueTestMixin


@region_silo_test
class GroupEventsTest(APITestCase, SnubaTestCase, SearchIssueTestMixin, PerformanceIssueTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.two_min_ago = before_now(minutes=2)
        self.features = {}

    def do_request(self, url):
        with self.feature(self.features):
            return self.client.get(url, format="json")

    def _parse_links(self, header):
        # links come in {url: {...attrs}}, but we need {rel: {...attrs}}
        links = {}
        for url, attrs in parse_link_header(header).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url
        return links

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

        url = f"/api/0/issues/{event_1.group.id}/events/"
        response = self.do_request(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(
            [str(event_1.event_id), str(event_2.event_id)]
        )
        # Should default to full=false which does not include context property
        assert "context" not in response.data[0]
        assert "context" not in response.data[1]

    def test_full_false(self):
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

        url = f"/api/0/issues/{event_1.group.id}/events/?full=false"
        response = self.do_request(url)

        assert response.status_code == 200, response.content
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(
            [str(event_1.event_id), str(event_2.event_id)]
        )
        # Simplified response does not have context property
        assert "context" not in response.data[0]
        assert "context" not in response.data[1]

    def test_full_true(self):
        self.login_as(user=self.user)

        event_1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "fingerprint": ["1"],
                "timestamp": iso_format(self.min_ago),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "fingerprint": ["1"],
                "timestamp": iso_format(self.min_ago),
            },
            project_id=self.project.id,
        )

        url = f"/api/0/issues/{event_1.group.id}/events/?full=true"
        response = self.do_request(url)

        assert response.status_code == 200, response.content

        # Full response has context property
        assert "context" in response.data[0]
        assert "context" in response.data[1]

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
        url = f"/api/0/issues/{event_1.group.id}/events/"
        response = self.do_request(url + "?query=foo:baz")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == str(event_1.event_id)

        response = self.do_request(url + "?query=!foo:baz")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == str(event_2.event_id)

        response = self.do_request(url + "?query=bar:biz")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == str(event_2.event_id)

        response = self.do_request(url + "?query=bar:biz%20foo:baz")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.do_request(url + "?query=bar:buz%20foo:baz")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == str(event_1.event_id)

        response = self.do_request(url + "?query=bar:baz")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.do_request(url + "?query=a:b")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.do_request(url + "?query=bar:b")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.do_request(url + "?query=bar:baz")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.do_request(url + "?query=!bar:baz")
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert {e["eventID"] for e in response.data} == {event_1.event_id, event_2.event_id}

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
        url = f"/api/0/issues/{event_1.group.id}/events/?query={event_1.event_id}"
        response = self.do_request(url)

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
        url = f"/api/0/issues/{group.id}/events/?query={query_1}"
        response = self.do_request(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == event_1.event_id

        # Multiple Word Query
        url = f"/api/0/issues/{group.id}/events/?query={query_2}"
        response = self.do_request(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(
            [str(event_1.event_id), str(event_2.event_id)]
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
        url = f"/api/0/issues/{event_1.group.id}/events/?query=release:latest"
        response = self.do_request(url)

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
        (group_id,) = {e.group.id for e in events.values()}

        url = f"/api/0/issues/{group_id}/events/"
        response = self.do_request(url + "?environment=production")

        assert response.status_code == 200, response.content
        assert set(map(lambda x: x["eventID"], response.data)) == {
            str(events["production"].event_id)
        }

        response = self.client.get(
            url, data={"environment": ["production", "development"]}, format="json"
        )
        assert response.status_code == 200, response.content
        assert set(map(lambda x: x["eventID"], response.data)) == {
            str(event.event_id) for event in events.values()
        }

        response = self.do_request(url + "?environment=invalid")

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
            response = self.client.get(f"/api/0/issues/{group.id}/events/")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted([str(event_2.event_id)])

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

        response = self.client.get(f"/api/0/issues/{event.group.id}/events/")

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

        response = self.client.get(f"/api/0/issues/{group.id}/events/", data={"statsPeriod": "6d"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(
            [str(event_1.event_id), str(event_2.event_id)]
        )

        response = self.client.get(f"/api/0/issues/{group.id}/events/", data={"statsPeriod": "2d"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == str(event_2.event_id)

    def test_invalid_period(self):
        self.login_as(user=self.user)
        first_seen = timezone.now() - timedelta(days=5)
        group = self.create_group(first_seen=first_seen)
        response = self.client.get(f"/api/0/issues/{group.id}/events/", data={"statsPeriod": "lol"})
        assert response.status_code == 400

    def test_invalid_query(self):
        self.login_as(user=self.user)
        first_seen = timezone.now() - timedelta(days=5)
        group = self.create_group(first_seen=first_seen)
        response = self.client.get(
            f"/api/0/issues/{group.id}/events/",
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
            url = f"/api/0/issues/{event.group.id}/events/"
            response = self.do_request(url)
            assert response.status_code == 200, response.content
            assert len(response.data) == 1, response.data
            assert list(map(lambda x: x["eventID"], response.data)) == [str(event.event_id)]

    def test_pagination(self):
        self.login_as(user=self.user)

        for _ in range(2):
            event = self.store_event(
                data={
                    "fingerprint": ["group_1"],
                    "event_id": "a" * 32,
                    "message": "foo",
                    "timestamp": iso_format(self.min_ago),
                },
                project_id=self.project.id,
            )

        url = f"/api/0/issues/{event.group.id}/events/?per_page=1"
        response = self.do_request(url)
        links = self._parse_links(response["Link"])
        assert response.status_code == 200, response.content
        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"
        assert len(response.data) == 1

    def test_orderby(self):
        self.login_as(user=self.user)

        event = self.store_event(
            data={
                "fingerprint": ["group_1"],
                "event_id": "a" * 32,
                "message": "foo",
                "timestamp": iso_format(self.min_ago),
            },
            project_id=self.project.id,
        )
        event = self.store_event(
            data={
                "fingerprint": ["group_1"],
                "event_id": "b" * 32,
                "message": "foo",
                "timestamp": iso_format(self.two_min_ago),
            },
            project_id=self.project.id,
        )

        url = f"/api/0/issues/{event.group.id}/events/"
        response = self.do_request(url)
        assert len(response.data) == 2
        assert response.data[0]["eventID"] == "a" * 32
        assert response.data[1]["eventID"] == "b" * 32

    def test_perf_issue(self):
        event_1 = self.create_performance_issue()
        event_2 = self.create_performance_issue()

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event_1.group.id}/events/"
        response = self.do_request(url)

        assert response.status_code == 200, response.content
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(
            [str(event_1.event_id), str(event_2.event_id)]
        )

    def test_generic_issue(self):
        event_1, _, group_info = self.store_search_issue(
            self.project.id,
            self.user.id,
            [f"{ProfileFileIOGroupType.type_id}-group1"],
            "prod",
            before_now(hours=1).replace(tzinfo=timezone.utc),
        )
        assert group_info is not None
        event_2, _, _ = self.store_search_issue(
            self.project.id,
            self.user.id,
            [f"{ProfileFileIOGroupType.type_id}-group1"],
            "prod",
            before_now(hours=1).replace(tzinfo=timezone.utc),
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group_info.group.id}/events/"
        response = self.do_request(url)

        assert response.status_code == 200, response.content
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(
            [str(event_1.event_id), str(event_2.event_id)]
        )
