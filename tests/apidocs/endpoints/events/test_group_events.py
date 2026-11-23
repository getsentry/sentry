from django.test.client import RequestFactory

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.helpers.datetime import before_now


class ProjectGroupEventBase(APIDocsTestCase):
    def setUp(self) -> None:
        first_release = {
            "firstEvent": before_now(minutes=3),
            "lastEvent": before_now(minutes=2, seconds=30),
        }
        last_release = {
            "firstEvent": before_now(minutes=1, seconds=30),
            "lastEvent": before_now(minutes=1),
        }

        for timestamp in first_release.values():
            self.create_event("a", release="1.0", timestamp=timestamp.isoformat())
        self.create_event("b", release="1.1")

        for timestamp in last_release.values():
            event = self.create_event("c", release="1.0a", timestamp=timestamp.isoformat())

        assert event.group is not None
        self.group_id = event.group.id

        self.login_as(user=self.user)


class ProjectGroupEventsDocs(ProjectGroupEventBase):
    def setUp(self) -> None:
        super().setUp()
        self.url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group_id}/events/"

    def test_get(self) -> None:
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)


class ProjectGroupEventDetailsDocs(ProjectGroupEventBase):
    def setUp(self) -> None:
        super().setUp()
        self.url = (
            f"/api/0/organizations/{self.organization.slug}/issues/{self.group_id}/events/latest/"
        )

    def test_get(self) -> None:
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_get_with_null_tag_values(self) -> None:
        # Ingestion keeps a tag whose value is missing or invalid, with a null value and the
        # reason in `_meta`.
        event = self.store_event(
            data={
                "fingerprint": ["1"],
                "timestamp": before_now(seconds=1).isoformat(),
                "tags": [["unset", None], ["empty", ""]],
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        url = (
            f"/api/0/organizations/{self.organization.slug}/issues/{self.group_id}"
            f"/events/{event.event_id}/"
        )

        response = self.client.get(url)
        request = RequestFactory().get(url)

        assert {"key": "unset", "value": None} in response.data["tags"]
        assert {"key": "empty", "value": None} in response.data["tags"]
        self.validate_schema(request, response)

    def test_get_collapse_adjacent_events(self) -> None:
        response = self.client.get(self.url, {"collapse": "adjacentEvents"})
        request = RequestFactory().get(self.url, {"collapse": "adjacentEvents"})

        assert response.data["nextEventID"] is None
        assert response.data["previousEventID"] is None
        self.validate_schema(request, response)
