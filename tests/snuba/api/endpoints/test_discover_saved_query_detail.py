import pytest
from django.urls import NoReverseMatch, reverse

from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryProject
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class DiscoverSavedQueryDetailTest(APITestCase, SnubaTestCase):
    feature_name = "organizations:discover"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.org_without_access = self.create_organization()
        self.project_ids = [
            self.create_project(organization=self.org).id,
            self.create_project(organization=self.org).id,
        ]
        query = {"fields": ["test"], "conditions": [], "limit": 10}

        model = DiscoverSavedQuery.objects.create(
            organization=self.org, created_by_id=self.user.id, name="Test query", query=query
        )

        model.set_projects(self.project_ids)

        self.query_id = model.id

        invalid = DiscoverSavedQuery.objects.create(
            organization=self.org_without_access, name="Query without access", query=query
        )
        invalid.set_projects(self.project_ids)

        self.query_id_without_access = invalid.id

    def test_invalid_id(self):
        with pytest.raises(NoReverseMatch):
            reverse("sentry-api-0-discover-saved-query-detail", args=[self.org.slug, "not-an-id"])

    def test_get(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail", args=[self.org.slug, self.query_id]
            )
            response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.query_id)
        assert set(response.data["projects"]) == set(self.project_ids)
        assert response.data["fields"] == ["test"]
        assert response.data["conditions"] == []
        assert response.data["limit"] == 10

    def test_get_discover_query_flag(self):
        with self.feature("organizations:discover-query"):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail", args=[self.org.slug, self.query_id]
            )
            response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.query_id)
        assert set(response.data["projects"]) == set(self.project_ids)
        assert response.data["fields"] == ["test"]
        assert response.data["conditions"] == []
        assert response.data["limit"] == 10

    def test_get_version(self):
        query = {"fields": ["event_id"], "query": "event.type:error", "limit": 10, "version": 2}
        model = DiscoverSavedQuery.objects.create(
            organization=self.org, created_by_id=self.user.id, name="v2 query", query=query
        )

        model.set_projects(self.project_ids)
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail", args=[self.org.slug, model.id]
            )
            response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(model.id)
        assert set(response.data["projects"]) == set(self.project_ids)
        assert response.data["fields"] == ["event_id"]
        assert response.data["query"] == "event.type:error"
        assert response.data["limit"] == 10
        assert response.data["version"] == 2

    def test_get_org_without_access(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail",
                args=[self.org_without_access.slug, self.query_id],
            )
            response = self.client.get(url)

        assert response.status_code == 403, response.content

    def test_get_homepage_query(self):
        query = {"fields": ["event_id"], "query": "event.type:error", "limit": 10, "version": 2}
        model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="v2 query",
            query=query,
            is_homepage=True,
        )

        model.set_projects(self.project_ids)
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail", args=[self.org.slug, model.id]
            )
            response = self.client.get(url)

        assert response.status_code == 404, response.content

    def test_put(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail", args=[self.org.slug, self.query_id]
            )

            response = self.client.put(
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

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.query_id)
        assert set(response.data["projects"]) == set(self.project_ids)
        assert response.data["fields"] == []
        assert response.data["conditions"] == []
        assert response.data["limit"] == 20

    def test_put_with_interval(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail", args=[self.org.slug, self.query_id]
            )

            response = self.client.put(
                url,
                {
                    "name": "New query",
                    "projects": self.project_ids,
                    "fields": ["transaction", "count()"],
                    "range": "24h",
                    "interval": "10m",
                    "version": 2,
                    "orderby": "-count",
                },
            )

        assert response.status_code == 200, response.content
        assert response.data["fields"] == ["transaction", "count()"]
        assert response.data["interval"] == "10m"

    def test_put_query_without_access(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail",
                args=[self.org.slug, self.query_id_without_access],
            )

            response = self.client.put(
                url, {"name": "New query", "projects": self.project_ids, "range": "24h"}
            )

            assert response.status_code == 404

    def test_put_query_with_team(self):
        team = self.create_team(organization=self.org, members=[self.user])
        project = self.create_project(organization=self.org, teams=[team])
        query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test query",
            query={"fields": ["test"], "conditions": [], "limit": 10},
        )
        query.set_projects([project.id])

        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail",
                args=[self.org.slug, query.id],
            )

            response = self.client.put(url, {"name": "New query", "projects": [], "range": "24h"})

            assert response.status_code == 200

    def test_put_query_without_team(self):
        team = self.create_team(organization=self.org, members=[])
        project = self.create_project(organization=self.org, teams=[team])
        query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test query",
            query={"fields": ["test"], "conditions": [], "limit": 10},
        )
        query.set_projects([project.id])

        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail",
                args=[self.org.slug, query.id],
            )

            response = self.client.put(url, {"name": "New query", "projects": [], "range": "24h"})

            assert response.status_code == 400
            assert "No Projects found, join a Team" == response.data["detail"]

    def test_put_homepage_query(self):
        query = {"fields": ["event_id"], "query": "event.type:error", "limit": 10, "version": 2}
        model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="v2 query",
            query=query,
            is_homepage=True,
        )

        model.set_projects(self.project_ids)
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail",
                args=[self.org.slug, model.id],
            )
            response = self.client.put(
                url, {"name": "New query", "projects": [], "range": "24h", "fields": []}
            )

        assert response.status_code == 404, response.content

    def test_put_org_without_access(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail",
                args=[self.org_without_access.slug, self.query_id],
            )
            response = self.client.put(
                url, {"name": "New query", "projects": self.project_ids, "range": "24h"}
            )

        assert response.status_code == 403, response.content

    def test_delete(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail", args=[self.org.slug, self.query_id]
            )

            response = self.client.delete(url)

            assert response.status_code == 204

            assert self.client.get(url).status_code == 404

    def test_delete_removes_projects(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail", args=[self.org.slug, self.query_id]
            )

            self.client.delete(url)

        projects = list(
            DiscoverSavedQueryProject.objects.filter(discover_saved_query=self.query_id)
        )

        assert projects == []

    def test_delete_query_without_access(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail",
                args=[self.org.slug, self.query_id_without_access],
            )

            response = self.client.delete(url)

            assert response.status_code == 404

    def test_delete_org_without_access(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail",
                args=[self.org_without_access.slug, self.query_id],
            )
            response = self.client.delete(url)

        assert response.status_code == 403, response.content

    def test_delete_homepage_query(self):
        query = {"fields": ["event_id"], "query": "event.type:error", "limit": 10, "version": 2}
        model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="v2 query",
            query=query,
            is_homepage=True,
        )

        model.set_projects(self.project_ids)
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-discover-saved-query-detail",
                args=[self.org.slug, model.id],
            )
            response = self.client.delete(url)

        assert response.status_code == 404, response.content


