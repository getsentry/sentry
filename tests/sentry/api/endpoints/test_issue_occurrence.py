from datetime import datetime
from unittest import mock

from sentry.issues.grouptype import ProfileFileIOGroupType
from sentry.models import OrganizationMemberTeam
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.dates import ensure_aware
from sentry.utils.samples import load_data


@region_silo_test(stable=True)
@mock.patch("sentry.api.endpoints.issue_occurrence.Producer")
class IssueOccurrenceTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_superuser=True)
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org, members=[self.user])
        project = self.create_project(organization=self.org, teams=[self.team])
        self.login_as(user=self.user, superuser=True)

        self.url = "/api/0/issue-occurrence/"
        self.event = {
            "event_id": "44f1419e73884cd2b45c79918f4b6dc4",
            "project_id": project.id,
            "platform": "python",
            "tags": {"environment": "prod"},
            "timestamp": ensure_aware(datetime.now()),
            "received": ensure_aware(datetime.now()),
            "data": {},
        }
        self.data = {
            "id": "55f1419e73884cd2b45c79918f4b6dc5",
            "project_id": project.id,
            "fingerprint": ["some-fingerprint"],
            "issue_title": "something bad happened",
            "subtitle": "it was bad",
            "resource_id": "1234",
            "evidence_data": {"Test": 123},
            "evidence_display": [
                {
                    "name": "Attention",
                    "value": "Very important information!!!",
                    "important": True,
                },
                {
                    "name": "Evidence 2",
                    "value": "Not important",
                    "important": False,
                },
                {
                    "name": "Evidence 3",
                    "value": "Nobody cares about this",
                    "important": False,
                },
            ],
            "type": ProfileFileIOGroupType.type_id,
            "detection_time": ensure_aware(datetime.now()),
            "event": self.event,
        }

    def test_simple(self, mock_func):
        response = self.client.post(self.url, data=self.data, format="json")
        assert response.status_code == 201, response.content

    def test_load_fake_data(self, mock_func):
        url = self.url + "?dummyOccurrence=True"
        data = dict(self.data)
        data.pop("event", None)
        response = self.client.post(url, data=data, format="json")
        assert response.status_code == 201, response.content

    def test_no_data_passed(self, mock_func):
        response = self.client.post(self.url, data={}, format="json")
        assert response.status_code == 400, response.content

    def test_no_projects(self, mock_func):
        """Test that we raise a 400 if the user belongs to no project teams and passes the dummyEvent query param"""
        OrganizationMemberTeam.objects.all().delete()
        url = self.url + "?dummyOccurrence=True"
        data = dict(self.data)
        data.pop("event", None)
        response = self.client.post(url, data=data, format="json")
        assert response.status_code == 400, response.content

    def test_load_profiling_occurrence(self, mock_func):
        event_data = load_data("generic-event-profiling")
        data = event_data.data
        response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 201, response.content
