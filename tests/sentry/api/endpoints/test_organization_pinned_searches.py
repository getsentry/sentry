from django.utils import timezone
from exam import fixture

from sentry.api.endpoints.organization_pinned_searches import PINNED_SEARCH_NAME
from sentry.models.savedsearch import SavedSearch, SortOptions
from sentry.models.search_common import SearchType
from sentry.testutils import APITestCase


class CreateOrganizationPinnedSearchTest(APITestCase):
    endpoint = "sentry-api-0-organization-pinned-searches"
    method = "put"

    @fixture
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
        self.get_valid_response(type=search_type, query=query, sort=sort, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner=self.member,
            type=search_type,
            query=query,
            sort=sort,
        ).exists()

        query = "test_2"
        self.get_valid_response(type=search_type, query=query, sort=sort, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner=self.member,
            type=search_type,
            query=query,
            sort=sort,
        ).exists()

        self.get_valid_response(type=SearchType.EVENT.value, query=query, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner=self.member,
            type=search_type,
            query=query,
        ).exists()
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner=self.member,
            type=SearchType.EVENT.value,
            query=query,
        ).exists()

        self.login_as(self.user)
        self.get_valid_response(type=search_type, query=query, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner=self.member,
            type=search_type,
            query=query,
        ).exists()
        assert SavedSearch.objects.filter(
            organization=self.organization,
            name=PINNED_SEARCH_NAME,
            owner=self.user,
            type=search_type,
            query=query,
        ).exists()

    def test_pin_org_search(self):
        org_search = SavedSearch.objects.create(
            organization=self.organization, name="foo", query="some test", date_added=timezone.now()
        )
        self.login_as(self.user)
        resp = self.get_valid_response(
            type=org_search.type, query=org_search.query, status_code=201
        )
        assert resp.data["isPinned"]
        assert resp.data["id"] == str(org_search.id)

    def test_pin_global_search(self):
        global_search = SavedSearch.objects.create(
            name="Global Query", query="global query", is_global=True, date_added=timezone.now()
        )
        self.login_as(self.user)
        resp = self.get_valid_response(
            type=global_search.type, query=global_search.query, status_code=201
        )
        assert resp.data["isPinned"]
        assert resp.data["id"] == str(global_search.id)

    def test_pin_sort_mismatch(self):
        saved_search = SavedSearch.objects.create(
            organization=self.organization,
            owner=self.member,
            type=SearchType.ISSUE.value,
            sort=SortOptions.FREQ,
            query="wat",
        )
        self.login_as(self.user)
        resp = self.get_valid_response(
            sort=SortOptions.DATE, type=saved_search.type, query=saved_search.query, status_code=201
        )
        assert resp.data["isPinned"]
        assert resp.data["id"] != str(saved_search.id)

    def test_invalid_type(self):
        self.login_as(self.member)
        resp = self.get_response(type=55, query="test", status_code=201)
        assert resp.status_code == 400
        assert "not a valid SearchType" in resp.data["type"][0]


class DeleteOrganizationPinnedSearchTest(APITestCase):
    endpoint = "sentry-api-0-organization-pinned-searches"
    method = "delete"

    @fixture
    def member(self):
        user = self.create_user("test@test.com")
        self.create_member(organization=self.organization, user=user)
        return user

    def get_response(self, *args, **params):
        return super().get_response(*((self.organization.slug,) + args), **params)

    def test(self):
        saved_search = SavedSearch.objects.create(
            organization=self.organization,
            owner=self.member,
            type=SearchType.ISSUE.value,
            query="wat",
        )
        other_saved_search = SavedSearch.objects.create(
            organization=self.organization,
            owner=self.user,
            type=SearchType.ISSUE.value,
            query="wat",
        )

        self.login_as(self.member)
        self.get_valid_response(type=saved_search.type, status_code=204)
        assert not SavedSearch.objects.filter(id=saved_search.id).exists()
        assert SavedSearch.objects.filter(id=other_saved_search.id).exists()

        # Test calling multiple times works ok, doesn't cause other rows to
        # delete
        self.get_valid_response(type=saved_search.type, status_code=204)
        assert SavedSearch.objects.filter(id=other_saved_search.id).exists()

    def test_invalid_type(self):
        self.login_as(self.member)
        resp = self.get_response(type=55)
        assert resp.status_code == 400
        assert "Invalid input for `type`" in resp.data["detail"]
