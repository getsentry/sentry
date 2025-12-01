from datetime import datetime

from sentry.models.groupsearchview import GroupSearchView, GroupSearchViewVisibility
from sentry.models.groupsearchviewlastvisited import GroupSearchViewLastVisited
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.user import User


class OrganizationGroupSearchViewsStarredEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-search-views-starred"
    method = "get"

    def create_view(
        self,
        user: User,
        name: str = "Test View",
        starred: bool = False,
        last_visited: datetime | None = None,
    ) -> GroupSearchView:
        view = GroupSearchView.objects.create(
            name=name,
            organization=self.organization,
            user_id=user.id,
            query="is:unresolved",
            query_sort="date",
            visibility=GroupSearchViewVisibility.ORGANIZATION,
        )

        if starred:
            GroupSearchViewStarred.objects.insert_starred_view(
                user_id=user.id,
                organization=self.organization,
                view=view,
            )
        if last_visited:
            GroupSearchViewLastVisited.objects.create(
                user_id=user.id,
                organization=self.organization,
                group_search_view=view,
                last_visited=last_visited,
            )
        return view

    def star_view(self, user: User, view: GroupSearchView) -> None:
        GroupSearchViewStarred.objects.insert_starred_view(
            user_id=user.id,
            organization=self.organization,
            view=view,
        )

    def test_simple_case(self) -> None:
        self.login_as(user=self.user)
        view_1 = self.create_view(user=self.user, name="Starred View 1", starred=True)
        view_2 = self.create_view(user=self.user, name="Starred View 2", starred=True)
        view_3 = self.create_view(user=self.user, name="Starred View 3", starred=True)
        # These views should not appear in the response
        self.create_view(user=self.user, name="Unstarred View 1", starred=False)
        self.create_view(user=self.user, name="Unstarred View 2", starred=False)
        self.create_view(user=self.user, name="Unstarred View 3", starred=False)

        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 3
        assert response.data[0]["id"] == str(view_1.id)
        assert response.data[1]["id"] == str(view_2.id)
        assert response.data[2]["id"] == str(view_3.id)

    def test_views_starred_by_many_users(self) -> None:
        user_1 = self.user
        user_2 = self.create_user()
        self.create_member(user=user_2, organization=self.organization)
        user_3 = self.create_user()
        self.create_member(user=user_3, organization=self.organization)

        u1_view_1 = self.create_view(user=user_1, name="Starred View 1", starred=True)
        u1_view_2 = self.create_view(user=user_1, name="Starred View 2", starred=True)
        u1_view_3 = self.create_view(user=user_1, name="Starred View 3", starred=True)

        # User 2 stars their own view, and view_1 and view_2
        u2_view = self.create_view(user=user_2, name="User 2 View", starred=True)
        self.star_view(user=user_2, view=u1_view_1)
        self.star_view(user=user_2, view=u1_view_2)

        # User 3 star view_1
        self.star_view(user=user_3, view=u1_view_1)

        self.login_as(user=user_1)

        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 3
        assert response.data[0]["id"] == str(u1_view_1.id)
        assert response.data[1]["id"] == str(u1_view_2.id)
        assert response.data[2]["id"] == str(u1_view_3.id)

        self.login_as(user=user_2)

        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 3
        assert response.data[0]["id"] == str(u2_view.id)
        assert response.data[1]["id"] == str(u1_view_1.id)
        assert response.data[2]["id"] == str(u1_view_2.id)

        self.login_as(user=user_3)

        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(u1_view_1.id)

    def test_handles_none_from_user_service(self) -> None:
        """
        Test that when user_service.serialize_many() returns None for a user,
        the endpoint handles it gracefully without crashing.

        This can happen when a user is deleted from the system but their views remain.

        Ref: https://linear.app/getsentry/issue/ISWF-719
        """
        self.login_as(user=self.user)

        # Create a second user and member
        deleted_user = self.create_user()
        self.create_member(user=deleted_user, organization=self.organization)

        # Create views by both users
        active_user_view = self.create_view(user=self.user, name="Active User View")
        deleted_user_view = self.create_view(user=deleted_user, name="Deleted User View")

        # Star both views as self.user
        self.star_view(user=self.user, view=active_user_view)
        self.star_view(user=self.user, view=deleted_user_view)

        # Delete the user who created one of the views
        with assume_test_silo_mode(SiloMode.CONTROL):
            deleted_user.delete()

        response = self.get_success_response(self.organization.slug)

        # Both views should be returned without crashing
        assert len(response.data) == 2

        # One view should have createdBy populated, the other should be None
        created_by_values = [view.get("createdBy") for view in response.data]
        assert any(cb is not None for cb in created_by_values)
        assert any(cb is None for cb in created_by_values)
