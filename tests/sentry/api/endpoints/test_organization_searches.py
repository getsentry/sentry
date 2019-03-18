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


class OrgLevelOrganizationSearchesListTest(APITestCase):
    endpoint = 'sentry-api-0-organization-searches'

    @fixture
    def user(self):
        return self.create_user('test@test.com')

    def get_response(self, *args, **params):
        params['use_org_level'] = '1'
        return super(OrgLevelOrganizationSearchesListTest, self).get_response(
            *args,
            **params
        )

    def create_base_data(self):
        team = self.create_team(members=[self.user])
        SavedSearch.objects.create(
            project=self.create_project(teams=[team], name='foo'),
            name='foo',
            query='some test',
            date_added=timezone.now().replace(microsecond=0)
        )
        SavedSearch.objects.create(
            organization=self.organization,
            owner=self.create_user(),
            name='foo',
            query='some other user\'s query',
            date_added=timezone.now().replace(microsecond=0)
        )
        included = [
            SavedSearch.objects.create(
                name='Global Query',
                query=DEFAULT_SAVED_SEARCHES[0]['query'],
                is_global=True,
                date_added=timezone.now().replace(microsecond=0)
            ),
            SavedSearch.objects.create(
                organization=self.organization,
                name='foo',
                query='some test',
                date_added=timezone.now().replace(microsecond=0)
            ),
            SavedSearch.objects.create(
                organization=self.organization,
                name='wat',
                query='is:unassigned is:unresolved',
                date_added=timezone.now().replace(microsecond=0)
            ),
        ]
        return included

    def check_results(self, expected):
        self.login_as(user=self.user)
        expected.sort(key=lambda search: (not search.is_pinned, search.name.lower()))
        response = self.get_valid_response(self.organization.slug)
        assert response.data == serialize(expected)

    def test_simple(self):
        included = self.create_base_data()
        self.check_results(included)

    def test_pinned(self):
        included = self.create_base_data()
        pinned_query = SavedSearch.objects.create(
            organization=self.organization,
            owner=self.user,
            name='My Pinned Query',
            query='pinned junk',
            date_added=timezone.now().replace(microsecond=0)
        )
        included.append(pinned_query)
        self.check_results(included)
        # Check a pinned query that uses an existing query correctly filters
        # the existing query
        to_be_pinned = included.pop()
        to_be_pinned.is_pinned = True
        pinned_query.query = to_be_pinned.query
        pinned_query.save()
        included[0] = to_be_pinned
        self.check_results(included)
