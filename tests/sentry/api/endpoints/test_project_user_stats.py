from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class ProjectUserDetailsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.create_member(user=self.user, organization=self.org, teams=[self.team])

        self.login_as(user=self.user)

        self.path = reverse(
            "sentry-api-0-project-userstats", args=[self.org.slug, self.project.slug]
        )

    def test_simple(self):
        # Set the time to yesterday at 10am. This ensures the time is not
        # in the future AND doesn't get affected by events and request being
        # on seperate days, which can occur at midnight without freezing time.
        now = before_now(hours=24).replace(hour=10)
        with freeze_time(now):
            self.store_event(
                data={
                    "timestamp": before_now(minutes=10).isoformat(),
                    "tags": {"sentry:user": "user_1"},
                },
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    "timestamp": before_now(minutes=10).isoformat(),
                    "tags": {"sentry:user": "user_1"},
                },
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    "timestamp": before_now(minutes=10).isoformat(),
                    "tags": {"sentry:user": "user_2"},
                },
                project_id=self.project.id,
            )

            response = self.client.get(self.path)

            assert response.status_code == 200, response.content
            assert response.data[-1][1] == 2, response.data
            for point in response.data[:-1]:
                assert point[1] == 0
            assert len(response.data) == 31
