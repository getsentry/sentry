from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class GroupStatsTest(APITestCase):
    @freeze_time(before_now(days=1).replace(minute=10))
    def test_simple(self):
        self.login_as(user=self.user)
        group1 = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": before_now(minutes=5).isoformat(),
            },
            project_id=self.project.id,
        ).group
        assert group1 is not None

        url = f"/api/0/issues/{group1.id}/stats/"

        for fingerprint, count in (("group1", 2), ("group2", 5)):
            for _ in range(count):
                self.store_event(
                    data={
                        "fingerprint": [fingerprint],
                        "timestamp": before_now(minutes=5).isoformat(),
                    },
                    project_id=self.project.id,
                )

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24
