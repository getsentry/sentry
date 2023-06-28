import uuid
from uuid import uuid4

from sentry.models.release import Release
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class GroupEventDetailsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.login_as(user=self.user)
        self.project_1 = self.create_project()

        release_version = uuid4().hex
        release = Release.objects.create(
            organization_id=self.project_1.organization_id, version=release_version
        )
        release.add_project(self.project_1)

        self.event_a = self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "development",
                "timestamp": iso_format(before_now(days=1)),
                "fingerprint": ["group-1"],
                "release": release_version,
            },
            project_id=self.project_1.id,
        )
        self.event_b = self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "production",
                "timestamp": iso_format(before_now(minutes=5)),
                "fingerprint": ["group-1"],
                "release": release_version,
            },
            project_id=self.project_1.id,
        )
        self.event_c = self.store_event(
            data={
                "event_id": "c" * 32,
                "environment": "staging",
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-1"],
                "release": release_version,
            },
            project_id=self.project_1.id,
        )

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

    def test_get_helpful_feature_off(self):
        url = f"/api/0/issues/{self.event_a.group.id}/events/helpful/"
        response = self.client.get(url, format="json")

        assert response.status_code == 404, response.content

    @with_feature("organizations:issue-details-most-helpful-event")
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
