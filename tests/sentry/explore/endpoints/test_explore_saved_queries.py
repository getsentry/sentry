from django.urls import reverse

from sentry.explore.models import ExploreSavedQuery
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class ExploreSavedQueriesTest(APITestCase, SnubaTestCase):
    feature_name = "organizations:performance-trace-explorer"

    def setUp(self):
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

        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test query",
            query=query,
        )

        model.set_projects(self.project_ids)

        self.url = reverse("sentry-api-0-explore-saved-queries", args=[self.org.slug])

    def test_get(self):
        with self.feature(self.feature_name):
            response = self.client.get(self.url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Test query"
        assert response.data[0]["projects"] == self.project_ids
        assert response.data[0]["range"] == "24h"
        assert response.data[0]["query"] == [{"fields": ["span.op"], "mode": "samples"}]
        assert "createdBy" in response.data[0]
        assert response.data[0]["createdBy"]["username"] == self.user.username
        assert not response.data[0]["expired"]

    def test_get_name_filter(self):
        with self.feature(self.feature_name):
            response = self.client.get(self.url, format="json", data={"query": "Test"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Test query"

        with self.feature(self.feature_name):
            # Also available as the name: filter.
            response = self.client.get(self.url, format="json", data={"query": "name:Test"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Test query"

        with self.feature(self.feature_name):
            response = self.client.get(self.url, format="json", data={"query": "name:Nope"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_get_all_paginated(self):
        for i in range(0, 10):
            query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
            model = ExploreSavedQuery.objects.create(
                organization=self.org,
                created_by_id=self.user.id,
                name=f"My query {i}",
                query=query,
            )
            model.set_projects(self.project_ids)

        with self.feature(self.feature_name):
            response = self.client.get(self.url, data={"per_page": 1})
        assert response.status_code == 200, response.content
        assert len(response.data) == 1

    def test_get_sortby(self):
        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="My query",
            query=query,
            date_added=before_now(minutes=10),
            date_updated=before_now(minutes=10),
        )
        model.set_projects(self.project_ids)

        sort_options = {
            "dateAdded": True,
            "-dateAdded": False,
            "dateUpdated": True,
            "-dateUpdated": False,
            "name": True,
            "-name": False,
        }
        for sorting, forward_sort in sort_options.items():
            with self.feature(self.feature_name):
                response = self.client.get(self.url, data={"sortBy": sorting})
            assert response.status_code == 200

            values = [row[sorting.strip("-")] for row in response.data]
            if not forward_sort:
                values = list(reversed(values))
            assert list(sorted(values)) == values

    def test_get_sortby_most_popular(self):
        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="My query",
            query=query,
            visits=3,
            date_added=before_now(minutes=10),
            date_updated=before_now(minutes=10),
            last_visited=before_now(minutes=5),
        )

        model.set_projects(self.project_ids)
        for forward_sort in [True, False]:
            sorting = "mostPopular" if forward_sort else "-mostPopular"
            with self.feature(self.feature_name):
                response = self.client.get(self.url, data={"sortBy": sorting})

            assert response.status_code == 200
            values = [row["name"] for row in response.data]
            expected = ["My query", "Test query"]

            if not forward_sort:
                expected = list(reversed(expected))

            assert values == expected

    def test_get_sortby_recently_viewed(self):
        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="My query",
            query=query,
            visits=3,
            date_added=before_now(minutes=10),
            date_updated=before_now(minutes=10),
            last_visited=before_now(minutes=5),
        )

        model.set_projects(self.project_ids)
        for forward_sort in [True, False]:
            sorting = "recentlyViewed" if forward_sort else "-recentlyViewed"
            with self.feature(self.feature_name):
                response = self.client.get(self.url, data={"sortBy": sorting})

            assert response.status_code == 200
            values = [row["name"] for row in response.data]
            expected = ["Test query", "My query"]

            if not forward_sort:
                expected = list(reversed(expected))

            assert values == expected

    def test_get_sortby_myqueries(self):
        uhoh_user = self.create_user(username="uhoh")
        self.create_member(organization=self.org, user=uhoh_user)

        whoops_user = self.create_user(username="whoops")
        self.create_member(organization=self.org, user=whoops_user)

        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=uhoh_user.id,
            name="a query for uhoh",
            query=query,
            date_added=before_now(minutes=10),
            date_updated=before_now(minutes=10),
        )
        model.set_projects(self.project_ids)

        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=whoops_user.id,
            name="a query for whoops",
            query=query,
            date_added=before_now(minutes=10),
            date_updated=before_now(minutes=10),
        )
        model.set_projects(self.project_ids)

        with self.feature(self.feature_name):
            response = self.client.get(self.url, data={"sortBy": "myqueries"})
        assert response.status_code == 200, response.content
        values = [int(item["createdBy"]["id"]) for item in response.data]
        assert values == [self.user.id, uhoh_user.id, whoops_user.id]

    def test_get_expired_query(self):
        query = {
            "start": before_now(days=90),
            "end": before_now(days=61),
        }
        ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="My expired query",
            query=query,
            date_added=before_now(days=90),
            date_updated=before_now(minutes=10),
        )
        with self.options({"system.event-retention-days": 60}), self.feature(self.feature_name):
            response = self.client.get(self.url, {"query": "name:My expired query"})

        assert response.status_code == 200, response.content
        assert response.data[0]["expired"]

    def test_get_my_queries(self):
        with self.feature(self.feature_name):
            response = self.client.get(self.url, data={"exclude": "shared"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Test query"

    def test_get_shared_queries(self):
        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id + 1,
            name="Shared query",
            query=query,
        )
        model.set_projects(self.project_ids)

        with self.feature(self.feature_name):
            response = self.client.get(self.url, data={"exclude": "owned"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Shared query"

    def test_get_query_last_visited(self):
        last_visited = before_now(minutes=10)
        query = {"fields": ["span.op"], "mode": "samples"}
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Query with last visited",
            query=query,
            last_visited=last_visited,
        )
        model.set_projects(self.project_ids)

        with self.feature(self.feature_name):
            response = self.client.get(self.url, data={"query": "name:Query with last visited"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["lastVisited"] == last_visited

    def test_post_require_mode(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "New query",
                    "projects": self.project_ids,
                    "query": [{"fields": []}],
                    "range": "24h",
                },
            )
        assert response.status_code == 400, response.content
        assert "This field is required." == response.data["query"]["mode"][0]

    def test_post_success(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "new query",
                    "projects": self.project_ids,
                    "environment": ["dev"],
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "query": "span.op:pageload",
                        }
                    ],
                    "range": "24h",
                },
            )
        assert response.status_code == 201, response.content
        data = response.data
        assert data["range"] == "24h"
        assert data["environment"] == ["dev"]
        assert data["query"] == [
            {
                "fields": ["span.op", "count(span.duration)"],
                "mode": "samples",
                "query": "span.op:pageload",
            }
        ]
        assert data["projects"] == self.project_ids
        assert data["dataset"] == "spans"

    def test_post_all_projects(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "New query",
                    "projects": [-1],
                    "range": "24h",
                    "query": [{"fields": ["span.op", "count(span.duration)"], "mode": "samples"}],
                },
            )
        assert response.status_code == 201, response.content
        assert response.data["projects"] == [-1]

    def test_save_with_project(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "project query",
                    "projects": self.project_ids,
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "query": f"project:{self.projects[0].slug}",
                        }
                    ],
                },
            )
        assert response.status_code == 201, response.content
        assert ExploreSavedQuery.objects.filter(name="project query").exists()

    def test_save_with_project_and_my_projects(self):
        team = self.create_team(organization=self.org, members=[self.user])
        project = self.create_project(organization=self.org, teams=[team])
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "project query",
                    "projects": [],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "query": f"project:{project.slug}",
                        }
                    ],
                },
            )
        assert response.status_code == 201, response.content
        assert ExploreSavedQuery.objects.filter(name="project query").exists()

    def test_save_with_org_projects(self):
        project = self.create_project(organization=self.org)
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "project query",
                    "projects": [project.id],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "query": f"project:{project.slug}",
                        }
                    ],
                },
            )
        assert response.status_code == 201, response.content
        assert ExploreSavedQuery.objects.filter(name="project query").exists()

    def test_save_with_team_project(self):
        team = self.create_team(organization=self.org, members=[self.user])
        project = self.create_project(organization=self.org, teams=[team])
        self.create_project(organization=self.org, teams=[team])
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "project query",
                    "projects": [project.id],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "query": f"project:{project.slug}",
                        }
                    ],
                },
            )
        assert response.status_code == 201, response.content
        assert ExploreSavedQuery.objects.filter(name="project query").exists()

    def test_save_without_team(self):
        team = self.create_team(organization=self.org, members=[])
        self.create_project(organization=self.org, teams=[team])
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "without team query",
                    "projects": [],
                    "range": "24h",
                    "query": [{"fields": ["span.op", "count(span.duration)"], "mode": "samples"}],
                },
            )

        assert response.status_code == 400
        assert "No Projects found, join a Team" == response.data["detail"]

    def test_save_with_team_and_without_project(self):
        team = self.create_team(organization=self.org, members=[self.user])
        self.create_project(organization=self.org, teams=[team])
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "with team query",
                    "projects": [],
                    "range": "24h",
                    "query": [{"fields": ["span.op", "count(span.duration)"], "mode": "samples"}],
                },
            )

        assert response.status_code == 201, response.content
        assert ExploreSavedQuery.objects.filter(name="with team query").exists()

    def test_save_with_wrong_projects(self):
        other_org = self.create_organization(owner=self.user)
        project = self.create_project(organization=other_org)
        project2 = self.create_project(organization=self.org)
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "project query",
                    "projects": [project.id],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "query": f"project:{project.slug}",
                        }
                    ],
                },
            )
        assert response.status_code == 403, response.content
        assert not ExploreSavedQuery.objects.filter(name="project query").exists()

        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "project query",
                    "projects": [project.id, project2.id],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "query": f"project:{project.slug} project:{project2.slug}",
                        }
                    ],
                },
            )
        assert response.status_code == 403, response.content
        assert not ExploreSavedQuery.objects.filter(name="project query").exists()

    def test_save_interval(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "Interval query",
                    "projects": [-1],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "query": "spaceAfterColon:1",
                        }
                    ],
                    "interval": "1m",
                },
            )
        assert response.status_code == 201, response.content
        assert response.data["name"] == "Interval query"
        assert response.data["interval"] == "1m"

    def test_save_invalid_interval(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "Interval query",
                    "projects": [-1],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "query": "spaceAfterColon:1",
                        }
                    ],
                    "interval": "1s",
                },
            )
        assert response.status_code == 400, response.content
