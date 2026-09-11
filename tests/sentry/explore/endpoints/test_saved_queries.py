import pytest
from django.urls import reverse

from sentry.discover.models import (
    DiscoverSavedQuery,
    DiscoverSavedQueryLastVisited,
)
from sentry.explore.models import (
    ExploreSavedQuery,
    ExploreSavedQueryLastVisited,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now


@pytest.mark.skip(reason="API not public yet, this line will be removed in future")
class SavedQueriesTest(APITestCase):
    features = {
        "organizations:visibility-explore-view": True,
        "organizations:discover-queries-in-all-queries": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.projects = [
            self.create_project(organization=self.org),
            self.create_project(organization=self.org),
        ]
        self.project_ids = [project.id for project in self.projects]
        self.project_ids_without_access = [self.create_project().id]
        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}

        self.explore_query = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test query",
            query=query,
        )
        ExploreSavedQueryLastVisited.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=self.explore_query,
            last_visited=before_now(),
        )

        self.explore_query.set_projects(self.project_ids)

        self.discover_query_body = {"fields": ["test"], "conditions": [], "limit": 10}
        self.discover_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Discover query",
            query=self.discover_query_body,
            version=1,
        )
        self.discover_query.set_projects(self.project_ids)
        DiscoverSavedQueryLastVisited.objects.create(
            organization=self.org,
            user_id=self.user.id,
            discover_saved_query=self.discover_query,
            last_visited=before_now(minutes=30),
        )

        # Homepage queries belong to the Discover homepage, and never appear in
        # any returned list from this endpoint
        self.homepage_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Homepage query",
            query=self.discover_query_body,
            version=1,
            is_homepage=True,
        )

        self.url = reverse("sentry-api-0-saved-queries", args=[self.org.slug])

    def test_get(self) -> None:
        with self.feature(self.features):
            response = self.client.get(self.url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 7

        # Prebuilt query
        assert response.data[0]["name"] == "All Transactions"
        assert response.data[0]["queryType"] == "explore"
        assert response.data[0]["projects"] == []
        assert "range" not in response.data[0]
        assert response.data[0]["query"] == [
            {
                "caseInsensitive": False,
                "fields": [
                    "id",
                    "span.op",
                    "span.description",
                    "span.duration",
                    "transaction",
                    "timestamp",
                ],
                "query": "is_transaction:true",
                "mode": "samples",
                "visualize": [
                    {
                        "chartType": 0,
                        "yAxes": ["count()"],
                    },
                    {
                        "chartType": 1,
                        "yAxes": ["p75(span.duration)", "p90(span.duration)"],
                    },
                ],
                "orderby": "-timestamp",
            }
        ]
        assert "createdBy" in response.data[0]
        assert response.data[0]["createdBy"] is None
        assert not response.data[0]["expired"]

        # Discover query, sorted in between the prebuilts by name rather than
        # grouped after them -- the two sources are one interleaved list.
        assert response.data[2]["name"] == "Discover query"
        assert response.data[2]["queryType"] == "discover"
        assert sorted(response.data[2]["projects"]) == sorted(self.project_ids)
        assert response.data[2]["fields"] == ["test"]
        assert response.data[2]["createdBy"]["username"] == self.user.username
        assert not response.data[2]["expired"]

        # User saved query
        assert response.data[5]["name"] == "Test query"
        assert response.data[5]["queryType"] == "explore"
        assert sorted(response.data[5]["projects"]) == sorted(self.project_ids)
        assert response.data[5]["range"] == "24h"
        assert response.data[5]["query"] == [{"fields": ["span.op"], "mode": "samples"}]
        assert "createdBy" in response.data[5]
        assert response.data[5]["createdBy"]["username"] == self.user.username
        assert not response.data[5]["expired"]

        names = [row["name"] for row in response.data]
        assert names == [
            "All Transactions",
            "DB Latency",
            "Discover query",
            "LLM Calls",
            "Slow HTTP Requests",
            "Test query",
            "Worst Pageloads",
        ]
        # Discover homepage queries are not saved queries.
        assert "Homepage query" not in names

    def test_get_name_filter(self) -> None:
        with self.feature(self.features):
            response = self.client.get(self.url, format="json", data={"query": "Test"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Test query"

        with self.feature(self.features):
            # Also available as the name: filter.
            response = self.client.get(self.url, format="json", data={"query": "name:Test"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Test query"

        with self.feature(self.features):
            response = self.client.get(self.url, format="json", data={"query": "name:Nope"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        with self.feature(self.features):
            # A term both sources match filters each side of the union.
            response = self.client.get(self.url, format="json", data={"query": "query"})

        assert response.status_code == 200, response.content
        assert [row["name"] for row in response.data] == ["Discover query", "Test query"]
        assert [row["queryType"] for row in response.data] == ["discover", "explore"]

    def test_get_all_paginated(self) -> None:
        for i in range(0, 10):
            query = {
                "range": "24h",
                "query": [{"fields": ["span.op"], "mode": "samples"}],
            }
            model = ExploreSavedQuery.objects.create(
                organization=self.org,
                created_by_id=self.user.id,
                name=f"My query {i}",
                query=query,
            )
            model.set_projects(self.project_ids)

        with self.feature(self.features):
            response = self.client.get(self.url, data={"per_page": 1})
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
