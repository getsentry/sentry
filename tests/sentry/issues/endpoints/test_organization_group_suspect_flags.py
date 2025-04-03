import datetime
import time
import uuid

from sentry.testutils.cases import APITestCase, SnubaTestCase


class OrganizationGroupSuspectFlagsTestCase(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-group-suspect-flags"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_get(self):
        today = datetime.datetime.now(tz=datetime.UTC)
        group = self.create_group(
            first_seen=today - datetime.timedelta(hours=1),
            last_seen=today + datetime.timedelta(hours=1),
        )

        self._mock_event(
            today,
            hash="a" * 32,
            flags=[
                {"flag": "key", "result": True},
                {"flag": "other", "result": False},
            ],
            group_id=group.id,
            project_id=self.project.id,
        )
        self._mock_event(
            today,
            hash="a" * 32,
            flags=[
                {"flag": "key", "result": False},
                {"flag": "other", "result": False},
            ],
            group_id=2,
            project_id=self.project.id,
        )

        url = f"/api/0/issues/{group.id}/suspect/flags/"

        response = self.client.get(url)
        assert response.status_code == 200
        assert response.json() == {
            "data": [
                {"flag": "key", "score": 2.7622287114272543},
                {"flag": "other", "score": 0.0},
            ]
        }

    def _mock_event(self, ts, hash="a" * 32, group_id=None, project_id=1, flags=None):
        self.snuba_insert(
            (
                2,
                "insert",
                {
                    "event_id": uuid.uuid4().hex,
                    "primary_hash": hash,
                    "group_id": group_id if group_id else int(hash[:16], 16),
                    "project_id": project_id,
                    "message": "message",
                    "platform": "python",
                    "datetime": ts.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "data": {
                        "received": time.mktime(ts.timetuple()),
                        "contexts": {"flags": {"values": flags or []}},
                    },
                },
                {},
            )
        )
