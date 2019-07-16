from __future__ import absolute_import

from exam import fixture

from sentry.models import SavedSearch
from sentry.testutils import APITestCase


class DeleteOrganizationSearchTest(APITestCase):
    endpoint = 'sentry-api-0-organization-search-details'
    method = 'delete'

    def setUp(self):
        self.login_as(user=self.user)

    @fixture
    def member(self):
        user = self.create_user('test@test.com')
        self.create_member(organization=self.organization, user=user)
        return user

    def get_response(self, *args, **params):
        return super(DeleteOrganizationSearchTest, self).get_response(
            *((self.organization.slug,) + args),
            **params
        )

    def test_owner_can_delete_org_searches(self):
        search = SavedSearch.objects.create(
            organization=self.organization,
            name='foo',
            query='',
        )
        response = self.get_response(search.id)
        assert response.status_code == 204, response.content
        assert not SavedSearch.objects.filter(id=search.id).exists()

    def test_owners_cannot_delete_searches_they_do_not_own(self):
        search = SavedSearch.objects.create(
            organization=self.organization,
            name='foo',
            query='',
            owner=self.create_user()
        )

        response = self.get_response(search.id)
        assert response.status_code == 404, response.content
        assert SavedSearch.objects.filter(id=search.id).exists()

    def test_owners_cannot_delete_global_searches(self):
        search = SavedSearch.objects.create(
            name='foo',
            query='',
            is_global=True,
        )

        response = self.get_response(search.id)
        assert response.status_code == 404, response.content
        assert SavedSearch.objects.filter(id=search.id).exists()

    def test_members_cannot_delete_shared_searches(self):
        search = SavedSearch.objects.create(
            organization=self.organization,
            name='foo',
            query=''
        )

        self.login_as(user=self.member)
        response = self.get_response(search.id)
        assert response.status_code == 403, response.content
        assert SavedSearch.objects.filter(id=search.id).exists()
