from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.api.serializers.base import serialize
from sentry.models.groupsearchview import GroupSearchView
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class OrganizationGroupSearchViewsGetTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-search-views"
    method = "get"

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
            position=0,
        )

        # This is out of order to test that the endpoint returns the views in the correct order
        third_custom_view_user_one = GroupSearchView.objects.create(
            name="Custom View Three",
            organization=self.organization,
            user_id=user_1.id,
            query="is:ignored",
            query_sort="freq",
            position=2,
        )

        second_custom_view_user_one = GroupSearchView.objects.create(
            name="Custom View Two",
            organization=self.organization,
            user_id=user_1.id,
            query="is:resolved",
            query_sort="new",
            position=1,
        )

        first_custom_view_user_two = GroupSearchView.objects.create(
            name="Custom View One",
            organization=self.organization,
            user_id=self.user_2.id,
            query="is:unresolved",
            query_sort="date",
            position=0,
        )

        second_custom_view_user_two = GroupSearchView.objects.create(
            name="Custom View Two",
            organization=self.organization,
            user_id=self.user_2.id,
            query="is:resolved",
            query_sort="new",
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

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_get_user_one_custom_views(self) -> None:
        objs = self.create_base_data()

        self.login_as(user=self.user)
        response = self.get_success_response(self.organization.slug)

        assert response.data == serialize(objs["user_one_views"])

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_get_user_two_custom_views(self) -> None:
        objs = self.create_base_data()

        self.login_as(user=self.user_2)
        response = self.get_success_response(self.organization.slug)

        assert response.data == serialize(objs["user_two_views"])

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_get_default_views(self) -> None:
        self.create_base_data()

        self.login_as(user=self.user_3)
        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 1

        view = response.data[0]

        assert view["name"] == "Prioritized"
        assert view["query"] == "is:unresolved issue.priority:[high, medium]"
        assert view["querySort"] == "date"
        assert view["position"] == 0


class OrganizationGroupSearchViewsPutTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-search-views"
    method = "put"

    def create_base_data(self) -> dict[str, list[GroupSearchView]]:
        self.custom_view_one = GroupSearchView.objects.create(
            name="Custom View One",
            organization=self.organization,
            user_id=self.user.id,
            query="is:unresolved",
            query_sort="date",
            position=0,
        )

        self.custom_view_two = GroupSearchView.objects.create(
            name="Custom View Two",
            organization=self.organization,
            user_id=self.user.id,
            query="is:resolved",
            query_sort="new",
            position=1,
        )

        self.custom_view_three = GroupSearchView.objects.create(
            name="Custom View Three",
            organization=self.organization,
            user_id=self.user.id,
            query="is:ignored",
            query_sort="freq",
            position=2,
        )

        return {
            "views": [
                self.custom_view_one,
                self.custom_view_two,
                self.custom_view_three,
            ]
        }

    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.base_data = self.create_base_data()

        self.url = reverse(
            "sentry-api-0-organization-group-search-views",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_deletes_missing_views(self) -> None:
        views = self.client.get(self.url).data

        update_custom_view_three = views[2]

        views.pop(1)
        response = self.get_success_response(self.organization.slug, views=views)

        # Since we removed custom view two from the views list, custom view three
        # should now be at position 1 (previously position 2)
        update_custom_view_three["position"] = 1

        assert len(response.data) == 2
        # The first view should remain unchanged
        assert response.data[0] == views[0]
        assert response.data[1] == update_custom_view_three

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_adds_view_with_no_id(self) -> None:
        views = self.client.get(self.url).data
        views.append(
            {
                "name": "Custom View Four",
                "query": "is:unresolved",
                "query_sort": "date",
            }
        )

        response = self.get_success_response(self.organization.slug, views=views)

        assert len(response.data) == 4  # 3 existing views + 1 new view
        assert response.data[3]["name"] == "Custom View Four"
        assert response.data[3]["query"] == "is:unresolved"
        assert response.data[3]["querySort"] == "date"

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_reorder_views(self) -> None:
        views = self.client.get(self.url).data
        view_one = views[0]
        view_two = views[1]
        views[0] = view_two
        views[1] = view_one

        # We should expect the position of these two views to be swapped in the response
        view_one["position"] = 1
        view_two["position"] = 0

        response = self.get_success_response(self.organization.slug, views=views)

        assert len(response.data) == 3
        assert response.data[0] == view_two
        assert response.data[1] == view_one
        assert response.data[2] == views[2]

    @with_feature({"organizations:issue-stream-custom-views": True})
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

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_invalid_no_views(self) -> None:
        response = self.get_error_response(self.organization.slug, views=[])

        assert response.data == {
            "views": [
                ErrorDetail(string="Ensure this field has at least 1 elements.", code="min_length")
            ]
        }

    @with_feature({"organizations:issue-stream-custom-views": True})
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
    def test_invalid_over_max_views(self) -> None:
        from sentry.api.serializers.rest_framework.groupsearchview import MAX_VIEWS

        views = [
            {"name": f"Custom View {i}", "query": "is:unresolved", "query_sort": "date"}
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
    def test_updated_deleted_view(self) -> None:
        views = self.client.get(self.url).data

        updated_views = views[1:]

        # First delete a view
        self.get_success_response(self.organization.slug, views=updated_views)

        # Then reorder the tabs as if the deleted view is still there
        view_one = views[0]
        view_two = views[1]
        views[0] = view_two
        views[1] = view_one

        # Then save the views as if the deleted view is still there
        response = self.get_success_response(self.organization.slug, views=views)

        # We should expect the position of these two views to be swapped in the response
        view_one["position"] = 1
        view_two["position"] = 0

        assert len(response.data) == 3
        # Unlike in the plain reordering test, the ids are going to be different here but the views are otherwise the same,
        # So we need to check for equality of the fields instead of the objects themselves
        assert response.data[0]["query"] == view_two["query"]
        assert response.data[0]["querySort"] == view_two["querySort"]
        assert response.data[1]["query"] == view_one["query"]
        assert response.data[1]["querySort"] == view_one["querySort"]
        assert response.data[2] == views[2]


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
    def test_cannot_rename_other_users_views(self) -> None:
        self.login_as(user=self.user)
        views = self.client.get(self.url).data
        view = views[0]

        # ensure we only have the default view
        assert len(views) == 1
        assert view["name"] == "Prioritized"
        assert view["query"] == "is:unresolved issue.priority:[high, medium]"
        assert view["querySort"] == "date"
        assert view["position"] == 0

        # create a new custom view
        views.append(
            {
                "name": "Custom View Two",
                "query": "is:unresolved",
                "query_sort": "date",
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