@region_silo_test
class OrganizationDiscoverQueryVisitTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.org_without_access = self.create_organization()
        self.project_ids = [
            self.create_project(organization=self.org).id,
            self.create_project(organization=self.org).id,
        ]
        q = {"fields": ["test"], "conditions": [], "limit": 10}

        self.query = DiscoverSavedQuery.objects.create(
            organization=self.org, created_by_id=self.user.id, name="Test query", query=q
        )

        self.query.set_projects(self.project_ids)

    def url(self, query_id):
        return reverse(
            "sentry-api-0-discover-saved-query-visit",
            kwargs={"organization_slug": self.org.slug, "query_id": query_id},
        )

    def test_visit_query(self):
        last_visited = self.query.last_visited
        assert self.query.visits == 1

        with self.feature("organizations:discover-query"):
            response = self.client.post(self.url(self.query.id))

        assert response.status_code == 204

        query = DiscoverSavedQuery.objects.get(id=self.query.id)
        assert query.visits == 2
        assert query.last_visited > last_visited

    def test_visit_query_no_access(self):
        last_visited = self.query.last_visited
        assert self.query.visits == 1

        with self.feature({"organizations:discover-query": False}):
            response = self.client.post(self.url(self.query.id))

        assert response.status_code == 404

        query = DiscoverSavedQuery.objects.get(id=self.query.id)
        assert query.visits == 1
        assert query.last_visited == last_visited
