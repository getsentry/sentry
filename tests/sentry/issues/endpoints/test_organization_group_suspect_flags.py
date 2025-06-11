import datetime
import time
import uuid
from typing import TypedDict

from sentry.testutils.cases import APITestCase, SnubaTestCase


class _FlagResult(TypedDict):
    flag: str
    result: bool


class OrganizationGroupSuspectFlagsTestCase(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-group-suspect-flags"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    @property
    def features(self) -> dict[str, bool]:
        return {"organizations:feature-flag-suspect-flags": True}

    def test_get(self) -> None:
        today = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(minutes=5)
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

        with self.feature(self.features):
            response = self.client.get(f"/api/0/issues/{group.id}/suspect/flags/")

        assert response.status_code == 200
        assert response.json() == {
            "data": [
                {
                    "flag": "key",
                    "score": 0.01634056054997356,
                    "baseline_percent": 0.5,
                    "distribution": {
                        "baseline": {
                            "false": 1,
                            "true": 1,
                        },
                        "outliers": {
                            "true": 1,
                        },
                    },
                },
                {
                    "flag": "other",
                    "score": 0.016181914331041776,
                    "baseline_percent": 0,
                    "distribution": {
                        "baseline": {
                            "false": 2,
                        },
                        "outliers": {
                            "false": 1,
                        },
                    },
                },
            ]
        }

    def test_get_no_flag_access(self) -> None:
        """Does not have feature-flag access."""
        group = self.create_group()
        response = self.client.get(f"/api/0/issues/{group.id}/suspect/flags/")
        assert response.status_code == 404

    def test_get_no_group(self) -> None:
        """Group not found."""
        with self.feature(self.features):
            response = self.client.get("/api/0/issues/22/suspect/flags/")
            assert response.status_code == 404

    def _mock_event(
        self,
        ts: datetime.datetime,
        hash: str = "a" * 32,
        group_id: int | None = None,
        project_id: int = 1,
        flags: list[_FlagResult] | None = None,
    ) -> None:
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
