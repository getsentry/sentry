from django.urls import reverse

from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.testutils.cases import APITestCase


class OrganizationGroupSearchViewsStarredEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-search-views-starred"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)

    def create_view(self, **kwargs):
        default_data = {
            "organization": self.org,
            "user_id": self.user.id,
            "name": "Test View",
            "query": "is:unresolved",
            "query_sort": "date",
            "is_all_projects": True,
            "environments": [],
            "time_filters": {"start": None, "end": None, "period": "14d"},
        }
        return GroupSearchView.objects.create(**{**default_data, **kwargs})

    def test_simple(self):
        view1 = self.create_view(name="View 1")
        self.create_view(name="View 2")
        view3 = self.create_view(name="View 3")

        # Star view1 and view3 (skipping view2)
        GroupSearchViewStarred.objects.insert_starred_view(
            organization=self.org, user_id=self.user.id, view=view1, position=0
        )
        GroupSearchViewStarred.objects.insert_starred_view(
            organization=self.org, user_id=self.user.id, view=view3, position=1
        )

        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.org.slug})
        with self.feature(
            {"organizations:issue-stream-custom-views": True, "organizations:global-views": True}
        ):
            response = self.client.get(url)

        assert response.status_code == 200
        result = response.data
        assert len(result) == 2
        assert result[0]["name"] == "View 1"
        assert result[0]["position"] == 0
        assert result[1]["name"] == "View 3"
        assert result[1]["position"] == 1

    def test_feature_flag_required(self):
        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": self.org.slug})
        response = self.client.get(url)
        assert response.status_code == 404
