from functools import cached_property

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.models.savedsearch import SavedSearch, SortOptions, Visibility
from sentry.models.search_common import SearchType
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrgLevelOrganizationSearchesListTest(APITestCase):
    endpoint = "sentry-api-0-organization-searches"

    @cached_property
    def user(self):
        return self.create_user("test@test.com")

    def get_response(self, *args, **params):
        return super().get_response(*args, **params)

    def create_base_data(self):
        user_1 = self.user
        user_2 = self.create_user()

        self.create_member(organization=self.organization, user=user_2)

        # Depending on test we run migrations in Django 1.8. This causes
        # extra rows to be created, so remove them to keep this test working
        SavedSearch.objects.filter(is_global=True).delete()

        # Note names are prefixed with A-Z to make it easy to understand the sorting

        savedsearch_global = SavedSearch.objects.create(
            name="A Global Query",
            query="is:unresolved",
            sort=SortOptions.DATE,
            is_global=True,
            visibility=Visibility.ORGANIZATION,
            date_added=timezone.now(),
        )
        savedsearch_org = SavedSearch.objects.create(
            organization=self.organization,
            owner_id=user_1.id,
            name="B Simple SavedSearch 1",
            query="some test",
            sort=SortOptions.NEW,
            visibility=Visibility.ORGANIZATION,
            date_added=timezone.now(),
        )
        savedsearch_org_diff_owner = SavedSearch.objects.create(
            organization=self.organization,
            owner_id=user_2.id,
            name="C Simple SavedSearch for same org diff owner",
            query="some other test",
            sort=SortOptions.DATE,
            visibility=Visibility.ORGANIZATION,
            date_added=timezone.now(),
        )
        savedsearch_owner_me = SavedSearch.objects.create(
            organization=self.organization,
            owner_id=user_1.id,
            name="D My personal search",
            query="some other test",
            sort=SortOptions.DATE,
            visibility=Visibility.OWNER,
            date_added=timezone.now(),
        )
        savedsearch_other_owner = SavedSearch.objects.create(
            organization=self.organization,
            owner_id=user_2.id,
            name="E Other user personal search",
            query="whatever",
            sort=SortOptions.DATE,
            visibility=Visibility.OWNER,
            date_added=timezone.now(),
        )
        savedsearch_my_pinned = SavedSearch.objects.create(
            organization=self.organization,
            owner_id=user_1.id,
            name="F My pinned search",
            query="whatever",
            sort=SortOptions.DATE,
            visibility=Visibility.OWNER_PINNED,
            date_added=timezone.now(),
        )
        savedsearch_other_pinned = SavedSearch.objects.create(
            organization=self.organization,
            owner_id=user_2.id,
            name="G Other user pinned search",
            query="whatever",
            sort=SortOptions.DATE,
            visibility=Visibility.OWNER_PINNED,
            date_added=timezone.now(),
        )

        return {
            "savedsearch_global": savedsearch_global,
            "savedsearch_org": savedsearch_org,
            "savedsearch_org_diff_owner": savedsearch_org_diff_owner,
            "savedsearch_owner_me": savedsearch_owner_me,
            "savedsearch_other_owner": savedsearch_other_owner,
            "savedsearch_my_pinned": savedsearch_my_pinned,
            "savedsearch_other_pinned": savedsearch_other_pinned,
        }

    def check_results(self, expected):
        self.login_as(user=self.user)
        response = self.get_success_response(self.organization.slug)
        assert response.data == serialize(expected)

    def test_simple(self):
        objs = self.create_base_data()
        self.check_results(
            [
                objs["savedsearch_global"],
                objs["savedsearch_org"],
                objs["savedsearch_org_diff_owner"],
                objs["savedsearch_owner_me"],
                objs["savedsearch_my_pinned"],
            ]
        )


