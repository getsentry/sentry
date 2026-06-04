from django.urls import reverse

from sentry.models.groupsearchview import GroupSearchView, GroupSearchViewVisibility
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.testutils.cases import APITestCase


class OrganizationGroupSearchViewDetailsStarredEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-search-view-starred"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)

    def get_url(self, view_id: int) -> str:
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "view_id": view_id,
            },
        )

    def create_view(
        self, user_id: int | None = None, visibility: str | None = None, starred: bool = False
    ) -> GroupSearchView:
        user_id = user_id or self.user.id
        visibility = visibility or GroupSearchViewVisibility.ORGANIZATION

        view = GroupSearchView.objects.create(
            name="Test View",
            organization=self.org,
            user_id=user_id,
            query="is:unresolved",
            query_sort="date",
            visibility=visibility,
        )
        if starred:
            GroupSearchViewStarred.objects.insert_starred_view(
                organization=self.org,
                user_id=user_id,
                view=view,
            )
        return view

    def test_view_not_found(self) -> None:
        response = self.client.post(self.get_url(737373), data={"starred": True})

        assert response.status_code == 404

    def test_organization_view_accessible(self) -> None:
        other_user = self.create_user()
        view = self.create_view(
            user_id=other_user.id, visibility=GroupSearchViewVisibility.ORGANIZATION
        )

        response = self.client.post(self.get_url(view.id), data={"starred": True})

        assert response.status_code == 200
        assert GroupSearchViewStarred.objects.filter(
            organization=self.org,
            user_id=self.user.id,
            group_search_view=view,
        ).exists()

    def test_invalid_request_data(self) -> None:
        view = self.create_view()

        # Missing starred field
        response = self.client.post(self.get_url(view.id), data={})
        assert response.status_code == 400

        # Invalid position when unstarring
        response = self.client.post(self.get_url(view.id), data={"starred": False, "position": 0})
        assert response.status_code == 400

    def test_star_view_with_position(self) -> None:
        view1 = self.create_view(starred=True)
        view2 = self.create_view(starred=True)
        view_to_be_starred = self.create_view()

        response = self.client.post(
            self.get_url(view_to_be_starred.id), data={"starred": True, "position": 1}
        )

        assert response.status_code == 200

        starred_view = GroupSearchViewStarred.objects.get(
            organization=self.org,
            user_id=self.user.id,
            group_search_view=view_to_be_starred,
        )
        assert starred_view.position == 1

        assert GroupSearchViewStarred.objects.filter(
            organization=self.org,
            user_id=self.user.id,
            group_search_view=view1,
            position=0,
        ).exists()
        assert GroupSearchViewStarred.objects.filter(
            organization=self.org,
            user_id=self.user.id,
            group_search_view=view2,
            position=2,
        ).exists()

    def test_star_view_without_position(self) -> None:
        view = self.create_view()

        response = self.client.post(self.get_url(view.id), data={"starred": True})

        assert response.status_code == 200

        starred_view = GroupSearchViewStarred.objects.get(
            organization=self.org,
            user_id=self.user.id,
            group_search_view=view,
        )

        assert starred_view.position == 0

    def test_unstar_view(self) -> None:
        starred_view = self.create_view(starred=True)
        view_to_be_unstarred = self.create_view(starred=True)

        response = self.client.post(self.get_url(view_to_be_unstarred.id), data={"starred": False})

        assert response.status_code == 200
        assert not GroupSearchViewStarred.objects.filter(
            organization=self.org,
            user_id=self.user.id,
            group_search_view=view_to_be_unstarred,
        ).exists()
        assert GroupSearchViewStarred.objects.filter(
            organization=self.org,
            user_id=self.user.id,
            group_search_view=starred_view,
        ).exists()

    def test_star_already_starred_view(self) -> None:
        view = self.create_view(starred=True)

        response = self.client.post(self.get_url(view.id), data={"starred": True})

        assert response.status_code == 204

    def test_unstar_not_starred_view(self) -> None:
        view = self.create_view()

        response = self.client.post(self.get_url(view.id), data={"starred": False})

        assert response.status_code == 204

    def test_multiple_starred_views_order(self) -> None:
        view1 = self.create_view()
        view2 = self.create_view()
        view3 = self.create_view()

        # Star view1 at position 0
        self.client.post(self.get_url(view1.id), data={"starred": True, "position": 0})

        # Star view2 at position 0, which should push view1 to position 1
        self.client.post(self.get_url(view2.id), data={"starred": True, "position": 0})

        # Star view3 at position 1, which should push view1 to position 2
        self.client.post(self.get_url(view3.id), data={"starred": True, "position": 1})

        # Check the final positions
        assert (
            GroupSearchViewStarred.objects.get(
                organization=self.org,
                user_id=self.user.id,
                group_search_view=view1,
            ).position
            == 2
        )

        assert (
            GroupSearchViewStarred.objects.get(
                organization=self.org,
                user_id=self.user.id,
                group_search_view=view2,
            ).position
            == 0
        )

        assert (
            GroupSearchViewStarred.objects.get(
                organization=self.org,
                user_id=self.user.id,
                group_search_view=view3,
            ).position
            == 1
        )

    def test_unstar_adjust_positions(self) -> None:
        view1 = self.create_view(starred=True)
        view2 = self.create_view(starred=True)
        view3 = self.create_view(starred=True)

        # Unstar the middle view (view2)
        self.client.post(self.get_url(view2.id), data={"starred": False})

        # Check that view3's position got adjusted to 1
        assert (
            GroupSearchViewStarred.objects.get(
                organization=self.org,
                user_id=self.user.id,
                group_search_view=view3,
            ).position
            == 1
        )

        # Check that view1 remains at position 0
        assert (
            GroupSearchViewStarred.objects.get(
                organization=self.org,
                user_id=self.user.id,
                group_search_view=view1,
            ).position
            == 0
        )
