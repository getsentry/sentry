from unittest import mock

from sentry.event_manager import _pull_out_data
from sentry.models import Group
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.types.issues import GroupType
from sentry.utils.samples import load_data


class GroupEventsLatestTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-events-latest"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        project = self.create_project()
        min_ago = iso_format(before_now(minutes=1))
        two_min_ago = iso_format(before_now(minutes=2))

        self.event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "staging",
                "fingerprint": ["group_1"],
                "timestamp": two_min_ago,
            },
            project_id=project.id,
        )

        self.event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "production",
                "fingerprint": ["group_1"],
                "timestamp": min_ago,
            },
            project_id=project.id,
        )

        self.group = Group.objects.first()

    def test_snuba_no_environment(self):
        url = f"/api/0/issues/{self.group.id}/events/latest/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["id"] == str(self.event2.event_id)

    def test_snuba_environment(self):
        url = f"/api/0/issues/{self.group.id}/events/latest/"
        response = self.client.get(url, format="json", data={"environment": ["production"]})

        assert response.status_code == 200
        assert response.data["id"] == str(self.event2.event_id)

    def test_simple(self):
        url = f"/api/0/issues/{self.group.id}/events/latest/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["eventID"] == str(self.event2.event_id)

    def test_perf_issue(self):
        perf_group = self.create_group(type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES.value)

        def hack_pull_out_data(jobs, projects):
            _pull_out_data(jobs, projects)
            for job in jobs:
                job["event"].groups = [perf_group]
            return jobs, projects

        event_data = load_data("transaction")
        with mock.patch("sentry.event_manager._pull_out_data", hack_pull_out_data):
            event = self.store_event(data=event_data, project_id=self.project.id)
        url = f"/api/0/issues/{perf_group.id}/events/latest/"
        with self.feature("organizations:performance-issues"):
            response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["eventID"] == event.event_id
