import pytest
from django.urls import NoReverseMatch, reverse

from sentry.explore.models import (
    ExploreSavedQuery,
    ExploreSavedQueryProject,
    ExploreSavedQueryStarred,
)
from sentry.testutils.cases import APITestCase, SnubaTestCase


class ExploreSavedQueryDetailTest(APITestCase, SnubaTestCase):
    feature_name = "organizations:visibility-explore-view"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.org_without_access = self.create_organization()
        self.project_ids = [
            self.create_project(organization=self.org).id,
            self.create_project(organization=self.org).id,
        ]
        query = {"query": [{"fields": ["span.op"], "mode": "samples"}]}

        model = ExploreSavedQuery.objects.create(
            organization=self.org, created_by_id=self.user.id, name="Test query", query=query
        )

        model.set_projects(self.project_ids)

        self.query_id = model.id
        self.model = model

        invalid = ExploreSavedQuery.objects.create(
            organization=self.org_without_access, name="Query without access", query=query
        )
        invalid.set_projects(self.project_ids)

        self.query_id_without_access = invalid.id

    def test_invalid_id(self):
        with pytest.raises(NoReverseMatch):
            reverse("sentry-api-0-explore-saved-query-detail", args=[self.org.slug, "not-an-id"])

    def test_get(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail", args=[self.org.slug, self.query_id]
            )
            response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.query_id)
        assert set(response.data["projects"]) == set(self.project_ids)
        assert response.data["query"] == [{"fields": ["span.op"], "mode": "samples"}]

    def test_get_explore_query_flag(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail", args=[self.org.slug, self.query_id]
            )
            response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.query_id)
        assert set(response.data["projects"]) == set(self.project_ids)
        assert response.data["query"] == [{"fields": ["span.op"], "mode": "samples"}]

    def test_get_org_without_access(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail",
                args=[self.org_without_access.slug, self.query_id],
            )
            response = self.client.get(url)

        assert response.status_code == 403, response.content

    def test_get_starred(self):
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=self.model,
            position=1,
        )
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail", args=[self.org.slug, self.query_id]
            )
            response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.query_id)
        assert response.data["starred"] is True
        assert response.data["position"] == 1

    def test_put(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail", args=[self.org.slug, self.query_id]
            )

            response = self.client.put(
                url,
                {
                    "name": "New query",
                    "projects": self.project_ids,
                    "query": [{"fields": [], "mode": "samples"}],
                    "range": "24h",
                    "orderby": "-timestamp",
                },
            )

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(self.query_id)
        assert set(response.data["projects"]) == set(self.project_ids)
        assert response.data["query"] == [{"fields": [], "mode": "samples"}]

    def test_put_with_interval(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail", args=[self.org.slug, self.query_id]
            )

            response = self.client.put(
                url,
                {
                    "name": "New query",
                    "projects": self.project_ids,
                    "range": "24h",
                    "interval": "10m",
                    "orderby": "-count(span.duration)",
                    "query": [{"fields": ["span.op", "count(span.duration)"], "mode": "samples"}],
                },
            )

        assert response.status_code == 200, response.content
        assert response.data["interval"] == "10m"
        assert response.data["query"] == [
            {"fields": ["span.op", "count(span.duration)"], "mode": "samples"}
        ]

    def test_put_query_without_access(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail",
                args=[self.org.slug, self.query_id_without_access],
            )

            response = self.client.put(
                url,
                {
                    "name": "New query",
                    "projects": self.project_ids,
                    "range": "24h",
                    "mode": "samples",
                },
            )

            assert response.status_code == 404

    def test_put_query_with_team(self):
        team = self.create_team(organization=self.org, members=[self.user])
        project = self.create_project(organization=self.org, teams=[team])
        query = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test query",
            query={"fields": ["span.op"], "mode": "samples"},
        )
        query.set_projects([project.id])

        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail",
                args=[self.org.slug, query.id],
            )

            response = self.client.put(
                url, {"name": "New query", "projects": [], "range": "24h", "mode": "samples"}
            )

            assert response.status_code == 200

    def test_put_query_without_team(self):
        team = self.create_team(organization=self.org, members=[])
        project = self.create_project(organization=self.org, teams=[team])
        query = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test query",
            query={"fields": ["span.op"], "mode": "samples"},
        )
        query.set_projects([project.id])

        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail",
                args=[self.org.slug, query.id],
            )

            response = self.client.put(url, {"name": "New query", "projects": [], "range": "24h"})

            assert response.status_code == 400
            assert "No Projects found, join a Team" == response.data["detail"]

    def test_put_org_without_access(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail",
                args=[self.org_without_access.slug, self.query_id],
            )
            response = self.client.put(
                url, {"name": "New query", "projects": self.project_ids, "range": "24h"}
            )

        assert response.status_code == 403, response.content

    def test_delete(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail", args=[self.org.slug, self.query_id]
            )

            response = self.client.delete(url)

            assert response.status_code == 204

            assert self.client.get(url).status_code == 404

    def test_delete_removes_projects(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail", args=[self.org.slug, self.query_id]
            )

            self.client.delete(url)

        projects = list(ExploreSavedQueryProject.objects.filter(explore_saved_query=self.query_id))

        assert projects == []

    def test_delete_query_without_access(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail",
                args=[self.org.slug, self.query_id_without_access],
            )

            response = self.client.delete(url)

            assert response.status_code == 404

    def test_delete_org_without_access(self):
        with self.feature(self.feature_name):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail",
                args=[self.org_without_access.slug, self.query_id],
            )
            response = self.client.delete(url)

        assert response.status_code == 403, response.content


class OrganizationExploreQueryVisitTest(APITestCase, SnubaTestCase):
    feature_name = "organizations:visibility-explore-view"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.org_without_access = self.create_organization()
        self.project_ids = [
            self.create_project(organization=self.org).id,
            self.create_project(organization=self.org).id,
        ]
        q = {"fields": ["span.op"], "mode": "samples"}

        self.query = ExploreSavedQuery.objects.create(
            organization=self.org, created_by_id=self.user.id, name="Test query", query=q
        )

        self.query.set_projects(self.project_ids)

    def url(self, id):
        return reverse(
            "sentry-api-0-explore-saved-query-visit",
            kwargs={"organization_id_or_slug": self.org.slug, "id": id},
        )

    def test_visit_query(self):
        last_visited = self.query.last_visited
        assert last_visited is not None
        assert self.query.visits == 1

        with self.feature(self.feature_name):
            response = self.client.post(self.url(self.query.id))

        assert response.status_code == 204

        query = ExploreSavedQuery.objects.get(id=self.query.id)
        assert query.visits == 2
        assert query.last_visited is not None
        assert query.last_visited > last_visited

    def test_visit_query_no_access(self):
        last_visited = self.query.last_visited
        assert self.query.visits == 1

        with self.feature({self.feature_name: False}):
            response = self.client.post(self.url(self.query.id))

        assert response.status_code == 404

        query = ExploreSavedQuery.objects.get(id=self.query.id)
        assert query.visits == 1
        assert query.last_visited == last_visited
