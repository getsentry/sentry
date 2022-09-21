from django.urls import reverse

from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json
from sentry.utils.samples import load_data


@region_silo_test
class ProjectOwnershipEndpointTestCase(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )

    def test_error_event(self):
        data = load_data(platform="javascript")
        event = self.store_event(data=data, project_id=self.project.id)

        url = reverse(
            "sentry-api-0-event-grouping-info",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": event.event_id,
            },
        )

        response = self.client.get(url, format="json")
        content = json.loads(response.content)

        assert response.status_code == 200
        assert content["system"]["type"] == "component"
