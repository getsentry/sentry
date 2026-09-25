from sentry.models.group import Group
from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now

FORMATTER_FEATURE = "organizations:issue-standardized-markdown-for-llm"
BOOLEAN_SEARCH_FEATURE = "organizations:issue-details-boolean-search"


class GroupEventDetailsTest(APITestCase, SnubaTestCase, PerformanceIssueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

        project = self.create_project()
        min_ago = before_now(minutes=1).isoformat()
        two_min_ago = before_now(minutes=2).isoformat()

        self.event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "fingerprint": ["group_1"],
                "timestamp": two_min_ago,
                "tags": {"region": "us"},
            },
            project_id=project.id,
        )

        self.event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "production",
                "fingerprint": ["group_1"],
                "timestamp": min_ago,
                "tags": {"region": "de"},
                "exception": {
                    "values": [
                        {
                            "type": "ValueError",
                            "value": "example",
                            "mechanism": {"type": "generic", "handled": True},
                        }
                    ]
                },
            },
            project_id=project.id,
        )

        self.group = Group.objects.first()

    def test_snuba_no_environment_latest(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/latest/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["id"] == str(self.event2.event_id)

    def test_snuba_no_environment_oldest(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/oldest/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["id"] == str(self.event1.event_id)

    def test_snuba_no_environment_event_id(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/{self.event1.event_id}/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["id"] == str(self.event1.event_id)

    def test_snuba_environment_latest(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/latest/"
        response = self.client.get(url, format="json", data={"environment": ["production"]})

        assert response.status_code == 200
        assert response.data["id"] == str(self.event2.event_id)

    def test_snuba_environment_oldest(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/oldest/"
        response = self.client.get(url, format="json", data={"environment": ["production"]})

        assert response.status_code == 200
        assert response.data["id"] == str(self.event2.event_id)

    def test_snuba_environment_event_id(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/{self.event2.event_id}/"
        response = self.client.get(url, format="json", data={"environment": ["production"]})

        assert response.status_code == 200
        assert response.data["id"] == str(self.event2.event_id)

    def test_simple_latest(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/latest/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["eventID"] == str(self.event2.event_id)

    def test_simple_oldest(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/oldest/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["id"] == str(self.event1.event_id)

    def test_simple_event_id(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/{self.event1.event_id}/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["id"] == str(self.event1.event_id)

    def test_perf_issue_latest(self) -> None:
        event = self.create_performance_issue()
        assert event.group is not None
        url = (
            f"/api/0/organizations/{self.organization.slug}/issues/{event.group.id}/events/latest/"
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["eventID"] == event.event_id

    def test_perf_issue_oldest(self) -> None:
        event = self.create_performance_issue()
        assert event.group is not None
        url = (
            f"/api/0/organizations/{self.organization.slug}/issues/{event.group.id}/events/oldest/"
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["eventID"] == event.event_id

    def test_perf_issue_event_id(self) -> None:
        event = self.create_performance_issue()
        assert event.group is not None
        url = f"/api/0/organizations/{self.organization.slug}/issues/{event.group.id}/events/{event.event_id}/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["eventID"] == event.event_id

    def test_invalid_query(self) -> None:
        event = self.create_performance_issue()
        assert event.group is not None
        url = f"/api/0/organizations/{self.organization.slug}/issues/{event.group.id}/events/{event.event_id}/"
        response = self.client.get(url, format="json", data={"query": "release.version:foobar"})
        assert response.status_code == 400

    def test_boolean_query(self) -> None:
        self.store_event(
            data={
                "fingerprint": ["group_1"],
                "timestamp": before_now(seconds=30).isoformat(),
                "tags": {"region": "ca"},
            },
            project_id=self.group.project_id,
        )
        self.store_event(
            data={
                "fingerprint": ["another_issue"],
                "timestamp": before_now(seconds=15).isoformat(),
                "tags": {"region": "us"},
                "exception": self.event2.data["exception"],
            },
            project_id=self.group.project_id,
        )
        with self.feature(BOOLEAN_SEARCH_FEATURE):
            for event_id, query, expected_id in [
                ("oldest", 'region:"us" OR handled:yes', self.event1.event_id),
                ("latest", 'region:"us" OR handled:yes', self.event2.event_id),
                ("recommended", 'region:"us" OR handled:yes', self.event2.event_id),
                ("latest", "region:us OR region:de", self.event2.event_id),
                (
                    "oldest",
                    "(region:us OR handled:yes) environment:production",
                    self.event2.event_id,
                ),
                (
                    "latest",
                    "region:us OR (handled:yes AND environment:staging)",
                    self.event1.event_id,
                ),
            ]:
                url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/{event_id}/"
                response = self.client.get(url, {"query": query})
                assert response.status_code == 200, response.content
                assert response.data["id"] == expected_id, (event_id, query)

    def test_boolean_query_navigation(self) -> None:
        self.store_event(
            data={
                "fingerprint": ["group_1"],
                "timestamp": before_now(seconds=90).isoformat(),
                "tags": {"region": "ca"},
            },
            project_id=self.group.project_id,
        )
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/{self.event1.event_id}/"

        for snql_enabled in (False, True):
            with (
                self.feature(BOOLEAN_SEARCH_FEATURE),
                self.options({"eventstore.adjacent_event_ids_use_snql": snql_enabled}),
            ):
                first = self.client.get(url, {"query": "region:us OR handled:yes"})
                last = self.client.get(
                    url.replace(self.event1.event_id, self.event2.event_id),
                    {"query": "region:us OR handled:yes"},
                )

            assert first.status_code == 200, first.content
            assert first.data["nextEventID"] == self.event2.event_id
            assert first.data["previousEventID"] is None
            assert last.status_code == 200, last.content
            assert last.data["previousEventID"] == self.event1.event_id
            assert last.data["nextEventID"] is None

    def test_boolean_query_respects_environment_and_dates(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/latest/"
        with self.feature(BOOLEAN_SEARCH_FEATURE):
            for params in [
                {"environment": "staging"},
                {
                    "start": before_now(minutes=3).isoformat(),
                    "end": before_now(seconds=90).isoformat(),
                },
            ]:
                response = self.client.get(url, {"query": "region:us OR handled:yes", **params})
                assert response.status_code == 200, response.content
                assert response.data["id"] == self.event1.event_id
                assert response.data["nextEventID"] is None

    def test_boolean_query_disabled(self) -> None:
        with self.feature({BOOLEAN_SEARCH_FEATURE: False}):
            response = self.client.get(self._latest_url(), {"query": "region:us OR handled:yes"})

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid event query"

    def test_issue_filters_with_boolean_search_enabled(self) -> None:
        with self.feature(BOOLEAN_SEARCH_FEATURE):
            for query, expected_id in [
                ("is:unresolved region:us", self.event1.event_id),
                ("is:unresolved AND region:us", self.event1.event_id),
                ("(is:unresolved region:us)", self.event1.event_id),
                (
                    "(is:unresolved AND region:us) OR (is:resolved AND region:de)",
                    self.event2.event_id,
                ),
                ("assigned:me AND (region:us OR region:de)", self.event2.event_id),
                ("(is:unresolved)", self.event2.event_id),
            ]:
                response = self.client.get(self._latest_url(), {"query": query})
                assert response.status_code == 200, (query, response.content)
                assert response.data["id"] == expected_id, query

    def test_boolean_query_invalid(self) -> None:
        with self.feature(BOOLEAN_SEARCH_FEATURE):
            for query in ["region:us OR", "(count():>1)"]:
                response = self.client.get(self._latest_url(), {"query": query})
                assert response.status_code == 400

    def test_boolean_query_performance_issue(self) -> None:
        event = self.create_performance_issue()
        assert event.group is not None
        url = (
            f"/api/0/organizations/{self.organization.slug}/issues/{event.group.id}/events/latest/"
        )
        with self.feature(BOOLEAN_SEARCH_FEATURE):
            response = self.client.get(url, {"query": f"id:{event.event_id} OR region:unknown"})

        assert response.status_code == 200, response.content
        assert response.data["id"] == event.event_id

    def _latest_url(self, query: str = "") -> str:
        base = (
            f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/events/latest/"
        )
        return base + query

    def test_format_markdown_adds_formatted_field(self) -> None:
        with self.feature(FORMATTER_FEATURE):
            response = self.client.get(self._latest_url("?llmFormat=markdown"))

        assert response.status_code == 200
        assert response.data["id"] == str(self.event2.event_id)
        assert response.data["formatted"]["format"] == "markdown"
        assert "## Title" in response.data["formatted"]["content"]

    def test_no_format_param_has_no_formatted_field(self) -> None:
        with self.feature(FORMATTER_FEATURE):
            response = self.client.get(self._latest_url())

        assert response.status_code == 200
        assert "formatted" not in response.data

    def test_format_ignored_when_feature_off(self) -> None:
        # feature defaults off -> ?llmFormat is inert, response unchanged
        response = self.client.get(self._latest_url("?llmFormat=markdown"))

        assert response.status_code == 200
        assert "formatted" not in response.data

    def test_invalid_format_is_ignored(self) -> None:
        # an unrecognized value is inert, not a 400 -> response is unchanged
        with self.feature(FORMATTER_FEATURE):
            response = self.client.get(self._latest_url("?llmFormat=banana"))

        assert response.status_code == 200
        assert "formatted" not in response.data
