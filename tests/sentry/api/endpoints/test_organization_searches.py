from __future__ import absolute_import

from django.utils import timezone
from exam import fixture

from sentry.api.serializers import serialize
from sentry.models import SavedSearch
from sentry.models.savedsearch import DEFAULT_SAVED_SEARCHES
from sentry.testutils import APITestCase


class OrganizationSearchesListTest(APITestCase):
    endpoint = 'sentry-api-0-organization-searches'

    @fixture
    def user(self):
        return self.create_user('test@test.com')

    def test_simple(self):
        self.login_as(user=self.user)
        team = self.create_team(members=[self.user])
        project1 = self.create_project(teams=[team], name='foo')
        project2 = self.create_project(teams=[team], name='bar')

        SavedSearch.objects.create(
            project=project1,
            name='bar',
            query=DEFAULT_SAVED_SEARCHES[0]['query'],
        )
        included = [
            SavedSearch.objects.create(
                name='Global Query',
                query=DEFAULT_SAVED_SEARCHES[0]['query'],
                is_global=True,
                date_added=timezone.now().replace(microsecond=0)
            ),
            SavedSearch.objects.create(
                project=project1,
                name='foo',
                query='some test',
                date_added=timezone.now().replace(microsecond=0)
            ),
            SavedSearch.objects.create(
                project=project1,
                name='wat',
                query='is:unassigned is:unresolved',
                date_added=timezone.now().replace(microsecond=0)
            ),
            SavedSearch.objects.create(
                project=project2,
                name='foo',
                query='some test',
                date_added=timezone.now().replace(microsecond=0)
            ),
        ]

        included.sort(key=lambda search: (search.name, search.id))
        response = self.get_valid_response(self.organization.slug)
        response.data.sort(key=lambda search: (search['name'], search['projectId']))
        assert response.data == serialize(included)
