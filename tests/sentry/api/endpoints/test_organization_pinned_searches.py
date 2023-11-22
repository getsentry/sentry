from functools import cached_property

from sentry.api.endpoints.organization_pinned_searches import PINNED_SEARCH_NAME
from sentry.models.savedsearch import SavedSearch, SortOptions, Visibility
from sentry.models.search_common import SearchType
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class CreateOrganizationPinnedSearchTest(APITestCase):
    endpoint = "sentry-api-0-organization-pinned-searches"
    method = "put"

    @cached_property
    def member(self):
        user = self.create_user("test@test.com")
        self.create_member(organization=self.organization, user=user)
        return user

    def get_response(self, *args, **params):
        return super().get_response(*((self.organization.slug,) + args), **params)

    def test(self):
        self.login_as(self.member)
        query = "test"
        search_type = SearchType.ISSUE.value
        sort = SortOptions.DATE
        self.get_success_response(type=search_type, query=query, sort=sort, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner_id=self.member.id,
            type=search_type,
            query=query,
            sort=sort,
            visibility=Visibility.OWNER_PINNED,
        ).exists()

        query = "test_2"
        self.get_success_response(type=search_type, query=query, sort=sort, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner_id=self.member.id,
            type=search_type,
            query=query,
            sort=sort,
            visibility=Visibility.OWNER_PINNED,
        ).exists()

        self.get_success_response(type=SearchType.EVENT.value, query=query, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner_id=self.member.id,
            type=search_type,
            query=query,
        ).exists()
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner_id=self.member.id,
            type=SearchType.EVENT.value,
            query=query,
            visibility=Visibility.OWNER_PINNED,
        ).exists()

        self.login_as(self.user)
        self.get_success_response(type=search_type, query=query, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner_id=self.member.id,
            type=search_type,
            query=query,
            visibility=Visibility.OWNER_PINNED,
        ).exists()
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner_id=self.user.id,
            type=search_type,
            query=query,
            visibility=Visibility.OWNER_PINNED,
        ).exists()

    def test_pin_sort_mismatch(self):
        saved_search = SavedSearch.objects.create(
            organization=self.organization,
            owner_id=self.member.id,
            type=SearchType.ISSUE.value,
            sort=SortOptions.FREQ,
            query="wat",
            visibility=Visibility.OWNER_PINNED,
        )
        self.login_as(self.user)
        resp = self.get_success_response(
            sort=SortOptions.DATE, type=saved_search.type, query=saved_search.query, status_code=201
        )
        assert resp.data["isPinned"]
        assert resp.data["id"] != str(saved_search.id)

    def test_invalid_type(self):
        self.login_as(self.member)
        resp = self.get_response(type=55, query="test", status_code=201)
        assert resp.status_code == 400
        assert "not a valid SearchType" in resp.data["type"][0]

    def test_empty_query(self):
        self.login_as(self.member)
        query = ""
        search_type = SearchType.ISSUE.value
        sort = SortOptions.DATE
        self.get_success_response(type=search_type, query=query, sort=sort, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner_id=self.member.id,
            type=search_type,
            query=query,
            sort=sort,
            visibility=Visibility.OWNER_PINNED,
        ).exists()


@region_silo_test
class DeleteOrganizationPinnedSearchTest(APITestCase):
    endpoint = "sentry-api-0-organization-pinned-searches"
    method = "delete"

    @cached_property
    def member(self):
        user = self.create_user("test@test.com")
        self.create_member(organization=self.organization, user=user)
        return user

    def get_response(self, *args, **params):
        return super().get_response(*((self.organization.slug,) + args), **params)

    def test(self):
        saved_search = SavedSearch.objects.create(
            organization=self.organization,
            owner_id=self.member.id,
            type=SearchType.ISSUE.value,
            query="wat",
            visibility=Visibility.OWNER_PINNED,
        )
        other_saved_search = SavedSearch.objects.create(
            organization=self.organization,
            owner_id=self.user.id,
            type=SearchType.ISSUE.value,
            query="wat",
            visibility=Visibility.OWNER_PINNED,
        )

        self.login_as(self.member)
        self.get_success_response(type=saved_search.type, status_code=204)
        assert not SavedSearch.objects.filter(id=saved_search.id).exists()
        assert SavedSearch.objects.filter(id=other_saved_search.id).exists()

        # Test calling multiple times works ok, doesn't cause other rows to
        # delete
        self.get_success_response(type=saved_search.type, status_code=204)
        assert SavedSearch.objects.filter(id=other_saved_search.id).exists()

    def test_invalid_type(self):
        self.login_as(self.member)
        resp = self.get_response(type=55)
        assert resp.status_code == 400
        assert "Invalid input for `type`" in resp.data["detail"]
