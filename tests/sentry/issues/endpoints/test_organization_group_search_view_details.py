from django.urls import reverse
from django.utils import timezone

from sentry.models.groupsearchview import GroupSearchView, GroupSearchViewVisibility
from sentry.models.groupsearchviewlastvisited import GroupSearchViewLastVisited
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature


class BaseGSVTestCase(APITestCase):
    def create_base_data(self) -> dict[str, list[GroupSearchView]]:
        user_1 = self.user
        self.user_2 = self.create_user()
        self.user_3 = self.create_user()

        self.create_member(organization=self.organization, user=self.user_2)
        self.create_member(organization=self.organization, user=self.user_3)

        first_custom_view_user_one = GroupSearchView.objects.create(
            name="Custom View One",
            organization=self.organization,
            user_id=user_1.id,
            query="is:unresolved",
            query_sort="date",
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=user_1.id,
            group_search_view=first_custom_view_user_one,
            position=0,
        )

        # This is out of order to test that the endpoint returns the views in the correct order
        third_custom_view_user_one = GroupSearchView.objects.create(
            name="Custom View Three",
            organization=self.organization,
            user_id=user_1.id,
            query="is:ignored",
            query_sort="freq",
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=user_1.id,
            group_search_view=third_custom_view_user_one,
            position=2,
        )

        second_custom_view_user_one = GroupSearchView.objects.create(
            name="Custom View Two",
            organization=self.organization,
            user_id=user_1.id,
            query="is:resolved",
            query_sort="new",
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=user_1.id,
            group_search_view=second_custom_view_user_one,
            position=1,
        )

        first_custom_view_user_two = GroupSearchView.objects.create(
            name="Custom View One",
            organization=self.organization,
            user_id=self.user_2.id,
            query="is:unresolved",
            query_sort="date",
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=self.user_2.id,
            group_search_view=first_custom_view_user_two,
            position=0,
        )

        second_custom_view_user_two = GroupSearchView.objects.create(
            name="Custom View Two",
            organization=self.organization,
            user_id=self.user_2.id,
            query="is:resolved",
            query_sort="new",
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=self.user_2.id,
            group_search_view=second_custom_view_user_two,
            position=1,
        )

        return {
            "user_one_views": [
                first_custom_view_user_one,
                second_custom_view_user_one,
                third_custom_view_user_one,
            ],
            "user_two_views": [first_custom_view_user_two, second_custom_view_user_two],
        }


class OrganizationGroupSearchViewsGetTest(BaseGSVTestCase):
    endpoint = "sentry-api-0-organization-group-search-view-details"
    method = "get"

    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.base_data = self.create_base_data()

        # Get the first view's ID for testing
        self.view_id = str(self.base_data["user_one_views"][0].id)

        self.url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": self.view_id},
        )

    def test_get_view_success(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 200

        # Verify correct view was returned
        view = GroupSearchView.objects.get(id=self.view_id)
        assert response.data["id"] == self.view_id
        assert response.data["name"] == view.name
        assert response.data["query"] == view.query

    def test_get_nonexistent_view(self) -> None:
        nonexistent_id = "37373"
        url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": nonexistent_id},
        )

        response = self.client.get(url)
        assert response.status_code == 404

    def test_get_view_from_another_user(self) -> None:
        # Get a view ID from user_two
        view_id = str(self.base_data["user_two_views"][0].id)
        url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": view_id},
        )

        response = self.client.get(url)
        assert response.status_code == 200
        view = GroupSearchView.objects.get(id=view_id)
        assert response.data["id"] == view_id
        assert response.data["name"] == view.name
        assert response.data["query"] == view.query


