from datetime import datetime

from sentry.testutils import APITestCase
from sentry.types.issues import GroupType
from sentry.utils.dates import ensure_aware


class IssueOccurrenceTest(APITestCase):
    def setUp(self):
        super().setUp()
        user = self.create_user(is_superuser=True)
        self.login_as(user=user, superuser=True)

        self.url = "/api/0/issue-occurrence/"
        self.event = {
            "event_id": "44f1419e73884cd2b45c79918f4b6dc4",
            "project_id": self.project.id,
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
