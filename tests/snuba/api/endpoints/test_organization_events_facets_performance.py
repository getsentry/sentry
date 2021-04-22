from uuid import uuid4

from django.urls import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationEventsFacetsPerformanceEndpointTest(SnubaTestCase, APITestCase):
    feature_list = (
        "organizations:discover-basic",
        "organizations:global-views",
        "organizations:performance-tag-explorer",
    )

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1).replace(microsecond=0)
        self.day_ago = before_now(days=1).replace(microsecond=0)
        self.login_as(user=self.user)
        self.project = self.create_project()
        self.project2 = self.create_project()
        self.url = reverse(
            "sentry-api-0-organization-events-facets-performance",
            kwargs={"organization_slug": self.project.organization.slug},
        )

    def test_multiple_projects_without_global_view(self):
        self.store_event(data={"event_id": uuid4().hex}, project_id=self.project.id)
        self.store_event(data={"event_id": uuid4().hex}, project_id=self.project2.id)

        with self.feature(
            [
                "organizations:discover-basic",
                "organizations:global-views",
                "organizations:performance-tag-explorer",
            ]
        ):
            response = self.client.get(self.url, format="json")
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": "You cannot view facet performance for multiple projects."
        }
