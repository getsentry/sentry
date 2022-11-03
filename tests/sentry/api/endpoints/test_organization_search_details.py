from exam import fixture

from sentry.models.savedsearch import SavedSearch, Visibility
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class DeleteOrganizationSearchTest(APITestCase):
    endpoint = "sentry-api-0-organization-search-details"
    method = "delete"

    def setUp(self):
        self.login_as(user=self.user)

    @fixture
    def member(self):
        user = self.create_user("test@test.com")
        self.create_member(organization=self.organization, user=user)
        return user

    def get_response(self, *args, **params):
        return super().get_response(*((self.organization.slug,) + args), **params)

    def test_owner_can_delete_org_searches(self):
        search = SavedSearch.objects.create(
            organization=self.organization,
            owner=self.create_user(),
            name="foo",
            query="",
            visibility=Visibility.ORGANIZATION,
        )
        response = self.get_response(search.id)
        assert response.status_code == 204, response.content
        assert not SavedSearch.objects.filter(id=search.id).exists()

    def test_owners_can_delete_their_searches(self):
        search = SavedSearch.objects.create(
            organization=self.organization,
            owner=self.user,
            name="foo",
            query="",
            visibility=Visibility.OWNER,
        )

        response = self.get_response(search.id)
        assert response.status_code == 204, response.content
        assert not SavedSearch.objects.filter(id=search.id).exists()

    def test_owners_cannot_delete_searches_they_do_not_own(self):
        search = SavedSearch.objects.create(
            organization=self.organization,
            owner=self.create_user(),
            name="foo",
            query="",
            visibility=Visibility.OWNER,
        )

        response = self.get_response(search.id)
        assert response.status_code == 404, response.content
        assert SavedSearch.objects.filter(id=search.id).exists()

    def test_owners_cannot_delete_global_searches(self):
        search = SavedSearch.objects.create(
            name="foo",
            query="",
            is_global=True,
            visibility=Visibility.ORGANIZATION,
        )

        response = self.get_response(search.id)
        assert response.status_code == 404, response.content
        assert SavedSearch.objects.filter(id=search.id).exists()

    def test_members_cannot_delete_shared_searches(self):
        search = SavedSearch.objects.create(
            organization=self.organization,
            owner=self.user,
            name="foo",
            query="",
            visibility=Visibility.ORGANIZATION,
        )

        self.login_as(user=self.member)
        response = self.get_response(search.id)
        assert response.status_code == 403, response.content
        assert SavedSearch.objects.filter(id=search.id).exists()
