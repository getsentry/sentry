from typing import Any

from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ErrorDetail

from sentry.api.serializers.rest_framework.groupsearchview import GroupSearchViewValidatorResponse
from sentry.models.groupsearchview import DEFAULT_VIEWS, GroupSearchView, GroupSearchViewVisibility
from sentry.models.groupsearchviewlastvisited import GroupSearchViewLastVisited
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.testutils.cases import APITestCase, TransactionTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature


# Ignores the dateCreated and dateUpdated fields
def are_views_equal(
    view_1: GroupSearchViewValidatorResponse, view_2: GroupSearchViewValidatorResponse
) -> bool:
    return (
        view_1["name"] == view_2["name"]
        and view_1["query"] == view_2["query"]
        and view_1["querySort"] == view_2["querySort"]
        and view_1["environments"] == view_2["environments"]
        and view_1["timeFilters"] == view_2["timeFilters"]
        and view_1["projects"] == view_2["projects"]
    )


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
    endpoint = "sentry-api-0-organization-group-search-views"
    method = "get"

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_get_user_one_custom_views(self) -> None:
        objs = self.create_base_data()

        self.login_as(user=self.user)
        response = self.get_success_response(self.organization.slug)

        assert response.data[0]["id"] == str(objs["user_one_views"][0].id)
        assert response.data[1]["id"] == str(objs["user_one_views"][1].id)
        assert response.data[2]["id"] == str(objs["user_one_views"][2].id)

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_last_visited_exists_for_seen_views(self) -> None:
        objs = self.create_base_data()

        with freeze_time("2025-03-07T00:00:00Z"):
            GroupSearchViewLastVisited.objects.create(
                user_id=self.user.id,
                organization=self.organization,
                group_search_view=objs["user_one_views"][0],
                last_visited=timezone.now(),
            )

            self.login_as(user=self.user)
            response = self.get_success_response(self.organization.slug)

            assert len(response.data) == 3

            assert response.data[0]["lastVisited"] == timezone.now()
            # Second and third views should not have lastVisited
            assert not response.data[1]["lastVisited"]
            assert not response.data[2]["lastVisited"]

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_get_user_two_custom_views(self) -> None:
        objs = self.create_base_data()

        self.login_as(user=self.user_2)
        response = self.get_success_response(self.organization.slug)

        assert response.data[0]["id"] == str(objs["user_two_views"][0].id)
        assert response.data[1]["id"] == str(objs["user_two_views"][1].id)

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_get_default_views(self) -> None:
        self.create_base_data()

        self.login_as(user=self.user_3)
        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 1

        view = response.data[0]

        assert view["name"] == "Prioritized"
        assert view["query"] == "is:unresolved issue.priority:[high, medium]"
        assert view["querySort"] == "date"

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_get_views_has_correct_default_page_filters(self) -> None:
        self.create_base_data()

        self.login_as(user=self.user)
        response = self.get_success_response(self.organization.slug)

        assert response.data[0]["timeFilters"] == {"period": "14d"}
        assert response.data[0]["projects"] == []
        assert response.data[0]["environments"] == []


class OrganizationGroupSearchViewsPostTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-search-views"
    method = "post"

    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.project1 = self.create_project(organization=self.organization, slug="project-a")
        self.project2 = self.create_project(organization=self.organization, slug="project-b")
        self.url = reverse(
            "sentry-api-0-organization-group-search-views",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_create_basic_view(self) -> None:
        data = {
            "name": "Custom View One",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.get_success_response(self.organization.slug, **data, status_code=201)

        assert response.data["name"] == "Custom View One"
        assert response.data["query"] == "is:unresolved"
        assert response.data["querySort"] == "date"
        assert response.data["projects"] == []
        assert response.data["environments"] == []
        assert response.data["timeFilters"] == {"period": "14d"}

        view = GroupSearchView.objects.get(id=response.data["id"])
        assert view.name == "Custom View One"
        assert view.query == "is:unresolved"
        assert view.query_sort == "date"

        assert not GroupSearchViewStarred.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
            group_search_view=view,
        ).exists()

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_create_view_with_projects(self) -> None:
        """Test creating a view with specific projects"""
        data = {
            "name": "Project View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [self.project1.id, self.project2.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.get_success_response(self.organization.slug, **data, status_code=201)

        assert set(response.data["projects"]) == {self.project1.id, self.project2.id}

        # Verify the projects association in the database
        view = GroupSearchView.objects.get(id=response.data["id"])
        assert set(view.projects.values_list("id", flat=True)) == {
            self.project1.id,
            self.project2.id,
        }

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_create_view_all_projects(self) -> None:
        """Test creating a view for all projects"""
        data = {
            "name": "All Projects View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [-1],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.get_success_response(self.organization.slug, **data, status_code=201)

        assert response.data["projects"] == [-1]

        # Verify in the database
        view = GroupSearchView.objects.get(id=response.data["id"])
        assert view.is_all_projects is True
        assert list(view.projects.all()) == []  # No projects should be associated

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_create_view_with_environments(self) -> None:
        """Test creating a view with specific environments"""
        data = {
            "name": "Environment View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [],
            "environments": ["production", "staging"],
            "timeFilters": {"period": "14d"},
        }

        response = self.get_success_response(self.organization.slug, **data, status_code=201)

        assert set(response.data["environments"]) == {"production", "staging"}

        # Verify in the database
        view = GroupSearchView.objects.get(id=response.data["id"])
        assert set(view.environments) == {"production", "staging"}

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_create_view_with_time_filters(self) -> None:
        """Test creating a view with custom time filters"""
        data = {
            "name": "Time Filtered View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [],
            "environments": [],
            "timeFilters": {"period": "90d"},
        }

        response = self.get_success_response(self.organization.slug, **data, status_code=201)

        assert response.data["timeFilters"] == {"period": "90d"}

        # Verify in the database
        view = GroupSearchView.objects.get(id=response.data["id"])
        assert view.time_filters == {"period": "90d"}

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_create_view_with_starred(self) -> None:
        data = {
            "name": "Starred View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [],
            "environments": [],
            "timeFilters": {"period": "14d"},
            "starred": True,
        }

        response = self.get_success_response(self.organization.slug, **data, status_code=201)

        view_id = response.data["id"]
        assert GroupSearchViewStarred.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
            group_search_view_id=view_id,
        ).exists()

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": False})
    def test_create_view_without_global_views(self) -> None:
        data = {
            "name": "No Global View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [self.project1.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.get_success_response(self.organization.slug, **data, status_code=201)

        assert response.data["projects"] == [self.project1.id]

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": False})
    def test_invalid_multiple_projects_without_global_views(self) -> None:
        data = {
            "name": "Multiple Projects View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [self.project1.id, self.project2.id],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.get_error_response(self.organization.slug, **data)

        assert "You do not have the multi project stream feature enabled" in str(response.data)

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": False})
    def test_invalid_all_projects_without_global_views(self) -> None:
        data = {
            "name": "All Projects View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [-1],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.get_error_response(self.organization.slug, **data)

        assert "You do not have the multi project stream feature enabled" in str(response.data)

    @with_feature({"organizations:issue-stream-custom-views": False})
    def test_feature_flag_disabled(self) -> None:
        data = {
            "name": "Custom View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.get_response(self.organization.slug, **data)
        assert response.status_code == 404

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_invalid_sort_option(self) -> None:
        data = {
            "name": "Invalid Sort View",
            "query": "is:unresolved",
            "querySort": "invalid_sort",
            "projects": [],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.get_error_response(self.organization.slug, **data)
        assert "querySort" in response.data

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_invalid_time_filters(self) -> None:
        data = {
            "name": "Invalid Time Filters View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [],
            "environments": [],
            "timeFilters": {},  # Empty time filters
        }

        response = self.get_error_response(self.organization.slug, **data)
        assert "timeFilters" in response.data

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_nonexistent_project(self) -> None:
        data = {
            "name": "Nonexistent Project View",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [999999],  # This project ID should not exist
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.get_error_response(self.organization.slug, **data)
        assert "projects" in response.data


class OrganizationGroupSearchViewsPutTest(BaseGSVTestCase):
    endpoint = "sentry-api-0-organization-group-search-views"
    method = "put"

    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.base_data = self.create_base_data()

        self.url = reverse(
            "sentry-api-0-organization-group-search-views",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_deletes_missing_views(self) -> None:
        views = self.client.get(self.url).data

        update_custom_view_three = views[2]
        # Store the ID of the view we're going to delete
        deleted_view_id = views[1]["id"]

        views.pop(1)
        response = self.get_success_response(self.organization.slug, views=views)

        # Since we removed custom view two from the views list, custom view three
        # should now be at position 1 (previously position 2)
        update_custom_view_three["position"] = 1

        assert len(response.data) == 2
        # The first view should remain unchanged
        assert are_views_equal(response.data[0], views[0])
        assert are_views_equal(response.data[1], update_custom_view_three)

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=self.organization, user_id=self.user.id
        )
        assert len(starred_views) == len(response.data)
        for idx, view in enumerate(response.data):
            assert starred_views[idx].position == idx
            assert str(starred_views[idx].group_search_view.id) == view["id"]

        # Verify that the deleted view is no longer in the starred table
        assert not GroupSearchViewStarred.objects.filter(
            organization=self.organization,
            user_id=self.user.id,
            group_search_view_id=deleted_view_id,
        ).exists()

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_adds_view_with_no_id(self) -> None:
        views = self.client.get(self.url).data
        views.append(
            {
                "name": "Custom View Four",
                "query": "is:unresolved",
                "querySort": "date",
                "projects": [],
                "environments": [],
                "timeFilters": {"period": "14d"},
            }
        )

        response = self.get_success_response(self.organization.slug, views=views)

        assert len(response.data) == 4  # 3 existing views + 1 new view
        assert response.data[3]["name"] == "Custom View Four"
        assert response.data[3]["query"] == "is:unresolved"
        assert response.data[3]["querySort"] == "date"

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=self.organization, user_id=self.user.id
        )
        assert len(starred_views) == len(response.data)
        for idx, view in enumerate(response.data):
            assert starred_views[idx].position == idx
            assert str(starred_views[idx].group_search_view.id) == view["id"]

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    @freeze_time("2025-03-07T00:00:00Z")
    def test_response_with_last_visited(self) -> None:
        GroupSearchViewLastVisited.objects.create(
            user_id=self.user.id,
            organization=self.organization,
            group_search_view=self.base_data["user_one_views"][0],
            last_visited=timezone.now(),
        )

        views = self.client.get(self.url).data
        response = self.get_success_response(self.organization.slug, views=views)

        assert response.data[0]["lastVisited"] == timezone.now()
        assert response.data[1]["lastVisited"] is None

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_reorder_views(self) -> None:
        views = self.client.get(self.url).data
        view_one, view_two = views[0], views[1]
        views[0], views[1] = view_two, view_one

        response = self.get_success_response(self.organization.slug, views=views)

        assert len(response.data) == 3
        assert are_views_equal(response.data[0], view_two)
        assert are_views_equal(response.data[1], view_one)
        assert are_views_equal(response.data[2], views[2])

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=self.organization, user_id=self.user.id
        )
        assert len(starred_views) == len(response.data)
        for idx, view in enumerate(response.data):
            assert starred_views[idx].position == idx
            assert str(starred_views[idx].group_search_view.id) == view["id"]

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_rename_views(self) -> None:
        views = self.client.get(self.url).data
        view = views[0]
        view["name"] = "New Name"
        response = self.get_success_response(self.organization.slug, views=views)
        assert len(response.data) == 3
        assert response.data[0]["name"] == "New Name"
        assert response.data[0]["query"] == view["query"]
        assert response.data[0]["querySort"] == view["querySort"]

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_change_query(self) -> None:
        views = self.client.get(self.url).data
        view = views[0]
        view["query"] = "is:resolved"
        response = self.get_success_response(self.organization.slug, views=views)
        assert len(response.data) == 3
        assert response.data[0]["name"] == view["name"]
        assert response.data[0]["query"] == "is:resolved"
        assert response.data[0]["querySort"] == view["querySort"]

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_change_sort(self) -> None:
        views = self.client.get(self.url).data
        view = views[0]
        view["querySort"] = "freq"
        response = self.get_success_response(self.organization.slug, views=views)
        assert len(response.data) == 3
        assert response.data[0]["name"] == view["name"]
        assert response.data[0]["query"] == view["query"]
        assert response.data[0]["querySort"] == "freq"

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_change_everything(self) -> None:
        views = self.client.get(self.url).data
        view = views[0]
        view["name"] = "New Name"
        view["query"] = "is:resolved"
        view["querySort"] = "freq"
        response = self.get_success_response(self.organization.slug, views=views)
        assert len(response.data) == 3
        assert response.data[0]["name"] == "New Name"
        assert response.data[0]["query"] == "is:resolved"
        assert response.data[0]["querySort"] == "freq"

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=self.organization, user_id=self.user.id
        )
        assert len(starred_views) == len(response.data)
        for idx, view in enumerate(response.data):
            assert starred_views[idx].position == idx
            assert str(starred_views[idx].group_search_view.id) == view["id"]

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_invalid_no_views(self) -> None:
        response = self.get_error_response(self.organization.slug, views=[])

        assert response.data == {
            "views": [
                ErrorDetail(string="Ensure this field has at least 1 elements.", code="min_length")
            ]
        }

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_invalid_sort(self) -> None:
        views = self.client.get(self.url).data
        view = views[0]
        view["querySort"] = "alphabetically"
        response = self.get_error_response(self.organization.slug, views=views)

        assert response.data == {
            "views": {
                "querySort": [
                    ErrorDetail(
                        string='"alphabetically" is not a valid choice.', code="invalid_choice"
                    )
                ]
            }
        }

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_invalid_over_max_views(self) -> None:
        from sentry.api.serializers.rest_framework.groupsearchview import MAX_VIEWS

        views = [
            {
                "name": f"Custom View {i}",
                "query": "is:unresolved",
                "querySort": "date",
                "projects": [],
                "environments": [],
                "timeFilters": {"period": "14d"},
            }
            for i in range(MAX_VIEWS + 1)
        ]
        response = self.get_error_response(self.organization.slug, views=views)
        assert response.data == {
            "views": [
                ErrorDetail(
                    string="Ensure this field has no more than 50 elements.", code="max_length"
                )
            ]
        }

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_updated_deleted_view(self) -> None:
        views = self.client.get(self.url).data

        updated_views = views[1:]

        # First delete a view
        self.get_success_response(self.organization.slug, views=updated_views)

        # Then reorder the tabs as if the deleted view is still there
        view_one, view_two = views[0], views[1]
        views[0], views[1] = view_two, view_one

        # Then save the views as if the deleted view is still there
        response = self.get_success_response(self.organization.slug, views=views)

        assert len(response.data) == 3
        # Unlike in the plain reordering test, the ids are going to be different here but the views are otherwise the same,
        # So we need to check for equality of the fields instead of the objects themselves
        assert response.data[0]["query"] == view_two["query"]
        assert response.data[0]["querySort"] == view_two["querySort"]
        assert response.data[1]["query"] == view_one["query"]
        assert response.data[1]["querySort"] == view_one["querySort"]
        assert are_views_equal(response.data[2], views[2])

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=self.organization, user_id=self.user.id
        )
        assert len(starred_views) == len(response.data)
        for idx, view in enumerate(response.data):
            assert starred_views[idx].position == idx
            assert str(starred_views[idx].group_search_view.id) == view["id"]


class OrganizationGroupSearchViewsWithPageFiltersPutTest(BaseGSVTestCase):
    endpoint = "sentry-api-0-organization-group-search-views"
    method = "put"

    def create_base_data_with_page_filters(self) -> list[GroupSearchView]:
        user_1 = self.user
        self.user_2 = self.create_user()
        self.create_member(organization=self.organization, user=self.user_2)
        self.user_3 = self.create_user()
        self.create_member(organization=self.organization, user=self.user_3)

        self.project1 = self.create_project(organization=self.organization, slug="project-a")
        self.project2 = self.create_project(organization=self.organization, slug="project-b")
        self.project3 = self.create_project(organization=self.organization, slug="project-c")

        first_custom_view_user_one = GroupSearchView.objects.create(
            name="Custom View One",
            organization=self.organization,
            user_id=user_1.id,
            query="is:unresolved",
            query_sort="date",
            time_filters={"period": "14d"},
            environments=[],
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=user_1.id,
            group_search_view=first_custom_view_user_one,
            position=0,
        )
        first_custom_view_user_one.projects.set([self.project1])

        second_custom_view_user_one = GroupSearchView.objects.create(
            name="Custom View Two",
            organization=self.organization,
            user_id=user_1.id,
            query="is:resolved",
            query_sort="new",
            time_filters={"period": "7d"},
            environments=["staging", "production"],
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=user_1.id,
            group_search_view=second_custom_view_user_one,
            position=1,
        )
        second_custom_view_user_one.projects.set([self.project1, self.project2, self.project3])

        third_custom_view_user_one = GroupSearchView.objects.create(
            name="Custom View Three",
            organization=self.organization,
            user_id=user_1.id,
            query="is:ignored",
            query_sort="freq",
            time_filters={"period": "30d"},
            environments=["development"],
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=user_1.id,
            group_search_view=third_custom_view_user_one,
            position=2,
        )
        third_custom_view_user_one.projects.set([])

        return [first_custom_view_user_one, second_custom_view_user_one, third_custom_view_user_one]

    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.base_data = self.create_base_data_with_page_filters()

        self.url = reverse(
            "sentry-api-0-organization-group-search-views",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_not_including_page_filters_does_not_reset_them_for_existing_views(self) -> None:
        views = self.client.get(self.url).data

        # Original Page filters
        assert views[0]["timeFilters"] == {"period": "14d"}
        assert views[0]["projects"] == [self.project1.id]
        assert views[0]["environments"] == []

        view = views[0]
        # Change nothing but the name
        view["name"] = "New Name"
        response = self.get_success_response(self.organization.slug, views=views)
        assert len(response.data) == 3
        assert response.data[0]["name"] == "New Name"
        assert response.data[0]["query"] == view["query"]
        assert response.data[0]["querySort"] == view["querySort"]

        views = self.client.get(self.url).data
        # Ensure these have not been changed
        assert views[0]["timeFilters"] == {"period": "14d"}
        assert views[0]["projects"] == [self.project1.id]
        assert views[0]["environments"] == []

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_default_page_filters_with_global_views(self) -> None:
        views = self.client.get(self.url).data
        views.append(
            {
                "name": "New View",
                "query": "is:unresolved",
                "querySort": "date",
                "projects": [],
                "environments": [],
                "timeFilters": {"period": "14d"},
            }
        )
        response = self.get_success_response(self.organization.slug, views=views)
        assert len(response.data) == 4
        assert response.data[3]["timeFilters"] == {"period": "14d"}
        assert response.data[3]["projects"] == []
        assert response.data[3]["environments"] == []

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_one_project_to_zero_projects(self) -> None:
        views = self.client.get(self.url).data
        view = views[0]
        view["projects"] = []
        response = self.get_success_response(self.organization.slug, views=views)
        assert len(response.data) == 3
        assert response.data[0]["projects"] == []

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_to_all_projects(self) -> None:
        views = self.client.get(self.url).data
        view = views[0]
        view["projects"] = [-1]
        response = self.get_success_response(self.organization.slug, views=views)
        assert len(response.data) == 3
        assert response.data[0]["projects"] == [-1]

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_one_environment_to_zero_environments(self) -> None:
        views = self.client.get(self.url).data
        view = views[0]
        view["environments"] = []
        response = self.get_success_response(self.organization.slug, views=views)
        assert len(response.data) == 3
        assert response.data[0]["environments"] == []

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_update_time_filters(self) -> None:
        views = self.client.get(self.url).data
        view = views[0]
        view["timeFilters"] = {"period": "7d"}
        response = self.get_success_response(self.organization.slug, views=views)
        assert len(response.data) == 3
        assert response.data[0]["timeFilters"] == {"period": "7d"}

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_empty_time_filters_fails(self) -> None:
        views = self.client.get(self.url).data
        views[0]["timeFilters"] = {}
        response = self.get_error_response(self.organization.slug, views=views)
        assert response.data["views"]["timeFilters"][0] == "This dictionary may not be empty."

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": False})
    def test_multiple_projects_without_global_views(self) -> None:
        views = self.client.get(self.url).data
        views[0]["projects"] = [self.project1.id, self.project2.id]
        response = self.get_error_response(self.organization.slug, views=views)
        assert response.data["views"]["projects"][0] == ErrorDetail(
            string="You do not have the multi project stream feature enabled",
            code="invalid",
        )

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": False})
    def test_all_projects_without_global_views(self) -> None:
        views = self.client.get(self.url).data
        views[0]["projects"] = [-1]
        response = self.get_error_response(self.organization.slug, views=views)
        assert response.data["views"]["projects"][0] == ErrorDetail(
            string="You do not have the multi project stream feature enabled",
            code="invalid",
        )

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": False})
    def test_my_projects_without_global_views(self) -> None:
        views = self.client.get(self.url).data
        views[0]["projects"] = []
        response = self.get_error_response(self.organization.slug, views=views)
        assert response.data["views"]["projects"][0] == ErrorDetail(
            string="You do not have the multi project stream feature enabled",
            code="invalid",
        )


class OrganizationGroupSearchViewsProjectsTransactionTest(TransactionTestCase):
    # This test needs to be in its own TransactionTestCase class. This is because by default,
    # The ApiTestCase class runs all tests in a single transaction, which messes with
    # the transaction inside the PUT /group-search-views endpoint and causes this test to
    # fail unexpectedly. I think this is because the transaction inside the endpoint is being
    # merged into the parent transaction inside the ApiTestCase class, which defers the
    # foreign key constraint check until the end of the transaction, which happens after
    # the test has finished. This causes the endpoint to unexpectedly succeed when it should fail.
    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_invalid_project_ids(self) -> None:
        url = reverse(
            "sentry-api-0-organization-group-search-views",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.login_as(user=self.user)

        project1 = self.create_project(organization=self.organization, slug="project-a")

        issue_view_one = GroupSearchView.objects.create(
            name="Issue View One",
            organization=self.organization,
            user_id=self.user.id,
            query="is:unresolved",
            query_sort="date",
            time_filters={"period": "14d"},
            environments=["production"],
        )
        issue_view_one.projects.set([project1])

        response: Any = self.client.put(
            url,
            data={
                "views": [
                    {
                        "id": issue_view_one.id,
                        "name": issue_view_one.name,
                        "query": issue_view_one.query,
                        "querySort": issue_view_one.query_sort,
                        "timeFilters": issue_view_one.time_filters,
                        "environments": issue_view_one.environments,
                        "projects": [project1.id, 123456],
                    }
                ]
            },
            format="json",
            content_type="application/json",
        )
        assert response.status_code == 400
        assert response.data["views"]["projects"][0] == ErrorDetail(
            string="One or more projects do not exist",
            code="invalid",
        )


class OrganizationGroupSearchViewsGetPageFiltersTest(APITestCase):
    def create_base_data_with_page_filters(self) -> None:
        self.team_1 = self.create_team(organization=self.organization, slug="team-1")
        self.team_2 = self.create_team(organization=self.organization, slug="team-2")

        # User 1 is on team 1 only
        user_1 = self.user
        self.create_team_membership(user=user_1, team=self.team_1)
        # User 2 is on team 1 and team 2
        self.user_2 = self.create_user()
        self.create_member(
            organization=self.organization, user=self.user_2, teams=[self.team_1, self.team_2]
        )
        # User 3 has no views and should get the default views
        self.user_3 = self.create_user()
        self.create_member(organization=self.organization, user=self.user_3, teams=[self.team_1])
        # User 4 is part of no teams, should error out
        self.user_4 = self.create_user()
        self.create_member(organization=self.organization, user=self.user_4)

        # This project should NEVER get chosen as a default since it does not belong to any teams
        self.project1 = self.create_project(
            organization=self.organization, slug="project-a", teams=[]
        )
        # This project should be User 2's default project since it's the alphabetically the first one
        self.project2 = self.create_project(
            organization=self.organization, slug="project-b", teams=[self.team_2]
        )
        # This should be User 1's default project since it's the only one that the user has access to
        self.project3 = self.create_project(
            organization=self.organization, slug="project-c", teams=[self.team_1, self.team_2]
        )

        first_issue_view_user_one = GroupSearchView.objects.create(
            name="Issue View One",
            organization=self.organization,
            user_id=user_1.id,
            query="is:unresolved",
            query_sort="date",
            is_all_projects=False,
            time_filters={"period": "14d"},
            environments=[],
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=user_1.id,
            group_search_view=first_issue_view_user_one,
            position=0,
        )
        first_issue_view_user_one.projects.set([self.project3])

        second_issue_view_user_one = GroupSearchView.objects.create(
            name="Issue View Two",
            organization=self.organization,
            user_id=user_1.id,
            query="is:resolved",
            query_sort="new",
            is_all_projects=False,
            time_filters={"period": "7d"},
            environments=["staging", "production"],
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=user_1.id,
            group_search_view=second_issue_view_user_one,
            position=1,
        )
        second_issue_view_user_one.projects.set([])

        third_issue_view_user_one = GroupSearchView.objects.create(
            name="Issue View Three",
            organization=self.organization,
            user_id=user_1.id,
            query="is:ignored",
            query_sort="freq",
            is_all_projects=True,
            time_filters={"period": "30d"},
            environments=["development"],
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=user_1.id,
            group_search_view=third_issue_view_user_one,
            position=2,
        )
        third_issue_view_user_one.projects.set([])

        first_issue_view_user_two = GroupSearchView.objects.create(
            name="Issue View One",
            organization=self.organization,
            user_id=self.user_2.id,
            query="is:unresolved",
            query_sort="date",
            is_all_projects=False,
            time_filters={"period": "14d"},
            environments=[],
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=self.user_2.id,
            group_search_view=first_issue_view_user_two,
            position=0,
        )
        first_issue_view_user_two.projects.set([])

        first_issue_view_user_four = GroupSearchView.objects.create(
            name="Issue View One",
            organization=self.organization,
            user_id=self.user_4.id,
            query="is:unresolved",
            query_sort="date",
            is_all_projects=False,
            time_filters={"period": "14d"},
            environments=[],
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=self.user_4.id,
            group_search_view=first_issue_view_user_four,
            position=0,
        )
        first_issue_view_user_four.projects.set([])

    def setUp(self) -> None:
        self.create_base_data_with_page_filters()
        self.url = reverse(
            "sentry-api-0-organization-group-search-views",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_basic_get_page_filters_with_global_filters(self) -> None:
        self.login_as(user=self.user)
        response = self.client.get(self.url)

        assert response.data[0]["timeFilters"] == {"period": "14d"}
        assert response.data[0]["projects"] == [self.project3.id]
        assert response.data[0]["environments"] == []

        assert response.data[1]["timeFilters"] == {"period": "7d"}
        assert response.data[1]["projects"] == []
        assert response.data[1]["environments"] == ["staging", "production"]

        assert response.data[2]["timeFilters"] == {"period": "30d"}
        assert response.data[2]["projects"] == [-1]
        assert response.data[2]["environments"] == ["development"]

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": False})
    def test_get_page_filters_without_global_filters(self) -> None:
        self.login_as(user=self.user)
        response = self.client.get(self.url)

        assert response.data[0]["timeFilters"] == {"period": "14d"}
        assert response.data[0]["projects"] == [self.project3.id]
        assert response.data[0]["environments"] == []

        assert response.data[1]["timeFilters"] == {"period": "7d"}
        assert response.data[1]["projects"] == [self.project3.id]
        assert response.data[1]["environments"] == ["staging", "production"]

        assert response.data[2]["timeFilters"] == {"period": "30d"}
        assert response.data[2]["projects"] == [self.project3.id]
        assert response.data[2]["environments"] == ["development"]

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": False})
    def test_get_page_filters_without_global_filters_user_2(self) -> None:
        self.login_as(user=self.user_2)
        response = self.client.get(self.url)

        assert response.data[0]["timeFilters"] == {"period": "14d"}
        assert response.data[0]["projects"] == [self.project2.id]
        assert response.data[0]["environments"] == []

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_default_page_filters_with_global_views(self) -> None:
        self.login_as(user=self.user_3)
        response = self.client.get(self.url)

        default_view_queries = {view["query"] for view in DEFAULT_VIEWS}
        received_queries = {view["query"] for view in response.data}

        assert default_view_queries == received_queries

        for view in response.data:
            assert view["timeFilters"] == {"period": "14d"}
            # Global views means default project should be "My Projects"
            assert view["projects"] == []
            assert view["environments"] == []

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": False})
    def test_default_page_filters_without_global_views(self) -> None:
        self.login_as(user=self.user_3)
        response = self.client.get(self.url)

        default_view_queries = {view["query"] for view in DEFAULT_VIEWS}
        received_queries = {view["query"] for view in response.data}

        assert default_view_queries == received_queries

        for view in response.data:
            assert view["timeFilters"] == {"period": "14d"}
            # No global views means default project should be a single project
            assert view["projects"] == [self.project3.id]
            assert view["environments"] == []

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": False})
    def test_error_when_no_projects_found(self) -> None:
        self.login_as(user=self.user_4)
        response = self.client.get(self.url)
        assert response.status_code == 400
        assert response.data["detail"] == "You do not have access to any projects."


class OrganizationGroupSearchViewsGetVisibilityTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-search-views"
    method = "get"

    def setUp(self) -> None:
        self.user_1 = self.user
        self.user_2 = self.create_user()
        self.create_member(organization=self.organization, user=self.user_2)

        self.url = reverse(
            "sentry-api-0-organization-group-search-views",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

        self.starred_view = GroupSearchView.objects.create(
            name="User 1's Starred View",
            organization=self.organization,
            user_id=self.user_1.id,
            query="is:unresolved",
            query_sort="date",
            visibility=GroupSearchViewVisibility.OWNER,
        )
        GroupSearchViewStarred.objects.create(
            organization=self.organization,
            user_id=self.user_1.id,
            group_search_view=self.starred_view,
            position=0,
        )

        self.unstarred_view = GroupSearchView.objects.create(
            name="User 1's Unstarred View",
            organization=self.organization,
            user_id=self.user_1.id,
            query="is:unresolved",
            query_sort="date",
            visibility=GroupSearchViewVisibility.OWNER,
        )

        GroupSearchView.objects.create(
            name="User 2's Unstarred View",
            organization=self.organization,
            user_id=self.user_2.id,
            query="is:unresolved",
            query_sort="date",
            visibility=GroupSearchViewVisibility.OWNER,
        )

        self.organization_view = GroupSearchView.objects.create(
            name="Organization View",
            organization=self.organization,
            user_id=self.user_2.id,
            query="is:unresolved",
            query_sort="date",
            visibility=GroupSearchViewVisibility.ORGANIZATION,
        )

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_get_views_no_visibility(self) -> None:
        self.login_as(user=self.user_1)
        response = self.client.get(self.url)

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.starred_view.id)
        assert response.data[0]["name"] == self.starred_view.name

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_get_views_owner_visibility(self) -> None:
        self.login_as(user=self.user_1)
        response = self.client.get(self.url, {"visibility": "owner"})

        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["id"] == str(self.starred_view.id)
        assert response.data[0]["name"] == self.starred_view.name
        assert response.data[1]["id"] == str(self.unstarred_view.id)
        assert response.data[1]["name"] == self.unstarred_view.name

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_get_views_organization_visibility(self) -> None:
        self.login_as(user=self.user_2)
        response = self.client.get(self.url, {"visibility": "organization"})

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.organization_view.id)
        assert response.data[0]["name"] == self.organization_view.name

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_get_views_with_user_organization_visibility(self) -> None:
        self.login_as(user=self.user_1)
        response = self.client.get(self.url, {"visibility": ["owner", "organization"]})

        assert response.status_code == 200
        assert len(response.data) == 3
        assert response.data[0]["id"] == str(self.starred_view.id)
        assert response.data[0]["name"] == self.starred_view.name
        assert response.data[1]["id"] == str(self.unstarred_view.id)
        assert response.data[1]["name"] == self.unstarred_view.name
        assert response.data[2]["id"] == str(self.organization_view.id)
        assert response.data[2]["name"] == self.organization_view.name

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_get_views_with_invalid_visibility(self) -> None:
        self.login_as(user=self.user_1)
        response = self.client.get(self.url, {"visibility": ["random"]})
        assert response.status_code == 400
        assert str(response.data["visibility"][0]) == '"random" is not a valid choice.'


class OrganizationGroupSearchViewsPutRegressionTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-search-views"
    method = "put"

    def setUp(self) -> None:
        self.user_2 = self.create_user()
        self.create_member(organization=self.organization, user=self.user_2)

        self.url = reverse(
            "sentry-api-0-organization-group-search-views",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    @with_feature({"organizations:issue-stream-custom-views": True})
    @with_feature({"organizations:global-views": True})
    def test_cannot_rename_other_users_views(self) -> None:
        self.login_as(user=self.user)
        views = self.client.get(self.url).data
        view = views[0]

        # ensure we only have the default view
        assert len(views) == 1
        assert view["name"] == "Prioritized"
        assert view["query"] == "is:unresolved issue.priority:[high, medium]"
        assert view["querySort"] == "date"

        # create a new custom view
        views.append(
            {
                "name": "Custom View Two",
                "query": "is:unresolved",
                "querySort": "date",
                "projects": [],
                "environments": [],
                "timeFilters": {"period": "14d"},
            }
        )

        response = self.get_success_response(self.organization.slug, views=views)

        assert len(response.data) == 2  # 1 existing default view + 1 new view
        assert response.data[1]["name"] == "Custom View Two"
        assert response.data[1]["query"] == "is:unresolved"
        assert response.data[1]["querySort"] == "date"

        # now "delete" the custom view so the default view gets a proper ID
        views = self.client.get(self.url).data
        views.pop(1)

        response = self.get_success_response(self.organization.slug, views=views)

        # we should only have the default view now
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Prioritized"
        assert response.data[0]["id"]  # and it should now have an ID

        # attempt to change user's 1 view from user 2
        views = self.client.get(self.url).data
        default_view = views[0]
        default_view["name"] = "New Name"

        self.login_as(user=self.user_2)
        response = self.get_success_response(self.organization.slug, views=views)

        # instead of editing the original view, it should create a new view for user 2
        assert len(response.data) == 1
        assert response.data[0]["id"] != default_view["id"]
        assert response.data[0]["name"] == "New Name"

        # as user 1, verify the name has not been changed
        self.login_as(user=self.user)
        response = self.client.get(self.url)

        assert len(response.data) == 1
        assert response.data[0]["id"] == default_view["id"]
        assert response.data[0]["name"] == "Prioritized"
        assert response.data[0]["query"] == view["query"]
        assert response.data[0]["querySort"] == view["querySort"]
