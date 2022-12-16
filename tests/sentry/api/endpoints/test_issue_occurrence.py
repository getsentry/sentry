from datetime import datetime

from sentry.models import OrganizationMemberTeam
from sentry.testutils import APITestCase
from sentry.types.issues import GroupType
from sentry.utils.dates import ensure_aware


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
            "title": "Meow meow",
            "platform": "python",
            "tags": {"environment": "prod"},
            "timestamp": ensure_aware(datetime.now()),
            "message_timestamp": ensure_aware(datetime.now()),
        }
        self.data = {
            "fingerprint": ["some-fingerprint"],
            "issue_title": "something bad happened",
            "subtitle": "it was bad",
            "resource_id": "1234",
            "evidence_data": {"Test": 123},
            "evidence_display": [
                ("Attention", "Very important information!!!", True),
                ("Evidence 2", "Not important", False),
                ("Evidence 3", "Nobody cares about this", False),
            ],
            "type": GroupType.PROFILE_BLOCKED_THREAD.value,
            "detection_time": ensure_aware(datetime.now()),
            "event": self.event,
        }

    def test_simple(self):
        response = self.client.post(self.url, data=self.data, format="json")
        assert response.status_code == 201, response.content

    def test_incorrect_event_payload(self):
        data = dict(self.data)
        data["event"]["tags"] = ["hello", "there"]
        response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 400, response.content

    def test_incorrect_occurrence_payload(self):
        data = dict(self.data)
        data["detection_time"] = "today"
        response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 400, response.content

    def test_load_fake_event(self):
        url = self.url + "?dummyEvent=True"
        data = dict(self.data)
        data.pop("event", None)
        response = self.client.post(url, data=data, format="json")
        assert response.status_code == 201, response.content

    def test_load_fake_occurrence(self):
        url = self.url + "?dummyOccurrence=True"
        data = {"event": self.event}
        response = self.client.post(url, data=data, format="json")
        assert response.status_code == 201, response.content

    def test_load_fake_event_and_occurrence(self):
        url = self.url + "?dummyEvent=True&dummyOccurrence=True"
        response = self.client.post(url, data={}, format="json")
        assert response.status_code == 201, response.content

    def test_no_event_passed(self):
        data = dict(self.data)
        data.pop("event", None)
        response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 400, response.content

    def test_no_occurrence_passed(self):
        data = dict(self.data)
        data = data["event"]
        response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 400, response.content

    def test_no_projects(self):
        """Test that we raise a 400 if the user belongs to no project teams and passes the dummyEvent query param"""
        OrganizationMemberTeam.objects.all().delete()
        url = self.url + "?dummyEvent=True"
        data = dict(self.data)
        data.pop("event", None)
        response = self.client.post(url, data=data, format="json")
        assert response.status_code == 400, response.content
