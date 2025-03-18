from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.models.groupsearchview import GroupSearchView, GroupSearchViewVisibility
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.testutils.cases import APITestCase, TransactionTestCase
from sentry.testutils.helpers.features import with_feature


class OrganizationGroupSearchViewStarredEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-search-view-starred"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.user_2 = self.create_user()

        self.url = reverse(
            self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug}
        )

        self.views = []
        for i in range(3):
            view = GroupSearchView.objects.create(
                name=f"View {i}",
                organization=self.organization,
                user_id=self.user.id,
                query=f"is:unresolved query:{i}",
                query_sort="date",
                position=i,
                visibility=GroupSearchViewVisibility.OWNER,
            )
            self.views.append(view)
            # Create starred entries for the views
            GroupSearchViewStarred.objects.create(
                organization=self.organization,
                user_id=self.user.id,
                group_search_view=view,
                position=i,
            )

        self.non_starred_view = GroupSearchView.objects.create(
            name="Non Starred View",
            organization=self.organization,
            user_id=self.user.id,
            query="is:unresolved non_starred",
            query_sort="date",
            visibility=GroupSearchViewVisibility.OWNER,
        )

        self.user_2_view = GroupSearchView.objects.create(
            name="User 2 View",
            organization=self.organization,
            user_id=self.user_2.id,
            query="is:unresolved user_2",
            query_sort="date",
            visibility=GroupSearchViewVisibility.OWNER,
        )

        self.shared_view = GroupSearchView.objects.create(
            name="Shared View",
            organization=self.organization,
            user_id=self.user_2.id,
            query="is:unresolved shared",
            query_sort="date",
            visibility=GroupSearchViewVisibility.ORGANIZATION,
        )

    @with_feature("organizations:issue-view-sharing")
    def test_simple_reordering(self):
        view_ids = [self.views[2].id, self.views[0].id, self.views[1].id]

        response = self.client.put(self.url, data={"view_ids": view_ids}, format="json")

        assert response.status_code == 204

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
        ).order_by("position")

        assert starred_views[0].group_search_view_id == self.views[2].id
        assert starred_views[0].position == 0

        assert starred_views[1].group_search_view_id == self.views[0].id
        assert starred_views[1].position == 1

        assert starred_views[2].group_search_view_id == self.views[1].id
        assert starred_views[2].position == 2

    @with_feature("organizations:issue-view-sharing")
    def test_remove_view_from_starred(self):
        view_ids = [self.views[0].id, self.views[2].id]

        response = self.client.put(self.url, data={"view_ids": view_ids}, format="json")

        assert response.status_code == 204

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
        ).order_by("position")

        assert len(starred_views) == 2
        assert starred_views[0].group_search_view_id == self.views[0].id
        assert starred_views[0].position == 0

        assert starred_views[1].group_search_view_id == self.views[2].id
        assert starred_views[1].position == 1

        assert not GroupSearchViewStarred.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
            group_search_view_id=self.views[1].id,
        ).exists()

    @with_feature("organizations:issue-view-sharing")
    def test_star_new_personal_view(self):
        view_ids = [self.views[0].id, self.non_starred_view.id, self.views[1].id, self.views[2].id]

        response = self.client.put(self.url, data={"view_ids": view_ids}, format="json")

        assert response.status_code == 204

        # Verify the new positions
        starred_views = GroupSearchViewStarred.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
        ).order_by("position")

        assert len(starred_views) == 4
        assert starred_views[0].group_search_view_id == self.views[0].id
        assert starred_views[1].group_search_view_id == self.non_starred_view.id
        assert starred_views[2].group_search_view_id == self.views[1].id
        assert starred_views[3].group_search_view_id == self.views[2].id

    @with_feature("organizations:issue-view-sharing")
    def test_star_new_shared_view(self):
        view_ids = [self.views[0].id, self.shared_view.id, self.views[1].id, self.views[2].id]

        response = self.client.put(self.url, data={"view_ids": view_ids}, format="json")

        assert response.status_code == 204

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
        ).order_by("position")

        assert len(starred_views) == 4
        assert starred_views[0].group_search_view_id == self.views[0].id
        assert starred_views[1].group_search_view_id == self.shared_view.id
        assert starred_views[2].group_search_view_id == self.views[1].id
        assert starred_views[3].group_search_view_id == self.views[2].id

    @with_feature("organizations:issue-view-sharing")
    def test_empty_starred_list(self):
        response = self.client.put(self.url, data={"view_ids": []}, format="json")

        assert response.status_code == 204

        assert not GroupSearchViewStarred.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
        ).exists()

    @with_feature("organizations:issue-view-sharing")
    def test_duplicate_view_ids(self):
        view_ids = [self.views[0].id, self.views[1].id, self.views[1].id]

        response = self.client.put(self.url, data={"view_ids": view_ids}, format="json")

        assert response.status_code == 400
        assert response.data == {
            "view_ids": [
                ErrorDetail(string="Single view cannot take up multiple positions", code="invalid")
            ]
        }

    @with_feature("organizations:issue-view-sharing")
    def test_inaccessible_view(self):
        view_ids = [self.views[0].id, self.user_2_view.id]

        response = self.client.put(self.url, data={"view_ids": view_ids}, format="json")

        assert response.status_code == 400
        assert response.data == {
            "view_ids": [
                ErrorDetail(string="You do not have access to one or more views", code="invalid")
            ]
        }


class OrganizationGroupSearchViewStarredOrderTransactionTest(TransactionTestCase):
    endpoint = "sentry-api-0-organization-group-search-view-starred"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.url = reverse(
            self.endpoint, kwargs={"organization_id_or_slug": self.organization.slug}
        )

        self.view = GroupSearchView.objects.create(
            name="View",
            organization=self.organization,
            user_id=self.user.id,
            query="is:unresolved",
            query_sort="date",
        )

    @with_feature("organizations:issue-view-sharing")
    def test_nonexistent_view_id(self):
        non_existent_id = 373737
        view_ids = [self.view.id, non_existent_id]

        response = self.client.put(
            self.url,
            data={"view_ids": view_ids},
            format="json",
            content_type="application/json",
        )

        assert response.status_code == 400