class OrganizationGroupSearchViewsDeleteTest(BaseGSVTestCase):
    endpoint = "sentry-api-0-organization-group-search-view-details"
    method = "delete"

    def setUp(self) -> None:
        self.base_data = self.create_base_data()

        # For most tests, we'll be deleting views from user_2 (no special permissions)
        self.login_as(user=self.user_2)

        self.user_1_view_id = str(self.base_data["user_one_views"][0].id)
        self.user_2_view_id = str(self.base_data["user_two_views"][0].id)

        self.user_1_view_url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "view_id": self.user_1_view_id,
            },
        )
        self.user_2_view_url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "view_id": self.user_2_view_id,
            },
        )

    def test_delete_view_success(self) -> None:
        response = self.client.delete(self.user_2_view_url)
        assert response.status_code == 204

        # Verify the view was deleted
        assert not GroupSearchView.objects.filter(id=self.user_2_view_id).exists()

        # Verify other views still exist
        remaining_views = GroupSearchView.objects.filter(
            organization=self.organization, user_id=self.user_2.id
        )
        assert remaining_views.count() == 1

    def test_delete_nonexistent_view(self) -> None:
        """Test that attempting to delete a nonexistent view returns 404."""
        nonexistent_id = "99999"
        url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": nonexistent_id},
        )

        response = self.client.delete(url)
        assert response.status_code == 404

    def test_delete_view_from_another_user(self) -> None:
        view_id = str(self.base_data["user_one_views"][0].id)
        url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": view_id},
        )

        response = self.client.delete(url)
        assert response.status_code == 403

        # Verify the view still exists (this will error out if not)
        GroupSearchView.objects.get(id=view_id)

    def test_superuser_can_delete_view_from_another_user(self) -> None:
        # User 1 is a superuser
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "view_id": self.user_2_view_id,
            },
        )

        response = self.client.delete(url)
        assert response.status_code == 204

        assert not GroupSearchView.objects.filter(id=self.user_2_view_id).exists()

    def test_org_write_can_delete_view_from_another_user(self) -> None:
        self.admin_user = self.create_user()
        self.create_member(
            user=self.admin_user,
            organization=self.organization,
            role="manager",
        )
        self.login_as(user=self.admin_user)

        response = self.client.delete(self.user_1_view_url)
        assert response.status_code == 204

        assert not GroupSearchView.objects.filter(id=self.user_1_view_id).exists()

    def test_delete_first_starred_view_decrements_succeeding_positions(self) -> None:
        # Delete the first view
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "view_id": self.user_1_view_id,
            },
        )
        response = self.client.delete(url)
        assert response.status_code == 204

        assert (
            GroupSearchViewStarred.objects.filter(
                organization_id=self.organization.id, user_id=self.user.id
            ).count()
            == 2
        )

        # All succeeeding views should have their position decremented
        for idx, gsv in enumerate(
            GroupSearchViewStarred.objects.filter(
                organization_id=self.organization.id, user_id=self.user.id
            )
        ):
            assert self.base_data["user_one_views"][idx + 1].id == gsv.group_search_view.id
            assert gsv.position == idx

    def test_delete_last_starred_view_does_not_decrement_positions(self) -> None:
        # Delete the last view
        self.login_as(user=self.user)
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

        assert (
            GroupSearchViewStarred.objects.filter(
                organization_id=self.organization.id, user_id=self.user.id
            ).count()
            == 2
        )

        for idx, gsv in enumerate(
            GroupSearchViewStarred.objects.filter(
                organization_id=self.organization.id, user_id=self.user.id
            )
        ):
            assert self.base_data["user_one_views"][idx].id == gsv.group_search_view.id


class OrganizationGroupSearchViewsDeleteStarredAndLastVisitedTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-search-view-details"

    def setUp(self) -> None:
        super().setUp()

        self.user_1 = self.user
        self.user_2 = self.create_user()
        self.create_member(organization=self.organization, user=self.user_2)

        self.user_1_view = GroupSearchView.objects.create(
            organization=self.organization,
            user_id=self.user_1.id,
            name="User 1's View",
            query="is:unresolved",
            visibility=GroupSearchViewVisibility.ORGANIZATION,
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=self.user_1.id,
            group_search_view=self.user_1_view,
            position=0,
        )
        GroupSearchViewLastVisited.objects.create(
            organization=self.organization,
            user_id=self.user_1.id,
            group_search_view=self.user_1_view,
            last_visited=timezone.now(),
        )

        self.user_2_view = GroupSearchView.objects.create(
            organization=self.organization,
            user_id=self.user_2.id,
            name="User 2's View",
            query="is:unresolved",
            visibility=GroupSearchViewVisibility.ORGANIZATION,
        )

        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=self.user_2.id,
            group_search_view=self.user_1_view,
            position=0,
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=self.user_2.id,
            group_search_view=self.user_2_view,
            position=1,
        )

        GroupSearchViewLastVisited.objects.create(
            organization=self.organization,
            user_id=self.user_2.id,
            group_search_view=self.user_1_view,
            last_visited=timezone.now(),
        )

    @with_feature({"organizations:issue-views": True})
    def test_cannot_delete_other_users_view(self) -> None:
        self.login_as(user=self.user_2)

        response = self.client.delete(
            reverse(
                self.endpoint,
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "view_id": self.user_1_view.id,
                },
            )
        )

        assert response.status_code == 403

    @with_feature({"organizations:issue-views": True})
    def test_deleting_my_view_deletes_from_others_starred_views(self) -> None:
        self.login_as(user=self.user_1)

        response = self.client.delete(
            reverse(
                self.endpoint,
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "view_id": self.user_1_view.id,
                },
            )
        )

        assert response.status_code == 204
        # User 2 starred User 1's view. After User 1 deletes the view, it should not be starred for anyone anymore
        assert not GroupSearchViewStarred.objects.filter(
            organization_id=self.organization.id, group_search_view=self.user_1_view
        ).exists()
        # User 2's other starred view should be moved up to position 0
        assert (
            GroupSearchViewStarred.objects.get(
                organization_id=self.organization.id,
                user_id=self.user_2.id,
                group_search_view=self.user_2_view,
            ).position
            == 0
        )
        # All last visited entries should be deleted as well
        assert not GroupSearchViewLastVisited.objects.filter(
            organization_id=self.organization.id, group_search_view=self.user_1_view
        ).exists()


