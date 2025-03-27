from django.urls import reverse

from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.silo.base import SiloMode
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import assume_test_silo_mode
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
        # Delete the first view
        response = self.client.delete(self.url)
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

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_delete_last_starred_view_does_not_decrement_positions(self) -> None:
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

    def test_delete_without_feature_flag(self) -> None:
        response = self.client.delete(self.url)
        assert response.status_code == 404

        GroupSearchView.objects.get(id=self.view_id)


class OrganizationGroupSearchViewsPutTest(BaseGSVTestCase):
    endpoint = "sentry-api-0-organization-group-search-view-details"
    method = "put"

    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.base_data = self.create_base_data()

        # Get the first view's ID for testing
        self.view_id = str(self.base_data["user_one_views"][0].id)

        self.url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": self.view_id},
        )

    @with_feature(
        {"organizations:issue-stream-custom-views": True, "organizations:global-views": True}
    )
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

    @with_feature({"organizations:issue-stream-custom-views": True})
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

    @with_feature({"organizations:issue-stream-custom-views": True})
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

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_put_with_visibility(self) -> None:
        # Make the user a team admin to set the view to organization visibility
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.update(is_staff=True)

        data = {
            "name": "Organization View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [self.project.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
            "visibility": "organization",
        }

        response = self.client.put(self.url, data=data)
        assert response.status_code == 200

        # Verify visibility was updated
        updated_view = GroupSearchView.objects.get(id=self.view_id)
        assert updated_view.visibility == "organization"

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_put_visibility_without_permission(self) -> None:
        user_without_permission = self.create_user()
        self.create_member(organization=self.organization, user=user_without_permission)

        self.login_as(user=user_without_permission)

        member_view = GroupSearchView.objects.create(
            organization=self.organization,
            user_id=user_without_permission.id,
            name="Personal View",
            query="is:unresolved",
            query_sort="date",
        )

        data = {
            "name": "Organization View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [self.project.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
            "visibility": "organization",
        }

        url = reverse(
            "sentry-api-0-organization-group-search-view-details",
            kwargs={"organization_id_or_slug": self.organization.slug, "view_id": member_view.id},
        )

        response = self.client.put(url, data=data)
        assert response.status_code == 400

        member_view.refresh_from_db()
        assert member_view.visibility == "owner"

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_put_with_starred(self) -> None:
        data = {
            "name": "Starred View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [self.project.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
            "starred": True,
        }

        response = self.client.put(self.url, data=data)
        assert response.status_code == 200

        starred_view = GroupSearchViewStarred.objects.filter(
            organization=self.organization, user_id=self.user.id, group_search_view_id=self.view_id
        ).first()

        assert starred_view is not None

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_put_update_unstar(self) -> None:
        # First make sure the view is starred
        data = {
            "name": "Starred View",
            "query": "is:unresolved",
            "projects": [self.project.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
            "starred": True,
        }

        self.client.put(self.url, data=data)

        data["starred"] = False
        response = self.client.put(self.url, data=data)
        assert response.status_code == 200

        starred_view = GroupSearchViewStarred.objects.filter(
            organization=self.organization, user_id=self.user.id, group_search_view_id=self.view_id
        ).first()

        assert starred_view is None

    @with_feature({"organizations:issue-stream-custom-views": True})
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

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_put_view_from_another_user(self) -> None:
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
        assert response.status_code == 404

    @with_feature({"organizations:issue-stream-custom-views": True})
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

    @with_feature({"organizations:issue-stream-custom-views": True})
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
