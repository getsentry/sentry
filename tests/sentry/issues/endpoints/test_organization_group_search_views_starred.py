from typing import int
from datetime import datetime

from sentry.models.groupsearchview import GroupSearchView, GroupSearchViewVisibility
from sentry.models.groupsearchviewlastvisited import GroupSearchViewLastVisited
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.testutils.cases import APITestCase
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
