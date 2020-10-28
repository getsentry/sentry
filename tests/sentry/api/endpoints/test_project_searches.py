from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import SavedSearch, SavedSearchUserDefault
from sentry.testutils import APITestCase


class ProjectSearchListTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")
        project2 = self.create_project(teams=[team], name="bar")
        SavedSearch.objects.filter(project=project1).delete()
        SavedSearch.objects.filter(project=project2).delete()

        search1 = SavedSearch.objects.create(project=project1, name="bar", query="")
        search2 = SavedSearch.objects.create(project=project1, name="foo", query="")
        SavedSearch.objects.create(project=project2, name="foo", query="")

        url = reverse(
            "sentry-api-0-project-searches",
            kwargs={"organization_slug": project1.organization.slug, "project_slug": project1.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["id"] == six.text_type(search1.id)
        assert response.data[1]["id"] == six.text_type(search2.id)

    def test_user_searches_visible__before_and_after_project_write_permissions(self):
        user = self.create_user()
        # user without project-write permissions
        member = self.create_member(user=user, organization=self.organization, role="member")
        self.login_as(user=user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")
        SavedSearch.objects.filter(project=project1).delete()

        url = reverse(
            "sentry-api-0-project-searches",
            kwargs={"organization_slug": project1.organization.slug, "project_slug": project1.slug},
        )

        resp = self.client.post(
            url, format="json", data={"name": "Latest Release", "query": "release:[latest]"}
        )
        assert resp.status_code == 201, resp.content
        search1 = SavedSearch.objects.get(project=project1, owner_id=user.id)

        resp = self.client.get(url, format="json")
        assert resp.status_code == 200, resp.content
        assert len(resp.data) == 1
        assert resp.data[0]["id"] == six.text_type(search1.id)

        # update permissions
        member.role = "manager"
        member.save()

        resp = self.client.post(
            url, format="json", data={"name": "New Yesterday", "query": "age:[-48h]"}
        )

        assert resp.status_code == 201, resp.content
        search2 = SavedSearch.objects.get(project=project1, owner_id__isnull=True)

        resp = self.client.get(url, format="json")
        assert resp.status_code == 200, resp.content
        assert len(resp.data) == 2
        assert resp.data[0]["id"] == six.text_type(search1.id)
        assert resp.data[1]["id"] == six.text_type(search2.id)


class ProjectSearchCreateTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project = self.create_project(teams=[team], name="foo")

        url = reverse(
            "sentry-api-0-project-searches",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, data={"name": "ignored", "query": "is:ignored"})

        assert response.status_code == 201, response.content
        assert response.data["id"]

        search = SavedSearch.objects.get(project=project, id=response.data["id"])
        assert not search.is_default

    def test_duplicate(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project = self.create_project(teams=[team], name="foo")

        SavedSearch.objects.create(name="ignored", project=project, query="")

        url = reverse(
            "sentry-api-0-project-searches",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        response = self.client.post(url, data={"name": "ignored", "query": "is:ignored"})

        assert response.status_code == 400, response.content

    def test_default(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project = self.create_project(teams=[team], name="foo")

        url = reverse(
            "sentry-api-0-project-searches",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(
            url, data={"name": "ignored", "query": "is:ignored", "isDefault": True}
        )

        assert response.status_code == 201, response.content
        assert response.data["id"]

        search = SavedSearch.objects.get(project=project, id=response.data["id"])
        assert search.is_default

        assert not SavedSearchUserDefault.objects.filter(
            project=project, user=self.user, savedsearch=search
        ).exists()

    def test_user_default(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project = self.create_project(teams=[team], name="foo")

        url = reverse(
            "sentry-api-0-project-searches",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(
            url, data={"name": "ignored", "query": "is:ignored", "isUserDefault": True}
        )

        assert response.status_code == 201, response.content
        assert response.data["id"]

        search = SavedSearch.objects.get(project=project, id=response.data["id"])
        assert not search.is_default

        userdefault = SavedSearchUserDefault.objects.get(project=project, user=self.user)
        assert userdefault.savedsearch == search