class OrganizationGroupSearchViewsPutTest(BaseGSVTestCase):
    endpoint = "sentry-api-0-organization-group-search-view-details"
    method = "put"

    def setUp(self) -> None:
        self.base_data = self.create_base_data()
        self.login_as(user=self.user_2)

        # Get the second user's views for testing
        self.view_id = str(self.base_data["user_two_views"][0].id)

        self.url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": self.view_id},
        )

    @with_feature({"organizations:issue-views": True, "organizations:global-views": True})
    def test_put_view_success(self) -> None:
        data = {
            "name": "Updated View Name",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [self.project.id],
            "isAllProjects": False,
            "environments": ["production"],
            "timeFilters": {"period": "14d"},
        }

        response = self.client.put(self.url, data=data)
        assert response.status_code == 200

        # Verify the view was updated
        updated_view = GroupSearchView.objects.get(id=self.view_id)
        assert updated_view.name == "Updated View Name"
        assert updated_view.query == "is:unresolved"
        assert updated_view.query_sort == "date"
        assert updated_view.is_all_projects is False
        assert list(updated_view.projects.values_list("id", flat=True)) == [self.project.id]
        assert updated_view.environments == ["production"]
        assert updated_view.time_filters == {"period": "14d"}

    @with_feature({"organizations:issue-views": True})
    @with_feature({"organizations:global-views": True})
    def test_put_update_projects(self) -> None:
        second_project = self.create_project(organization=self.organization)

        data = {
            "name": "Updated Projects View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [self.project.id, second_project.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.client.put(self.url, data=data)
        assert response.status_code == 200

        # Verify the projects were updated
        updated_view = GroupSearchView.objects.get(id=self.view_id)
        assert set(updated_view.projects.values_list("id", flat=True)) == {
            self.project.id,
            second_project.id,
        }

    @with_feature({"organizations:issue-views": True})
    @with_feature({"organizations:global-views": True})
    def test_put_all_projects(self) -> None:
        data = {
            "name": "All Projects View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [-1],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.client.put(self.url, data=data)
        assert response.status_code == 200

        # Verify isAllProjects was set
        updated_view = GroupSearchView.objects.get(id=self.view_id)
        assert updated_view.is_all_projects is True
        assert updated_view.projects.count() == 0

    @with_feature({"organizations:issue-views": True})
    def test_put_nonexistent_view(self) -> None:
        nonexistent_id = "99999"
        url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": nonexistent_id},
        )

        data = {
            "name": "Updated View",
            "query": "is:unresolved",
            "projects": [self.project.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.client.put(url, data=data)
        assert response.status_code == 404

    @with_feature({"organizations:issue-views": True})
    def test_put_view_from_another_user(self) -> None:
        # Log in as user 3 (no access to user_two's views)
        self.login_as(user=self.user_3)
        # Get a view ID from user_two
        view_id = str(self.base_data["user_two_views"][0].id)
        url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": view_id},
        )

        data = {
            "name": "Updated View",
            "query": "is:unresolved",
            "projects": [self.project.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.client.put(url, data=data)
        assert response.status_code == 403

    @with_feature({"organizations:issue-views": True})
    def test_put_view_from_another_user_superuser(self) -> None:
        # User 1 is a superuser
        self.login_as(user=self.user)
        # Get a view ID from user_two
        view_id = str(self.base_data["user_two_views"][0].id)
        url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": view_id},
        )

        data = {
            "name": "Updated View",
            "query": "is:unresolved",
            "projects": [self.project.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.client.put(url, data=data)
        assert response.status_code == 200

        # Verify the view was updated
        updated_view = GroupSearchView.objects.get(id=self.view_id)
        assert updated_view.name == "Updated View"

    @with_feature({"organizations:issue-views": True})
    def test_put_invalid_data(self) -> None:
        # Missing required timeFilters
        data = {
            "name": "Invalid View",
            "query": "is:unresolved",
            "projects": [self.project.id],
            "environments": [],
        }

        response = self.client.put(self.url, data=data)
        assert response.status_code == 400

    @with_feature({"organizations:issue-views": True})
    def test_put_multi_project_without_global_views(self) -> None:
        second_project = self.create_project(organization=self.organization)

        data = {
            "name": "Multi Project View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [self.project.id, second_project.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.client.put(self.url, data=data)
        assert response.status_code == 400
        assert "projects" in response.data

    def test_put_without_feature_flag(self) -> None:
        data = {
            "name": "Updated View",
            "query": "is:unresolved",
            "projects": [self.project.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.client.put(self.url, data=data)
        assert response.status_code == 404
