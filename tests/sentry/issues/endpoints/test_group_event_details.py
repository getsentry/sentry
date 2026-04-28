import uuid
from typing import Any
from uuid import uuid4

from sentry.models.group import GroupStatus
from sentry.models.release import Release
from sentry.search.events.constants import SEMVER_ALIAS
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class GroupEventDetailsEndpointTestBase(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)
        self.project_1 = self.create_project()

        self.release_version = uuid4().hex
        release = Release.objects.create(
            organization_id=self.project_1.organization_id, version=self.release_version
        )
        release.add_project(self.project_1)

        self.event_a = self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "development",
                "timestamp": before_now(days=1).isoformat(),
                "fingerprint": ["group-1"],
                "release": self.release_version,
            },
            project_id=self.project_1.id,
        )
        self.event_b = self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "production",
                "timestamp": before_now(minutes=5).isoformat(),
                "fingerprint": ["group-1"],
                "release": self.release_version,
            },
            project_id=self.project_1.id,
        )
        self.event_c = self.store_event(
            data={
                "event_id": "c" * 32,
                "environment": "staging",
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group-1"],
                "release": self.release_version,
            },
            project_id=self.project_1.id,
        )


class GroupEventDetailsEndpointTest(GroupEventDetailsEndpointTestBase, APITestCase, SnubaTestCase):
    def test_get_simple_latest(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_a.group.id}/events/latest/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_c.event_id)
        assert response.data["previousEventID"] == str(self.event_b.event_id)
        assert response.data["nextEventID"] is None

    def test_get_simple_oldest(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_a.group.id}/events/oldest/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_a.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] == str(self.event_b.event_id)

    def test_get_simple_event_id(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_b.group.id}/events/{self.event_b.event_id}/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_b.event_id)
        assert response.data["previousEventID"] == str(self.event_a.event_id)
        assert response.data["nextEventID"] == str(self.event_c.event_id)

    def test_get_with_environment_latest(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_a.group.id}/events/latest/"
        response = self.client.get(url, format="json", data={"environment": ["production"]})

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_b.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None

    def test_get_with_environment_oldest(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_a.group.id}/events/oldest/"
        response = self.client.get(url, format="json", data={"environment": ["production"]})

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_b.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None

    def test_collapse_stacktrace_only(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_a.group.id}/events/latest/"
        response = self.client.get(url, format="json", data={"collapse": ["stacktraceOnly"]})

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_c.event_id)
        assert "previousEventID" not in response.data
        assert "nextEventID" not in response.data

    def test_collapse_full_release(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_a.group.id}/events/latest/"
        response_no_collapse = self.client.get(
            url, format="json", data={"environment": ["production"]}
        )

        assert response_no_collapse.status_code == 200, response_no_collapse.content

        # Full release includes firstEvent, lastEvent, newGroups, etc
        assert {"id", "version", "firstEvent", "lastEvent", "newGroups"} <= set(
            response_no_collapse.data["release"]
        )

        response_with_collapse = self.client.get(
            url, format="json", data={"environment": ["production"], "collapse": ["fullRelease"]}
        )

        assert response_with_collapse.status_code == 200, response_with_collapse.content

        # Collapsed release includes id, version, but not others like firstEvent/lastEvent
        assert {"id", "version"} <= set(response_with_collapse.data["release"])
        assert not {"firstEvent", "lastEvent", "newGroups"} <= set(
            response_with_collapse.data["release"]
        )

    def test_prev_filtered(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_b.group.id}/events/{self.event_b.event_id}/"
        response = self.client.get(
            url,
            {
                "start": self.event_b.datetime.isoformat(),
                "end": before_now(minutes=0),
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] == str(self.event_c.event_id)

    def test_next_filtered(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_b.group.id}/events/{self.event_b.event_id}/"
        response = self.client.get(
            url,
            {
                "start": self.event_a.datetime.isoformat(),
                "end": self.event_b.datetime.isoformat(),
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data["previousEventID"] == str(self.event_a.event_id)
        assert response.data["nextEventID"] is None

    def _build_interleaved_tag_group(self) -> tuple[Any, Any, Any, Any, Any]:
        m1 = self.store_event(
            data={
                "event_id": "1" * 32,
                "timestamp": before_now(minutes=10).isoformat(),
                "fingerprint": ["walk-group"],
                "tags": {"attachmentsAdded": "true"},
            },
            project_id=self.project_1.id,
        )
        n1 = self.store_event(
            data={
                "event_id": "2" * 32,
                "timestamp": before_now(minutes=8).isoformat(),
                "fingerprint": ["walk-group"],
            },
            project_id=self.project_1.id,
        )
        m2 = self.store_event(
            data={
                "event_id": "3" * 32,
                "timestamp": before_now(minutes=6).isoformat(),
                "fingerprint": ["walk-group"],
                "tags": {"attachmentsAdded": "true"},
            },
            project_id=self.project_1.id,
        )
        n2 = self.store_event(
            data={
                "event_id": "4" * 32,
                "timestamp": before_now(minutes=4).isoformat(),
                "fingerprint": ["walk-group"],
            },
            project_id=self.project_1.id,
        )
        m3 = self.store_event(
            data={
                "event_id": "5" * 32,
                "timestamp": before_now(minutes=2).isoformat(),
                "fingerprint": ["walk-group"],
                "tags": {"attachmentsAdded": "true"},
            },
            project_id=self.project_1.id,
        )
        return m1, n1, m2, n2, m3

    def test_walk_next_prev_respects_query_filter_for_allowlisted_org(self) -> None:
        m1, n1, m2, _n2, m3 = self._build_interleaved_tag_group()
        group_id = m1.group.id
        query = "attachmentsAdded:true"

        def fetch(event_id: str) -> Any:
            url = f"/api/0/organizations/{self.organization.slug}/issues/{group_id}/events/{event_id}/"
            return self.client.get(url, {"query": query}, format="json")

        # Middle matching event: prev/next hop past the non-matching
        # neighbors on both sides.
        middle = fetch(m2.event_id)
        assert middle.status_code == 200, middle.content
        assert middle.data["previousEventID"] == str(m1.event_id)
        assert middle.data["nextEventID"] == str(m3.event_id)

        # Oldest matching event: boundary on the prev side.
        oldest = fetch(m1.event_id)
        assert oldest.status_code == 200, oldest.content
        assert oldest.data["previousEventID"] is None
        assert oldest.data["nextEventID"] == str(m2.event_id)

        # Newest matching event: boundary on the next side.
        newest = fetch(m3.event_id)
        assert newest.status_code == 200, newest.content
        assert newest.data["previousEventID"] == str(m2.event_id)
        assert newest.data["nextEventID"] is None

        # Landing on a non-matching event directly (e.g. via a stale
        # URL) still returns it, but its adjacent IDs are filtered
        # so the user can walk back into the matching set.
        between = fetch(n1.event_id)
        assert between.status_code == 200, between.content
        assert between.data["previousEventID"] == str(m1.event_id)
        assert between.data["nextEventID"] == str(m2.event_id)

    def test_next_prev_respects_or_query_filter_for_allowlisted_org(self) -> None:
        red = self.store_event(
            data={
                "event_id": "6" * 32,
                "timestamp": before_now(minutes=10).isoformat(),
                "fingerprint": ["or-group"],
                "tags": {"color": "red"},
            },
            project_id=self.project_1.id,
        )
        self.store_event(
            data={
                "event_id": "7" * 32,
                "timestamp": before_now(minutes=8).isoformat(),
                "fingerprint": ["or-group"],
                "tags": {"color": "green"},
            },
            project_id=self.project_1.id,
        )
        blue = self.store_event(
            data={
                "event_id": "8" * 32,
                "timestamp": before_now(minutes=6).isoformat(),
                "fingerprint": ["or-group"],
                "tags": {"color": "blue"},
            },
            project_id=self.project_1.id,
        )

        url = f"/api/0/organizations/{self.organization.slug}/issues/{blue.group.id}/events/{blue.event_id}/"
        response = self.client.get(url, {"query": "color:[red, blue]"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["previousEventID"] == str(red.event_id)
        assert response.data["nextEventID"] is None


class GroupEventDetailsHelpfulEndpointTest(
    GroupEventDetailsEndpointTestBase, APITestCase, SnubaTestCase, OccurrenceTestMixin
):
    def test_get_simple_helpful(self) -> None:
        self.event_d = self.store_event(
            data={
                "event_id": "d" * 32,
                "environment": "staging",
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group-1"],
                "contexts": {
                    "replay": {"replay_id": uuid.uuid4().hex},
                    "trace": {
                        "sampled": True,
                        "span_id": "babaae0d4b7512d9",
                        "trace_id": "a7d67cf796774551a95be6543cacd459",
                    },
                },
                "errors": [],
            },
            project_id=self.project_1.id,
        )
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_a.group.id}/events/recommended/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_d.event_id)
        assert response.data["previousEventID"] == self.event_c.event_id
        assert response.data["nextEventID"] is None

    def test_get_helpful_event_id(self) -> None:
        """
        When everything else is equal, the event_id should be used to break ties.
        """
        timestamp = before_now(minutes=1).isoformat()

        self.event_d = self.store_event(
            data={
                "event_id": "d" * 32,
                "environment": "staging",
                "timestamp": timestamp,
                "fingerprint": ["group-1"],
                "contexts": {},
                "errors": [],
            },
            project_id=self.project_1.id,
        )
        self.event_e = self.store_event(
            data={
                "event_id": "e" * 32,
                "environment": "staging",
                "timestamp": timestamp,
                "fingerprint": ["group-1"],
                "contexts": {},
                "errors": [],
            },
            project_id=self.project_1.id,
        )
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_a.group.id}/events/recommended/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_e.event_id)
        assert response.data["previousEventID"] == self.event_d.event_id
        assert response.data["nextEventID"] is None

    def test_get_helpful_replay_id_order(self) -> None:
        replay_id_1 = uuid.uuid4().hex
        replay_id_2 = uuid.uuid4().hex
        replay_id_1 = "b" + replay_id_1[1:]
        replay_id_2 = "a" + replay_id_2[1:]

        self.event_d = self.store_event(
            data={
                "event_id": "d" * 32,
                "environment": "staging",
                "timestamp": before_now(minutes=3).isoformat(),
                "fingerprint": ["group-order"],
                "contexts": {
                    "replay": {"replay_id": replay_id_1},
                },
            },
            project_id=self.project_1.id,
        )
        self.event_e = self.store_event(
            data={
                "event_id": "e" * 32,
                "environment": "staging",
                "timestamp": before_now(minutes=2).isoformat(),
                "fingerprint": ["group-order"],
                "contexts": {
                    "replay": {"replay_id": replay_id_2},
                },
            },
            project_id=self.project_1.id,
        )
        self.event_f = self.store_event(
            data={
                "event_id": "f" * 32,
                "environment": "staging",
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group-order"],
            },
            project_id=self.project_1.id,
        )

        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_d.group.id}/events/recommended/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_e.event_id)
        assert response.data["previousEventID"] == str(self.event_d.event_id)
        assert response.data["nextEventID"] == str(self.event_f.event_id)

    def test_with_empty_query(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_a.group.id}/events/recommended/"
        response = self.client.get(url, {"query": ""}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_c.event_id)
        assert response.data["previousEventID"] == str(self.event_b.event_id)
        assert response.data["nextEventID"] is None

    def test_issue_filter_query_ignored(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_a.group.id}/events/recommended/"
        response = self.client.get(url, {"query": "is:unresolved"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_c.event_id)
        assert response.data["previousEventID"] == str(self.event_b.event_id)
        assert response.data["nextEventID"] is None

    def test_event_release_query(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_a.group.id}/events/recommended/"
        response = self.client.get(url, {"query": f"release:{self.release_version}"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_c.event_id)
        assert response.data["previousEventID"] == str(self.event_b.event_id)
        assert response.data["nextEventID"] is None

    def test_event_release_semver_query(self) -> None:
        event_g = self.store_event(
            data={
                "event_id": "1" * 32,
                "environment": "staging",
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group-4"],
                "release": "test@1.2.3",
            },
            project_id=self.project_1.id,
        )

        release = Release.objects.filter(version="test@1.2.3").get()
        assert release.version == "test@1.2.3"
        assert release.is_semver_release

        url = f"/api/0/organizations/{self.organization.slug}/issues/{event_g.group.id}/events/recommended/"
        response = self.client.get(url, {"query": f"{SEMVER_ALIAS}:1.2.3"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(event_g.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None

    def test_has_environment(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.event_a.group.id}/events/recommended/"
        response = self.client.get(url, {"query": "has:environment"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_c.event_id)
        assert response.data["previousEventID"] == str(self.event_b.event_id)
        assert response.data["nextEventID"] is None

    def test_skipped_snuba_fields_ignored(self) -> None:
        event_e = self.store_event(
            data={
                "event_id": "e" * 32,
                "environment": "staging",
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group-4"],
                "contexts": {
                    "replay": {"replay_id": uuid.uuid4().hex},
                    "trace": {
                        "sampled": True,
                        "span_id": "babaae0d4b7512d9",
                        "trace_id": "a7d67cf796774551a95be6543cacd459",
                    },
                },
                "errors": [],
            },
            project_id=self.project_1.id,
        )

        event_f = self.store_event(
            data={
                "event_id": "f" * 32,
                "environment": "staging",
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group-4"],
            },
            project_id=self.project_1.id,
        )

        group = event_e.group
        group.status = GroupStatus.RESOLVED
        group.substatus = None
        group.save(update_fields=["status", "substatus"])

        url = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/events/recommended/"
        response = self.client.get(url, {"query": "is:unresolved has:environment"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(event_e.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] == str(event_f.event_id)

    def test_query_title(self) -> None:
        title = "four score and seven years ago"
        event_e = self.store_event(
            data={
                "event_id": "e" * 32,
                "environment": "staging",
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group-title"],
                "message": title,
            },
            project_id=self.project_1.id,
        )

        url = f"/api/0/organizations/{self.organization.slug}/issues/{event_e.group.id}/events/recommended/"
        response = self.client.get(url, {"query": f'title:"{title}"'}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(event_e.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None

    def test_query_title_not_in_with_wildcards(self) -> None:
        event_e = self.store_event(
            data={
                "event_id": "e" * 32,
                "environment": "staging",
                "timestamp": before_now(minutes=1).isoformat(),
                "fingerprint": ["group-title-wildcard"],
                "message": "some other title",
            },
            project_id=self.project_1.id,
        )

        url = f"/api/0/organizations/{self.organization.slug}/issues/{event_e.group.id}/events/recommended/"
        response = self.client.get(url, {"query": '!title:["*value1*", "*value2*"]'}, format="json")

        assert response.status_code == 200, response.content

    def test_query_issue_platform_title(self) -> None:
        issue_title = "king of england"
        occurrence, group_info = self.process_occurrence(
            project_id=self.project.id,
            issue_title=issue_title,
            event_data={"level": "info"},
        )

        assert group_info is not None
        url = f"/api/0/organizations/{self.organization.slug}/issues/{group_info.group.id}/events/recommended/"
        response = self.client.get(url, {"query": f'title:"{issue_title}"'}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(occurrence.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None
