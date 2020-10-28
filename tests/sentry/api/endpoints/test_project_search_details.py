from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import SavedSearch, SavedSearchUserDefault
from sentry.testutils import APITestCase


class ProjectSearchDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        search = SavedSearch.objects.create(project=project, name="foo", query="")

        url = reverse(
            "sentry-api-0-project-search-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "search_id": search.id,
            },
        )
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(search.id)


class UpdateProjectSearchDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        search = SavedSearch.objects.create(project=project, name="foo", query="")

        url = reverse(
            "sentry-api-0-project-search-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "search_id": search.id,
            },
        )
        response = self.client.put(url, {"name": "bar"})

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(search.id)

        search = SavedSearch.objects.get(id=search.id)
        assert search.name == "bar"

    def test_changing_default(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        search = SavedSearch.objects.create(project=project, name="foo", query="", is_default=False)
        search2 = SavedSearch.objects.create(project=project, name="bar", query="", is_default=True)

        url = reverse(
            "sentry-api-0-project-search-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "search_id": search.id,
            },
        )
        response = self.client.put(url, {"isDefault": True})

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(search.id)

        search = SavedSearch.objects.get(id=search.id)
        assert search.is_default

        search2 = SavedSearch.objects.get(id=search2.id)
        assert not search2.is_default

    def test_changing_user_default(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        search = SavedSearch.objects.create(project=project, name="foo", query="", is_default=True)
        search2 = SavedSearch.objects.create(
            project=project, name="bar", query="", is_default=False
        )
        userdefault = SavedSearchUserDefault.objects.create(
            savedsearch=search2, project=project, user=self.user
        )

        url = reverse(
            "sentry-api-0-project-search-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "search_id": search2.id,
            },
        )
        response = self.client.put(url, {"isUserDefault": True})

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(search2.id)

        search = SavedSearch.objects.get(id=search.id)
        assert search.is_default
        search2 = SavedSearch.objects.get(id=search2.id)
        assert not search2.is_default
        userdefault = SavedSearchUserDefault.objects.get(id=userdefault.id)
        assert userdefault.savedsearch == search2

    def test_member_can_override_their_default(self):
        project = self.create_project(name="foo")

        member = self.create_user("member@example.com", is_superuser=False)
        self.create_member(
            user=member,
            role="member",
            organization=project.organization,
            teams=[project.teams.first()],
        )

        search = SavedSearch.objects.create(project=project, name="foo", query="")

        SavedSearch.objects.create(project=project, name="bar", query="", is_default=True)

        self.login_as(user=member)

        url = reverse(
            "sentry-api-0-project-search-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "search_id": search.id,
            },
        )
        response = self.client.put(
            url,
            {
                # these params get ignored barring isUserDefault
                "name": "baz",
                "isUserDefault": True,
                "isDefault": True,
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(search.id)

        search = SavedSearch.objects.get(id=search.id)
        assert search.name == "foo"
        assert not search.is_default

        assert SavedSearchUserDefault.objects.filter(
            user=member, project=project, savedsearch=search
        ).exists()


class DeleteProjectSearchTest(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)

    def get_url(self, search):
        return reverse(
            "sentry-api-0-project-search-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "search_id": search.id,
            },
        )

    def create_user_with_member_role(self):
        user = self.create_user()
        self.create_member(user=user, role="member", organization=self.organization)
        return user

    def test_owner_can_delete_shared_searches(self):
        search = SavedSearch.objects.create(project=self.project, name="foo", query="")

        response = self.client.delete(self.get_url(search))

        assert response.status_code == 204, response.content
        assert not SavedSearch.objects.filter(id=search.id).exists()

    def test_owner_can_delete_own_searches(self):
        search = SavedSearch.objects.create(
            project=self.project, name="foo", query="", owner=self.user
        )

        response = self.client.delete(self.get_url(search))

        assert response.status_code == 204, response.content
        assert not SavedSearch.objects.filter(id=search.id).exists()

    def test_owners_cannot_delete_searches_they_do_not_own(self):
        search = SavedSearch.objects.create(
            project=self.project, name="foo", query="", owner=self.create_user()
        )

        response = self.client.delete(self.get_url(search))

        assert response.status_code == 403, response.content
        assert SavedSearch.objects.filter(id=search.id).exists()

    def test_members_can_delete_own_searches(self):
        user = self.create_user_with_member_role()
        search = SavedSearch.objects.create(project=self.project, name="foo", query="", owner=user)

        self.login_as(user=user)
        response = self.client.delete(self.get_url(search))

        assert response.status_code == 204, response.content
        assert not SavedSearch.objects.filter(id=search.id).exists()

    def test_members_cannot_delete_searches_they_do_not_own(self):
        user = self.create_user_with_member_role()
        search = SavedSearch.objects.create(
            project=self.project, name="foo", query="", owner=self.create_user()
        )

        self.login_as(user=user)
        response = self.client.delete(self.get_url(search))

        assert response.status_code == 403, response.content
        assert SavedSearch.objects.filter(id=search.id).exists()

    def test_members_cannot_delete_shared_searches(self):
        user = self.create_user_with_member_role()
        search = SavedSearch.objects.create(project=self.project, name="foo", query="")

        self.login_as(user=user)
        response = self.client.delete(self.get_url(search))

        assert response.status_code == 403, response.content
        assert SavedSearch.objects.filter(id=search.id).exists()
