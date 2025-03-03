from django.urls import reverse

from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.testutils.helpers import with_feature
from tests.sentry.issues.endpoints.test_organization_group_search_views import BaseGSVTestCase


class OrganizationGroupSearchViewsDeleteTest(BaseGSVTestCase):
    endpoint = "sentry-api-0-organization-group-search-view-details"
    method = "delete"

    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.base_data = self.create_base_data()

        # Get the first view's ID for testing
        self.view_id = str(self.base_data["user_one_views"][0].id)

        self.url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": self.view_id},
        )

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_delete_view_success(self) -> None:

        response = self.client.delete(self.url)
        assert response.status_code == 204

        # Verify the view was deleted
        assert not GroupSearchView.objects.filter(id=self.view_id).exists()

        # Verify other views still exist
        remaining_views = GroupSearchView.objects.filter(
            organization=self.organization, user_id=self.user.id
        )
        assert remaining_views.count() == 2

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_delete_nonexistent_view(self) -> None:
        """Test that attempting to delete a nonexistent view returns 404."""
        nonexistent_id = "99999"
        url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": nonexistent_id},
        )

        response = self.client.delete(url)
        assert response.status_code == 404

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_delete_view_from_another_user(self) -> None:
        # Get a view ID from user_two
        view_id = str(self.base_data["user_two_views"][0].id)
        url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": view_id},
        )

        response = self.client.delete(url)
        assert response.status_code == 404

        # Verify the view still exists (this will error out if not)
        GroupSearchView.objects.get(id=view_id)

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_delete_first_starred_view_decrements_succeeding_positions(self) -> None:
        for idx, view in enumerate(self.base_data["user_one_views"]):
            GroupSearchViewStarred.objects.create(
                group_search_view=view,
                user_id=self.user.id,
                organization_id=self.organization.id,
                position=idx,
            )

        # Delete the first view
        response = self.client.delete(self.url)
        assert response.status_code == 204

        assert GroupSearchViewStarred.objects.count() == 2

        # All succeeeding views should have their position decremented
        for idx, gsv in enumerate(
            GroupSearchViewStarred.objects.filter(
                organization_id=self.organization.id, user_id=self.user.id
            )
        ):
            assert self.base_data["user_one_views"][idx + 1].id == gsv.group_search_view.id
            assert gsv.position == idx

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_delete_last_starred_view_does_not_decrement_positions(self) -> None:
        for idx, view in enumerate(self.base_data["user_one_views"]):
            GroupSearchViewStarred.objects.create(
                group_search_view=view,
                user_id=self.user.id,
                organization_id=self.organization.id,
                position=idx,
            )

        # Delete the last view
        response = self.client.delete(
            reverse(
                "sentry-api-0-organization-group-search-view-details",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "view_id": self.base_data["user_one_views"][-1].id,
                },
            )
        )
        assert response.status_code == 204

        assert GroupSearchViewStarred.objects.count() == 2

        for idx, gsv in enumerate(
            GroupSearchViewStarred.objects.filter(
                organization_id=self.organization.id, user_id=self.user.id
            )
        ):
            assert self.base_data["user_one_views"][idx].id == gsv.group_search_view.id

    def test_delete_without_feature_flag(self) -> None:
        response = self.client.delete(self.url)
        assert response.status_code == 404

        GroupSearchView.objects.get(id=self.view_id)
