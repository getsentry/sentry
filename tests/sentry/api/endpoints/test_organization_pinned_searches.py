from __future__ import absolute_import

from exam import fixture

from sentry.models import SavedSearch
from sentry.models.search_common import SearchType
from sentry.testutils import APITestCase


class CreateOrganizationPinnedSearchTest(APITestCase):
    endpoint = 'sentry-api-0-organization-pinned-searches'
    method = 'put'

    @fixture
    def member(self):
        user = self.create_user('test@test.com')
        self.create_member(organization=self.organization, user=user)
        return user

    def get_response(self, *args, **params):
        return super(CreateOrganizationPinnedSearchTest, self).get_response(
            *((self.organization.slug,) + args),
            **params
        )

    def test(self):
        self.login_as(self.member)
        query = 'test'
        search_type = SearchType.ISSUE.value
        self.get_valid_response(type=search_type, query=query, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            owner=self.member,
            type=search_type,
            query=query,
        ).exists()

        query = 'test_2'
        self.get_valid_response(type=search_type, query=query, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            owner=self.member,
            type=search_type,
            query=query,
        ).exists()

        self.get_valid_response(type=SearchType.EVENT.value, query=query, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            owner=self.member,
            type=search_type,
            query=query,
        ).exists()
        assert SavedSearch.objects.filter(
            organization=self.organization,
            owner=self.member,
            type=SearchType.EVENT.value,
            query=query,
        ).exists()

        self.login_as(self.user)
        self.get_valid_response(type=search_type, query=query, status_code=201)
        assert SavedSearch.objects.filter(
            organization=self.organization,
            owner=self.member,
            type=search_type,
            query=query,
        ).exists()
        assert SavedSearch.objects.filter(
            organization=self.organization,
            owner=self.user,
            type=search_type,
            query=query,
        ).exists()

    def test_invalid_type(self):
        self.login_as(self.member)
        resp = self.get_response(type=55, query='test', status_code=201)
        assert resp.status_code == 400
        assert 'not a valid SearchType' in resp.data['type'][0]


class DeleteOrganizationPinnedSearchTest(APITestCase):
    endpoint = 'sentry-api-0-organization-pinned-searches'
    method = 'delete'

    @fixture
    def member(self):
        user = self.create_user('test@test.com')
        self.create_member(organization=self.organization, user=user)
        return user

    def get_response(self, *args, **params):
        return super(DeleteOrganizationPinnedSearchTest, self).get_response(
            *((self.organization.slug,) + args),
            **params
        )

    def test(self):
        saved_search = SavedSearch.objects.create(
            organization=self.organization,
            owner=self.member,
            type=SearchType.ISSUE.value,
            query='wat',
        )
        other_saved_search = SavedSearch.objects.create(
            organization=self.organization,
            owner=self.user,
            type=SearchType.ISSUE.value,
            query='wat',
        )

        self.login_as(self.member)
        self.get_valid_response(type=saved_search.type, status_code=204)
        assert not SavedSearch.objects.filter(id=saved_search.id).exists()
        assert SavedSearch.objects.filter(id=other_saved_search.id).exists()

        # Test calling mulitple times works ok, doesn't cause other rows to
        # delete
        self.get_valid_response(type=saved_search.type, status_code=204)
        assert SavedSearch.objects.filter(id=other_saved_search.id).exists()

    def test_invalid_type(self):
        self.login_as(self.member)
        resp = self.get_response(type=55)
        assert resp.status_code == 400
        assert 'Invalid input for `type`' in resp.data['detail']
