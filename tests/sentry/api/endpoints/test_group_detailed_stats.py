from rest_framework import status

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("organizations:issue-details-streamline")
class GroupDetailedStatsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.fingerprint = "group1"
        self.group = self.store_event(
            data={
                "fingerprint": [self.fingerprint],
                "timestamp": iso_format(before_now(minutes=5)),
            },
            project_id=self.project.id,
        ).group
        self.url = f"/api/0/issues/{self.group.id}/detailed-stats/"

    def test_requires_flag(self):
        with self.feature({"organizations:issue-details-streamline": False}):
            response = self.client.get(self.url, format="json")
            assert response.status_code == status.HTTP_404_NOT_FOUND, response.content

    @freeze_time(before_now(days=1))
    def test_get_14d_stats_by_default(self):
        for i in range(20):
            self.store_event(
                data={
                    "fingerprint": [self.fingerprint],
                    "timestamp": iso_format(before_now(days=i)),
                    "user": {"id": i},
                },
                project_id=self.project.id,
            )

        response = self.client.get(self.url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data["eventStats"]) == 15  # 14 days of data
        assert response.data["userCount"] == 14  # 14 unique users, 1 per day

    @freeze_time(before_now(days=1))
    def test_get_stats_from_stats_period(self):
        for i in range(20):
            self.store_event(
                data={
                    "fingerprint": [self.fingerprint],
                    "timestamp": iso_format(before_now(days=i)),
                    "user": {"id": i},
                },
                project_id=self.project.id,
            )

        response = self.client.get(self.url, data={"statsPeriod": "7d"}, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data["eventStats"]) == 24 * 7 + 1  # Rolled up per hour
        assert response.data["userCount"] == 7  # 1 unique user per day

    @freeze_time(before_now(days=1))
    def test_get_stats_from_specific_range(self):
        for i in range(20):
            self.store_event(
                data={
                    "fingerprint": [self.fingerprint],
                    "timestamp": iso_format(before_now(days=i)),
                    "user": {"id": i},
                },
                project_id=self.project.id,
            )

        start = iso_format(before_now(days=10))
        end = iso_format(before_now(days=5))
        response = self.client.get(
            self.url,
            data={"start": start, "end": end},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert len(response.data["eventStats"]) == 24 * 5 + 1  # Rolled up per hour
        assert response.data["userCount"] == 5  # 1 unique user per day

    @freeze_time(before_now(days=1))
    def test_get_stats_from_timeframe(self):
        for i in range(20):
            self.store_event(
                data={
                    "fingerprint": [self.fingerprint],
                    "timestamp": iso_format(before_now(days=i)),
                    "user": {"id": i},
                },
                project_id=self.project.id,
            )
        response = self.client.get(
            self.url,
            data={"timeframe": "15d"},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert len(response.data["eventStats"]) == 15 + 1  # Rolled up per day
        assert response.data["userCount"] == 15  # 1 unique user per day

        response = self.client.get(
            self.url,
            data={"timeframeStart": "8d", "timeframeEnd": "5d"},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert len(response.data["eventStats"]) == 24 * 3 + 1  # Rolled up per hour
        assert response.data["userCount"] == 3  # 1 unique user per day
