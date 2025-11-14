from typing import int
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.models.groupsearchview import GroupSearchView, GroupSearchViewVisibility
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.testutils.cases import APITestCase, TransactionTestCase


class OrganizationGroupSearchViewStarredOrderEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-search-view-starred-order"

    def setUp(self) -> None:
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
                visibility=GroupSearchViewVisibility.ORGANIZATION,
            )
            self.views.append(view)

        self.non_starred_view = GroupSearchView.objects.create(
            name="Non Starred View",
            organization=self.organization,
            user_id=self.user.id,
            query="is:unresolved non_starred",
            query_sort="date",
            visibility=GroupSearchViewVisibility.ORGANIZATION,
        )

        self.user_2_view = GroupSearchView.objects.create(
            name="User 2 View",
            organization=self.organization,
            user_id=self.user_2.id,
            query="is:unresolved user_2",
            query_sort="date",
            visibility=GroupSearchViewVisibility.ORGANIZATION,
        )

        self.shared_view = GroupSearchView.objects.create(
            name="Shared View",
            organization=self.organization,
            user_id=self.user_2.id,
            query="is:unresolved shared",
            query_sort="date",
            visibility=GroupSearchViewVisibility.ORGANIZATION,
        )

    def star_views(self, view_ids: list[int]) -> None:
        for idx, view_id in enumerate(view_ids):
            GroupSearchViewStarred.objects.create(
                organization=self.organization,
                user_id=self.user.id,
                group_search_view_id=view_id,
                position=idx,
            )

    def test_simple_reordering(self) -> None:
        self.star_views([self.views[0].id, self.views[1].id, self.views[2].id])

        new_order = [self.views[2].id, self.views[0].id, self.views[1].id]

        response = self.client.put(self.url, data={"view_ids": new_order}, format="json")

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

    def test_same_order_reordering(self) -> None:
        original_order = [self.views[0].id, self.views[1].id, self.views[2].id]

        self.star_views(original_order)

        response = self.client.put(self.url, data={"view_ids": original_order}, format="json")

        assert response.status_code == 204

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
        ).order_by("position")

        assert starred_views[0].group_search_view_id == self.views[0].id
        assert starred_views[0].position == 0

        assert starred_views[1].group_search_view_id == self.views[1].id
        assert starred_views[1].position == 1

        assert starred_views[2].group_search_view_id == self.views[2].id
        assert starred_views[2].position == 2

    def reordering_with_shared_views(self) -> None:
        self.star_views([self.views[0].id, self.views[1].id, self.views[2].id, self.shared_view.id])

        new_order = [self.shared_view.id, self.views[2].id, self.views[0].id, self.views[1].id]

        response = self.client.put(self.url, data={"view_ids": new_order}, format="json")

        assert response.status_code == 204

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
        ).order_by("position")

        assert starred_views[0].group_search_view_id == self.shared_view.id
        assert starred_views[0].position == 0

        assert starred_views[1].group_search_view_id == self.views[2].id
        assert starred_views[1].position == 1

        assert starred_views[2].group_search_view_id == self.views[0].id
        assert starred_views[2].position == 2

        assert starred_views[3].group_search_view_id == self.views[1].id
        assert starred_views[3].position == 3

    def test_empty_starred_list(self) -> None:
        response = self.client.put(self.url, data={"view_ids": []}, format="json")

        assert response.status_code == 204

        assert not GroupSearchViewStarred.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
        ).exists()

    def test_error_on_fewer_views_than_starred_views(self) -> None:
        self.star_views([self.views[0].id, self.views[1].id, self.views[2].id])

        response = self.client.put(
            self.url, data={"view_ids": [self.views[0].id, self.views[1].id]}, format="json"
        )

        assert response.status_code == 400

    def test_error_on_more_views_than_starred_views(self) -> None:
        self.star_views([self.views[0].id, self.views[1].id])

        response = self.client.put(
            self.url,
            data={"view_ids": [self.views[0].id, self.views[1].id, self.views[2].id]},
            format="json",
        )

        assert response.status_code == 400

    def test_error_on_duplicate_view_ids(self) -> None:
        view_ids = [self.views[0].id, self.views[1].id, self.views[1].id]

        response = self.client.put(self.url, data={"view_ids": view_ids}, format="json")

        assert response.status_code == 400
        assert response.data == {
            "view_ids": [
                ErrorDetail(string="Single view cannot take up multiple positions", code="invalid")
            ]
        }


class OrganizationGroupSearchViewStarredOrderTransactionTest(TransactionTestCase):
    endpoint = "sentry-api-0-organization-group-search-view-starred-order"

    def setUp(self) -> None:
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

    def test_nonexistent_view_id(self) -> None:
        non_existent_id = 373737
        view_ids = [self.view.id, non_existent_id]

        response = self.client.put(
            self.url,
            data={"view_ids": view_ids},
            format="json",
            content_type="application/json",
        )

        assert response.status_code == 400