@region_silo_test
class CreateOrganizationSearchesPostTest(APITestCase):
    endpoint = "sentry-api-0-organization-searches"
    method = "post"

    @cached_property
    def manager(self):
        user = self.create_user("test@test.com")
        self.create_member(organization=self.organization, user=user, role="manager")
        return user

    @cached_property
    def member(self):
        user = self.create_user("test@test.com")
        self.create_member(organization=self.organization, user=user)
        return user

    def test_simple(self):
        search_type = SearchType.ISSUE.value
        name = "test"
        query = "hello"
        visibility = Visibility.ORGANIZATION

        self.login_as(user=self.manager)
        resp = self.get_success_response(
            self.organization.slug,
            type=search_type,
            name=name,
            query=query,
            visibility=visibility,
        )
        assert resp.data["name"] == name
        assert resp.data["query"] == query
        assert resp.data["type"] == search_type
        assert resp.data["visibility"] == visibility
        assert SavedSearch.objects.filter(id=resp.data["id"]).exists()

    def test_member_cannot_create_org_search(self):
        self.login_as(user=self.member)
        resp = self.get_response(
            self.organization.slug,
            type=SearchType.ISSUE.value,
            name="hello",
            query="test",
            visibility=Visibility.ORGANIZATION,
        )
        assert resp.status_code == 400

    def test_member_can_create_owner_search(self):
        self.login_as(user=self.member)
        resp = self.get_response(
            self.organization.slug,
            type=SearchType.ISSUE.value,
            name="hello",
            query="test",
            visibility=Visibility.OWNER,
        )
        assert resp.status_code == 200
        assert SavedSearch.objects.filter(id=resp.data["id"]).exists()

    def test_org_global_search_conflict(self):
        global_search = SavedSearch.objects.create(
            type=SearchType.ISSUE.value,
            name="Some global search",
            query="is:unresolved",
            is_global=True,
            visibility=Visibility.ORGANIZATION,
        )

        # Org searches may be created with same query as global searches
        self.login_as(user=self.manager)
        resp = self.get_response(
            self.organization.slug,
            type=SearchType.ISSUE.value,
            name="hello",
            query=global_search.query,
        )
        assert resp.status_code == 200
        assert SavedSearch.objects.filter(id=resp.data["id"]).exists()

    def test_org_org_search_conflict(self):
        org_search = SavedSearch.objects.create(
            organization=self.organization,
            type=SearchType.ISSUE.value,
            name="Some org search",
            query="org search",
            visibility=Visibility.ORGANIZATION,
        )
        self.login_as(user=self.manager)
        resp = self.get_response(
            self.organization.slug,
            type=SearchType.ISSUE.value,
            name="hello",
            query=org_search.query,
            visibility=Visibility.ORGANIZATION,
        )
        assert resp.status_code == 400
        assert "already exists" in resp.data["detail"]

    def test_owner_global_search_conflict(self):
        global_search = SavedSearch.objects.create(
            type=SearchType.ISSUE.value,
            name="Some global search",
            query="is:unresolved",
            is_global=True,
            visibility=Visibility.ORGANIZATION,
        )

        # Owner searches may be created with same query as global searches
        self.login_as(user=self.member)
        resp = self.get_response(
            self.organization.slug,
            type=SearchType.ISSUE.value,
            name="hello",
            query=global_search.query,
            visibility=Visibility.OWNER,
        )
        assert resp.status_code == 200
        assert SavedSearch.objects.filter(id=resp.data["id"]).exists()

    def test_owner_org_search_conflict(self):
        org_search = SavedSearch.objects.create(
            organization=self.organization,
            type=SearchType.ISSUE.value,
            name="Some org search",
            query="org search",
            visibility=Visibility.ORGANIZATION,
        )

        # Owner searches may be created with same query as org searches
        self.login_as(user=self.member)
        resp = self.get_response(
            self.organization.slug,
            type=SearchType.ISSUE.value,
            name="hello",
            query=org_search.query,
            visibility=Visibility.OWNER,
        )
        assert resp.status_code == 200
        assert SavedSearch.objects.filter(id=resp.data["id"]).exists()

    def test_owner_owner_search_conflict(self):
        user_search = SavedSearch.objects.create(
            organization=self.organization,
            type=SearchType.ISSUE.value,
            name="Some user search",
            query="user search",
            visibility=Visibility.OWNER,
            owner_id=self.member.id,
        )
        self.login_as(user=self.member)
        resp = self.get_response(
            self.organization.slug,
            type=SearchType.ISSUE.value,
            name="hello",
            query=user_search.query,
            visibility=Visibility.OWNER,
        )
        assert resp.status_code == 400
        assert "already exists" in resp.data["detail"]

    def test_owner1_owner2_search_conflict(self):
        # User 1 has a saved search in org
        other_user_search = SavedSearch.objects.create(
            organization=self.organization,
            type=SearchType.ISSUE.value,
            name="Some other user in org made this search",
            query="user search",
            visibility=Visibility.OWNER,
            owner_id=self.create_user("otheruser@test.com").id,
        )

        # User 2 creates a similar search in the same org
        self.login_as(user=self.member)
        resp = self.get_response(
            self.organization.slug,
            type=SearchType.ISSUE.value,
            name="hello",
            query=other_user_search.query,
            visibility=Visibility.OWNER,
        )

        # Should work and both searches should exist
        assert resp.status_code == 200
        assert SavedSearch.objects.filter(id=other_user_search.id).exists()
        assert SavedSearch.objects.filter(id=resp.data["id"]).exists()

    def test_owner_pinned_search_conflict(self):
        # Member has a pinned search
        pinned_search = SavedSearch.objects.create(
            organization=self.organization,
            type=SearchType.ISSUE.value,
            name="My Pinned Search",
            query="user pinned search",
            visibility=Visibility.OWNER_PINNED,
            owner_id=self.member.id,
        )

        # Member creates a saved search with the same query
        self.login_as(user=self.member)
        resp = self.get_response(
            self.organization.slug,
            type=SearchType.ISSUE.value,
            name="hello",
            query=pinned_search.query,
            visibility=Visibility.OWNER,
        )

        assert resp.status_code == 200
        assert SavedSearch.objects.filter(id=resp.data["id"]).exists()

    def test_empty(self):
        self.login_as(user=self.manager)
        resp = self.get_response(
            self.organization.slug,
            type=SearchType.ISSUE.value,
            name="hello",
            query="",
            visibility=Visibility.ORGANIZATION,
        )
        assert resp.status_code == 400
        assert "This field may not be blank." == resp.data["query"][0]


