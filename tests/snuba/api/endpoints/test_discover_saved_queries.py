from __future__ import absolute_import

from sentry.testutils import APITestCase, SnubaTestCase
from django.core.urlresolvers import reverse

from sentry.discover.models import DiscoverSavedQuery


class DiscoverSavedQueryBase(APITestCase, SnubaTestCase):
    def setUp(self):
        super(DiscoverSavedQueryBase, self).setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project_ids = [
            self.create_project(organization=self.org).id,
            self.create_project(organization=self.org).id,
        ]
        self.project_ids_without_access = [self.create_project().id]
        query = {"fields": ["test"], "conditions": [], "limit": 10}

        model = DiscoverSavedQuery.objects.create(
            organization=self.org, created_by=self.user, name="Test query", query=query
        )

        model.set_projects(self.project_ids)


class DiscoverSavedQueriesTest(DiscoverSavedQueryBase):
    feature_name = "organizations:discover"

    def test_get(self):
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Test query"
        assert response.data[0]["projects"] == self.project_ids
        assert response.data[0]["fields"] == ["test"]
        assert response.data[0]["conditions"] == []
        assert response.data[0]["limit"] == 10

    def test_post(self):
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "New query",
                    "projects": self.project_ids,
                    "fields": [],
                    "range": "24h",
                    "limit": 20,
                    "conditions": [],
                    "aggregations": [],
                    "orderby": "-time",
                },
            )
        assert response.status_code == 201, response.content
        assert response.data["name"] == "New query"
        assert response.data["projects"] == self.project_ids
        assert response.data["range"] == "24h"
        assert not hasattr(response.data, "start")
        assert not hasattr(response.data, "end")

    def test_post_invalid_projects(self):
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "New query",
                    "projects": self.project_ids_without_access,
                    "fields": [],
                    "range": "24h",
                    "limit": 20,
                    "conditions": [],
                    "aggregations": [],
                    "orderby": "-time",
                },
            )
        assert response.status_code == 403, response.content

    def test_post_all_projects(self):
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "All projects",
                    "projects": [-1],
                    "conditions": [],
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "orderby": "time",
                },
            )
        assert response.status_code == 201, response.content
        assert response.data["projects"] == [-1]
        assert response.data["name"] == "All projects"

    def test_post_cannot_use_version_two_fields(self):
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "New query",
                    "projects": self.project_ids,
                    "fields": ["id"],
                    "range": "24h",
                    "limit": 20,
                    "environment": ["dev"],
                    "fieldnames": ["event id"],
                    "aggregations": [],
                    "orderby": "-time",
                },
            )
        assert response.status_code == 400, response.content
        assert "cannot use the environment, fieldnames attribute(s)" in response.content


class DiscoverSavedQueriesVersion2Test(DiscoverSavedQueryBase):
    feature_name = "organizations:events-v2"

    def test_post_invalid_conditions(self):
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "New query",
                    "projects": self.project_ids,
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "version": 2,
                    "conditions": [["field", "=", "value"]],
                },
            )
        assert response.status_code == 400, response.content
        assert "cannot use the conditions attribute(s)" in response.content

    def test_post_require_selected_fields(self):
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "New query",
                    "projects": self.project_ids,
                    "fields": [],
                    "range": "24h",
                    "version": 2,
                },
            )
        assert response.status_code == 400, response.content
        assert "include at least one field" in response.content

    def test_post_fieldnames_length_mismatch(self):
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "new query",
                    "projects": self.project_ids,
                    "fields": ["event", "count()", "project"],
                    "fieldnames": ["event", "total"],
                    "range": "24h",
                    "version": 2,
                },
            )
        assert response.status_code == 400, response.content
        assert "equal number of field names and fields" in response.content

    def test_post_success(self):
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "new query",
                    "projects": self.project_ids,
                    "fields": ["title", "count()", "project"],
                    "environment": ["dev"],
                    "fieldnames": ["event title", "total", "project"],
                    "query": "event.type:error browser.name:Firefox",
                    "range": "24h",
                    "tags": ["release", "environment"],
                    "yAxis": "count(id)",
                    "version": 2,
                },
            )
        assert response.status_code == 201, response.content
        data = response.data
        assert data["fields"] == ["title", "count()", "project"]
        assert data["fieldnames"] == ["event title", "total", "project"]
        assert data["range"] == "24h"
        assert data["environment"] == ["dev"]
        assert data["query"] == "event.type:error browser.name:Firefox"
        assert data["tags"] == ["release", "environment"]
        assert data["yAxis"] == "count(id)"

    def test_post_success_no_fieldnames(self):
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "new query",
                    "projects": self.project_ids,
                    "fields": ["event", "count()", "project"],
                    "range": "24h",
                    "version": 2,
                },
            )
        assert response.status_code == 201, response.content

    def test_post_all_projects(self):
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "New query",
                    "projects": [-1],
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "version": 2,
                },
            )
        assert response.status_code == 201, response.content
        assert response.data["projects"] == [-1]
