import uuid
from uuid import uuid4

from sentry.issues.occurrence_consumer import process_event_and_issue_occurrence
from sentry.models.group import GroupStatus
from sentry.models.release import Release
from sentry.search.events.constants import SEMVER_ALIAS
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class GroupEventDetailsEndpointTestBase(APITestCase, SnubaTestCase):
    def setUp(self):
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
                "timestamp": iso_format(before_now(days=1)),
                "fingerprint": ["group-1"],
                "release": self.release_version,
            },
            project_id=self.project_1.id,
        )
        self.event_b = self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "production",
                "timestamp": iso_format(before_now(minutes=5)),
                "fingerprint": ["group-1"],
                "release": self.release_version,
            },
            project_id=self.project_1.id,
        )
        self.event_c = self.store_event(
            data={
                "event_id": "c" * 32,
                "environment": "staging",
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-1"],
                "release": self.release_version,
            },
            project_id=self.project_1.id,
        )


@region_silo_test
class GroupEventDetailsEndpointTest(GroupEventDetailsEndpointTestBase, APITestCase, SnubaTestCase):
    def test_get_simple_latest(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/latest/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_c.event_id)
        assert response.data["previousEventID"] == str(self.event_b.event_id)
        assert response.data["nextEventID"] is None

    def test_get_simple_oldest(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/oldest/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_a.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] == str(self.event_b.event_id)

    def test_get_simple_event_id(self):
        url = f"/api/0/issues/{self.event_b.group.id}/events/{self.event_b.event_id}/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_b.event_id)
        assert response.data["previousEventID"] == str(self.event_a.event_id)
        assert response.data["nextEventID"] == str(self.event_c.event_id)

    def test_get_with_environment_latest(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/latest/"
        response = self.client.get(url, format="json", data={"environment": ["production"]})

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_b.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None

    def test_get_with_environment_oldest(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/oldest/"
        response = self.client.get(url, format="json", data={"environment": ["production"]})

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_b.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None

    def test_collapse_stacktrace_only(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/latest/"
        response = self.client.get(url, format="json", data={"collapse": ["stacktraceOnly"]})

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_c.event_id)
        assert "previousEventID" not in response.data
        assert "nextEventID" not in response.data

    def test_collapse_full_release(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/latest/"
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


@region_silo_test
class GroupEventDetailsHelpfulEndpointTest(
    GroupEventDetailsEndpointTestBase, APITestCase, SnubaTestCase, OccurrenceTestMixin
):
    def test_get_simple_helpful(self):
        self.event_d = self.store_event(
            data={
                "event_id": "d" * 32,
                "environment": "staging",
                "timestamp": iso_format(before_now(minutes=1)),
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
        url = f"/api/0/issues/{self.event_a.group.id}/events/helpful/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_d.event_id)
        assert response.data["previousEventID"] == self.event_c.event_id
        assert response.data["nextEventID"] is None

    def test_get_helpful_event_id(self):
        """
        When everything else is equal, the event_id should be used to break ties.
        """
        timestamp = iso_format(before_now(minutes=1))

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
        url = f"/api/0/issues/{self.event_a.group.id}/events/helpful/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_e.event_id)
        assert response.data["previousEventID"] == self.event_d.event_id
        assert response.data["nextEventID"] is None

    def test_get_helpful_replay_id_order(self):
        replay_id_1 = uuid.uuid4().hex
        replay_id_2 = uuid.uuid4().hex
        replay_id_1 = "b" + replay_id_1[1:]
        replay_id_2 = "a" + replay_id_2[1:]

        self.event_d = self.store_event(
            data={
                "event_id": "d" * 32,
                "environment": "staging",
                "timestamp": iso_format(before_now(minutes=3)),
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
                "timestamp": iso_format(before_now(minutes=2)),
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
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-order"],
            },
            project_id=self.project_1.id,
        )

        url = f"/api/0/issues/{self.event_d.group.id}/events/helpful/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_e.event_id)
        assert response.data["previousEventID"] == str(self.event_d.event_id)
        assert response.data["nextEventID"] == str(self.event_f.event_id)

    def test_with_empty_query(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/helpful/"
        response = self.client.get(url, {"query": ""}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_c.event_id)
        assert response.data["previousEventID"] == str(self.event_b.event_id)
        assert response.data["nextEventID"] is None

    def test_issue_filter_query_ignored(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/helpful/"
        response = self.client.get(url, {"query": "is:unresolved"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_c.event_id)
        assert response.data["previousEventID"] == str(self.event_b.event_id)
        assert response.data["nextEventID"] is None

    def test_event_release_query(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/helpful/"
        response = self.client.get(url, {"query": f"release:{self.release_version}"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_c.event_id)
        assert response.data["previousEventID"] == str(self.event_b.event_id)
        assert response.data["nextEventID"] is None

    def test_event_release_semver_query(self):
        event_g = self.store_event(
            data={
                "event_id": "1" * 32,
                "environment": "staging",
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-4"],
                "release": "test@1.2.3",
            },
            project_id=self.project_1.id,
        )

        release = Release.objects.filter(version="test@1.2.3").get()
        assert release.version == "test@1.2.3"
        assert release.is_semver_release

        url = f"/api/0/issues/{event_g.group.id}/events/helpful/"
        response = self.client.get(url, {"query": f"{SEMVER_ALIAS}:1.2.3"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(event_g.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None

    def test_has_environment(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/helpful/"
        response = self.client.get(url, {"query": "has:environment"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.event_c.event_id)
        assert response.data["previousEventID"] == str(self.event_b.event_id)
        assert response.data["nextEventID"] is None

    def test_skipped_snuba_fields_ignored(self):
        event_e = self.store_event(
            data={
                "event_id": "e" * 32,
                "environment": "staging",
                "timestamp": iso_format(before_now(minutes=1)),
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
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-4"],
            },
            project_id=self.project_1.id,
        )

        group = event_e.group
        group.status = GroupStatus.RESOLVED
        group.substatus = None
        group.save(update_fields=["status", "substatus"])

        url = f"/api/0/issues/{group.id}/events/helpful/"
        response = self.client.get(url, {"query": "is:unresolved has:environment"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(event_e.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] == str(event_f.event_id)

    def test_query_title(self):
        title = "four score and seven years ago"
        event_e = self.store_event(
            data={
                "event_id": "e" * 32,
                "environment": "staging",
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-title"],
                "message": title,
            },
            project_id=self.project_1.id,
        )

        url = f"/api/0/issues/{event_e.group.id}/events/helpful/"
        response = self.client.get(url, {"query": f'title:"{title}"'}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(event_e.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None

    def test_query_issue_platform_title(self):
        issue_title = "king of england"
        occurrence_data = self.build_occurrence_data(project_id=self.project.id, title=issue_title)
        occurrence, group_info = process_event_and_issue_occurrence(
            occurrence_data,
            event_data={
                "event_id": occurrence_data["event_id"],
                "project_id": occurrence_data["project_id"],
                "level": "info",
            },
        )

        assert group_info is not None
        url = f"/api/0/issues/{group_info.group.id}/events/helpful/"
        response = self.client.get(url, {"query": f'title:"{issue_title}"'}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(occurrence.event_id)
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None
