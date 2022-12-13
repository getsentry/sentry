# import uuid
from datetime import datetime

from sentry.testutils import APITestCase
from sentry.types.issues import GroupType
from sentry.utils.dates import ensure_aware
from sentry.utils.samples import load_data


class IssueOccurrenceTest(APITestCase):
    def test_simple(self):
        user = self.create_user(is_superuser=True)
        self.login_as(user=user)

        event = dict(load_data("python"))
        event["message"] = "meow meow"
        event.pop("logentry", None)
        event["event_id"] = "44f1419e73884cd2b45c79918f4b6dc4"
        event["environment"] = "prod"
        event["tags"] = [
            ("logger", "javascript"),
            ("environment", "prod"),
            ("level", "error"),
            ("device", "Other"),
        ]

        data = {
            # "id": uuid.uuid4().hex,
            # "event_id": data["event_id"],
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
            "event": event,
        }

        url = "/api/0/issue-occurrence/"
        response = self.client.post(url, data=data, format="json")

        assert response.status_code == 201, response.content
        # assert response.data["id"] == str(group.id)
        # TODO do we need anything in the response?