@region_silo_test
class OrgLevelOrganizationSearchesGetTest(APITestCase):
    endpoint = "sentry-api-0-organization-searches"
    method = "get"

    @cached_property
    def manager(self):
        user = self.create_user("manager@test.com")
        self.create_member(organization=self.organization, user=user, role="manager")
        return user

    @cached_property
    def member(self):
        user = self.create_user("member@test.com")
        self.create_member(organization=self.organization, user=user)
        return user

    def setUp(self):
        super().setUp()
        self.issue_search_manager_1 = SavedSearch.objects.create(
            organization=self.organization,
            name="Manager's Issue Search",
            query="is:unresolved",
            type=SearchType.ISSUE.value,
            visibility=Visibility.ORGANIZATION,
            owner_id=self.manager.id,
        )
        self.issue_search_manager_2 = SavedSearch.objects.create(
            organization=self.organization,
            name="Manager's Issue Search 2",
            query="is:unresolved",
            type=SearchType.ISSUE.value,
            visibility=Visibility.ORGANIZATION,
            owner_id=self.manager.id,
        )
        self.issue_search_member = SavedSearch.objects.create(
            organization=self.organization,
            name="Member's Issue Search",
            query="is:resolved",
            type=SearchType.ISSUE.value,
            visibility=Visibility.OWNER,
            owner_id=self.member.id,
        )
        self.event_search_global = SavedSearch.objects.create(
            name="Global Event Search",
            query="error.unhandled:true",
            type=SearchType.EVENT.value,
            visibility=Visibility.ORGANIZATION,
            is_global=True,
            owner_id=self.manager.id,
        )

    def test_manager_filters_by_issue_type(self):
        self.login_as(user=self.manager)
        response = self.get_success_response(self.organization.slug, type=SearchType.ISSUE.value)
        assert len(response.data) == 2
        search_ids = {search["id"] for search in response.data}
        assert search_ids == {
            str(self.issue_search_manager_1.id),
            str(self.issue_search_manager_2.id),
        }

    def test_member_filters_by_issue_type(self):
        self.login_as(user=self.member)
        response = self.get_success_response(self.organization.slug, type=SearchType.ISSUE.value)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.issue_search_member.id)

    def test_manager_sees_global_searches(self):
        self.login_as(user=self.manager)
        response = self.get_success_response(self.organization.slug, type=SearchType.EVENT.value)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.event_search_global.id)

    def test_member_sees_global_searches(self):
        self.login_as(user=self.member)
        response = self.get_success_response(self.organization.slug, type=SearchType.EVENT.value)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.event_search_global.id)
