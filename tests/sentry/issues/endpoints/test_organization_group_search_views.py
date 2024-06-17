from sentry.api.serializers.base import serialize
from sentry.models.groupsearchview import GroupSearchView
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class OrganizationGroupSearchViewsTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-search-views"
    method = "get"

    def create_base_data(self):
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
    def test_get_user_one_custom_views(self):
        objs = self.create_base_data()

        self.login_as(user=self.user)
        response = self.get_success_response(self.organization.slug)

        assert response.data == serialize(objs["user_one_views"])

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_get_user_two_custom_views(self):
        objs = self.create_base_data()

        self.login_as(user=self.user_2)
        response = self.get_success_response(self.organization.slug)

        assert response.data == serialize(objs["user_two_views"])

    @with_feature({"organizations:issue-stream-custom-views": True})
    def test_get_default_views(self):
        self.create_base_data()

        self.login_as(user=self.user_3)
        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 1

        view = response.data[0]

        assert view["name"] == "Prioritized"
        assert view["query"] == "is:unresolved issue.priority:[high, medium]"
        assert view["querySort"] == "date"
        assert view["position"] == 0
