from __future__ import absolute_import

from django.utils import timezone
from exam import fixture

from sentry.api.serializers import serialize
from sentry.models import SavedSearch
from sentry.models.search_common import SearchType
from sentry.models.savedsearch import DEFAULT_SAVED_SEARCHES
from sentry.testutils import APITestCase


class OrganizationSearchesListTest(APITestCase):
    endpoint = "sentry-api-0-organization-searches"

    @fixture
    def user(self):
        return self.create_user("test@test.com")

    def test_simple(self):
        self.login_as(user=self.user)
        team = self.create_team(members=[self.user])
        project1 = self.create_project(teams=[team], name="foo")
        project2 = self.create_project(teams=[team], name="bar")

        # Depending on test we run migrations in Django 1.8. This causes
        # extra rows to be created, so remove them to keep this test working
        SavedSearch.objects.filter(is_global=True).delete()

        SavedSearch.objects.create(
            project=project1, name="bar", query=DEFAULT_SAVED_SEARCHES[0]["query"]
        )
        included = [
            SavedSearch.objects.create(
                name="Global Query",
                query=DEFAULT_SAVED_SEARCHES[0]["query"],
                is_global=True,
                date_added=timezone.now(),
            ),
            SavedSearch.objects.create(
                project=project1, name="foo", query="some test", date_added=timezone.now()
            ),
            SavedSearch.objects.create(
                project=project1,
                name="wat",
                query="is:unassigned is:unresolved",
                date_added=timezone.now(),
            ),
            SavedSearch.objects.create(
                project=project2, name="foo", query="some test", date_added=timezone.now()
            ),
        ]

        included.sort(key=lambda search: (search.name, search.id))
        response = self.get_valid_response(self.organization.slug)
        response.data.sort(key=lambda search: (search["name"], search["projectId"]))
        assert response.data == serialize(included)


class OrgLevelOrganizationSearchesListTest(APITestCase):
    endpoint = "sentry-api-0-organization-searches"

    @fixture
    def user(self):
        return self.create_user("test@test.com")

    def get_response(self, *args, **params):
        params["use_org_level"] = "1"
        return super(OrgLevelOrganizationSearchesListTest, self).get_response(*args, **params)

    def create_base_data(self):
        # Depending on test we run migrations in Django 1.8. This causes
        # extra rows to be created, so remove them to keep this test working
        SavedSearch.objects.filter(is_global=True).delete()

        team = self.create_team(members=[self.user])
        SavedSearch.objects.create(
            project=self.create_project(teams=[team], name="foo"),
            name="foo",
            query="some test",
            date_added=timezone.now(),
        )
        SavedSearch.objects.create(
            organization=self.organization,
            owner=self.create_user(),
            name="foo",
            query="some other user's query",
            date_added=timezone.now(),
        )
        included = [
            SavedSearch.objects.create(
                name="Global Query",
                query=DEFAULT_SAVED_SEARCHES[0]["query"],
                is_global=True,
                date_added=timezone.now(),
            ),
            SavedSearch.objects.create(
                organization=self.organization,
                name="foo",
                query="some test",
                date_added=timezone.now(),
            ),
            SavedSearch.objects.create(
                organization=self.organization,
                name="wat",
                query="is:unassigned is:unresolved",
                date_added=timezone.now(),
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
            name="My Pinned Query",
            query="pinned junk",
            date_added=timezone.now(),
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


class CreateOrganizationSearchesTest(APITestCase):
    endpoint = "sentry-api-0-organization-searches"
    method = "post"

    @fixture
    def manager(self):
        user = self.create_user("test@test.com")
        self.create_member(organization=self.organization, user=user, role="manager")
        return user

    @fixture
    def member(self):
        user = self.create_user("test@test.com")
        self.create_member(organization=self.organization, user=user)
        return user

    def test_simple(self):
        search_type = SearchType.ISSUE.value
        name = "test"
        query = "hello"
        self.login_as(user=self.manager)
        resp = self.get_valid_response(
            self.organization.slug, type=search_type, name=name, query=query
        )
        assert resp.data["name"] == name
        assert resp.data["query"] == query
        assert resp.data["type"] == search_type
        assert SavedSearch.objects.filter(id=resp.data["id"]).exists()

    def test_perms(self):
        self.login_as(user=self.member)
        resp = self.get_response(
            self.organization.slug, type=SearchType.ISSUE.value, name="hello", query="test"
        )
        assert resp.status_code == 403

    def test_exists(self):
        global_search = SavedSearch.objects.create(
            type=SearchType.ISSUE.value,
            name="Some global search",
            query="is:unresolved",
            is_global=True,
        )
        self.login_as(user=self.manager)
        resp = self.get_response(
            self.organization.slug,
            type=SearchType.ISSUE.value,
            name="hello",
            query=global_search.query,
        )
        assert resp.status_code == 400
        assert "already exists" in resp.data["detail"]

        org_search = SavedSearch.objects.create(
            organization=self.organization,
            type=SearchType.ISSUE.value,
            name="Some org search",
            query="org search",
        )
        resp = self.get_response(
            self.organization.slug,
            type=SearchType.ISSUE.value,
            name="hello",
            query=org_search.query,
        )
        assert resp.status_code == 400
        assert "already exists" in resp.data["detail"]

    def test_empty(self):
        self.login_as(user=self.manager)
        resp = self.get_response(
            self.organization.slug, type=SearchType.ISSUE.value, name="hello", query=""
        )
        assert resp.status_code == 400
        assert "This field may not be blank." == resp.data["query"][0]
