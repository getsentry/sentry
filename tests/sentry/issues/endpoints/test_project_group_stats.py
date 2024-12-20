from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class ProjectGroupStatsTest(APITestCase):
    @freeze_time(before_now(days=1).replace(minute=10))
    def test_simple(self) -> None:
        self.login_as(user=self.user)

        group1 = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": before_now(minutes=5).isoformat(),
            },
            project_id=self.project.id,
        ).group
        assert group1 is not None
        group2 = self.store_event(
            data={
                "fingerprint": ["group2"],
                "timestamp": before_now(minutes=5).isoformat(),
            },
            project_id=self.project.id,
        ).group
        assert group2 is not None

        for fingerprint, count in (("group1", 2), ("group2", 4)):
            for _ in range(count):
                self.store_event(
                    data={
                        "fingerprint": [fingerprint],
                        "timestamp": before_now(minutes=5).isoformat(),
                    },
                    project_id=self.project.id,
                )

        url = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/issues/stats/"

        response = self.client.get(f"{url}?id={group1.id}&id={group2.id}", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert str(group1.id) in response.data
        assert str(group2.id) in response.data

        group_data = response.data[str(group1.id)]
        assert group_data[-1][1] == 3, response.data
        for point in group_data[:-1]:
            assert point[1] == 0
        assert len(group_data) == 24
