from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.explore.models import (
    ExploreSavedQuery,
    ExploreSavedQueryDataset,
    ExploreSavedQueryLastVisited,
    ExploreSavedQueryStarred,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now


class ExploreSavedQueriesTest(APITestCase):
    features = {
        "organizations:visibility-explore-view": True,
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

        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test query",
            query=query,
        )
        ExploreSavedQueryLastVisited.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model,
            last_visited=before_now(),
        )

        model.set_projects(self.project_ids)

        self.url = reverse("sentry-api-0-explore-saved-queries", args=[self.org.slug])

    def test_get(self) -> None:
        with self.feature(self.features):
            response = self.client.get(self.url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 5

        # Prebuilt query
        assert response.data[0]["name"] == "All Transactions"
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

        # User saved query
        assert response.data[3]["name"] == "Test query"
        assert response.data[3]["projects"] == self.project_ids
        assert response.data[3]["range"] == "24h"
        assert response.data[3]["query"] == [{"fields": ["span.op"], "mode": "samples"}]
        assert "createdBy" in response.data[3]
        assert response.data[3]["createdBy"]["username"] == self.user.username
        assert not response.data[3]["expired"]

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

    def test_get_sortby(self) -> None:
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
            with self.feature(self.features):
                response = self.client.get(self.url, data={"sortBy": sorting})
            assert response.status_code == 200

            values = [row[sorting.strip("-")] for row in response.data]
            if not forward_sort:
                values = list(reversed(values))
            assert list(sorted(values)) == values

    def test_get_sortby_most_popular(self) -> None:
        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        ExploreSavedQuery.objects.filter(name="Test query").update(visits=2)
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
            with self.feature(self.features):
                response = self.client.get(self.url, data={"sortBy": sorting})

            assert response.status_code == 200
            values = [row["name"] for row in response.data]
            expected = ["My query", "Test query"]

            if forward_sort:
                assert values[0] == expected[0]
                assert values[1] == expected[1]
            else:
                assert values[-1] == expected[0]
                assert values[-2] == expected[1]

    def test_get_sortby_recently_viewed(self) -> None:
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
        ExploreSavedQueryLastVisited.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model,
            last_visited=before_now(minutes=5),
        )

        model.set_projects(self.project_ids)
        for forward_sort in [True, False]:
            sorting = "recentlyViewed" if forward_sort else "-recentlyViewed"
            with self.feature(self.features):
                response = self.client.get(self.url, data={"sortBy": sorting})

            assert response.status_code == 200
            values = [row["name"] for row in response.data]
            expected = ["Test query", "My query"]

            if not forward_sort:
                assert values[0] == expected[1]
                assert values[1] == expected[0]
            else:
                assert values[0] == expected[0]
                assert values[1] == expected[1]

    def test_get_sortby_myqueries(self) -> None:
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

        with self.feature(self.features):
            response = self.client.get(self.url, data={"sortBy": "myqueries"})
        assert response.status_code == 200, response.content
        assert response.data[0]["createdBy"]["id"] == str(self.user.id)
        assert response.data[1]["createdBy"]["id"] == str(uhoh_user.id)
        assert response.data[2]["createdBy"]["id"] == str(whoops_user.id)

    def test_get_expired_query(self) -> None:
        query = {
            "start": str(before_now(days=90)),
            "end": str(before_now(days=61)),
        }
        ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="My expired query",
            query=query,
            date_added=before_now(days=90),
            date_updated=before_now(minutes=10),
        )
        with (
            self.options({"system.event-retention-days": 60}),
            self.feature(self.features),
        ):
            response = self.client.get(self.url, {"query": "name:My expired query"})

        assert response.status_code == 200, response.content
        assert response.data[0]["expired"]

    def test_get_my_queries(self) -> None:
        with self.feature(self.features):
            response = self.client.get(self.url, data={"exclude": "shared"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Test query"

    def test_get_shared_queries(self) -> None:
        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id + 1,
            name="Shared query",
            query=query,
        )
        model.set_projects(self.project_ids)

        with self.feature(self.features):
            response = self.client.get(self.url, data={"exclude": "owned", "sortBy": "dateAdded"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 5
        assert response.data[0]["name"] == "Shared query"

    def test_get_query_last_visited(self) -> None:
        last_visited = before_now(minutes=10)
        query = {"fields": ["span.op"], "mode": "samples"}
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Query with last visited",
            query=query,
            last_visited=last_visited,
        )
        ExploreSavedQueryLastVisited.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model,
            last_visited=last_visited,
        )
        model.set_projects(self.project_ids)

        with self.feature(self.features):
            response = self.client.get(self.url, data={"query": "name:Query with last visited"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["lastVisited"] == last_visited

    def test_get_no_starred_queries(self) -> None:
        with self.feature(self.features):
            response = self.client.get(self.url, data={"starred": "1"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 4

        # Unstars prebuilt queries
        ExploreSavedQueryStarred.objects.filter(
            organization=self.org,
            user_id=self.user.id,
            starred=True,
        ).update(starred=False)

        with self.feature(self.features):
            response = self.client.get(self.url, data={"starred": "1"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_get_starred_queries(self) -> None:
        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        model_a = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Starred query A",
            query=query,
        )
        model_a.set_projects(self.project_ids)
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model_a,
            position=1,
        )
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id + 1,
            explore_saved_query=model_a,
            position=1,
        )

        model_b = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Starred query B",
            query=query,
        )
        model_b.set_projects(self.project_ids)
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id + 1,
            explore_saved_query=model_b,
            position=2,
        )

        with self.feature(self.features):
            response = self.client.get(self.url, data={"starred": "1"})
        assert response.status_code == 200, response.content
        assert (
            len(response.data) == 5
        )  # Only one query should be returned because the other query is starred by a different user
        assert response.data[0]["name"] == "Starred query A"
        assert response.data[0]["starred"] is True
        assert response.data[0]["position"] == 1

    def test_get_most_starred_queries(self) -> None:
        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Most starred query",
            query=query,
        )
        second_model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Second most starred query",
            query=query,
        )
        model.set_projects(self.project_ids)
        second_model.set_projects(self.project_ids)
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model,
            position=1,
        )
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id + 1,
            explore_saved_query=model,
            position=1,
        )
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id + 2,
            explore_saved_query=model,
            position=1,
        )
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=second_model,
            position=2,
        )
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id + 1,
            explore_saved_query=second_model,
            position=2,
        )

        with self.feature(self.features):
            response = self.client.get(self.url, data={"sortBy": "mostStarred"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 7
        assert response.data[0]["name"] == "Most starred query"
        assert response.data[0]["starred"] is True
        assert response.data[0]["position"] == 1
        assert response.data[1]["name"] == "Second most starred query"
        assert response.data[1]["starred"] is True
        assert response.data[1]["position"] == 2
        assert response.data[-1]["name"] == "Test query"
        assert response.data[-1]["starred"] is False
        assert response.data[-1]["position"] is None

    def test_get_sortby_multiple(self) -> None:
        # Trigger prebuilt queries creation and unstar prebuilt queries to simplify test
        with self.feature(self.features):
            response = self.client.get(self.url)
        ExploreSavedQueryStarred.objects.filter(
            organization=self.org,
            user_id=self.user.id,
            starred=True,
        ).update(starred=False, position=None)

        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        model_a = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Query A",
            query=query,
            last_visited=before_now(minutes=30),
        )
        ExploreSavedQueryLastVisited.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model_a,
            last_visited=before_now(minutes=30),
        )
        model_a.set_projects(self.project_ids)

        model_b = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Query B",
            query=query,
            last_visited=before_now(minutes=20),
        )
        ExploreSavedQueryLastVisited.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model_b,
            last_visited=before_now(minutes=20),
        )
        model_b.set_projects(self.project_ids)

        model_c = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Query C",
            query=query,
            last_visited=before_now(minutes=10),
        )
        ExploreSavedQueryLastVisited.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model_c,
            last_visited=before_now(minutes=10),
        )
        model_c.set_projects(self.project_ids)

        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model_a,
            position=1,
        )
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model_b,
            position=2,
        )

        model_d = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Query D",
            query=query,
            last_visited=before_now(minutes=15),
        )
        ExploreSavedQueryLastVisited.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model_d,
            last_visited=before_now(minutes=15),
        )
        model_d.set_projects(self.project_ids)
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id + 1,
            explore_saved_query=model_d,
            position=1,
        )
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id + 2,
            explore_saved_query=model_d,
            position=1,
        )

        with self.feature(self.features):
            response = self.client.get(self.url, data={"sortBy": ["starred", "recentlyViewed"]})

        assert response.status_code == 200, response.content
        assert len(response.data) == 9
        assert response.data[0]["name"] == "Query B"
        assert response.data[0]["starred"] is True
        assert response.data[0]["position"] == 2
        assert response.data[1]["name"] == "Query A"
        assert response.data[1]["starred"] is True
        assert response.data[1]["position"] == 1
        assert response.data[2]["name"] == "Test query"
        assert response.data[2]["starred"] is False
        assert response.data[2]["position"] is None
        assert response.data[3]["name"] == "Query C"
        assert response.data[3]["starred"] is False
        assert response.data[3]["position"] is None
        assert response.data[4]["name"] == "Query D"
        assert (
            response.data[4]["starred"] is False
        )  # This should be false because this query is starred by a different user
        assert response.data[4]["position"] is None

    def test_post_require_mode(self) -> None:
        with self.feature(self.features):
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

    def test_post_success(self) -> None:
        with self.feature(self.features):
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
                "caseInsensitive": False,
                "fields": ["span.op", "count(span.duration)"],
                "mode": "samples",
                "query": "span.op:pageload",
            }
        ]
        assert data["projects"] == self.project_ids
        assert data["dataset"] == "spans"

    def test_post_all_projects(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "New query",
                    "projects": [-1],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                        }
                    ],
                },
            )
        assert response.status_code == 201, response.content
        assert response.data["projects"] == [-1]

    def test_save_with_project(self) -> None:
        with self.feature(self.features):
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

    def test_save_with_project_and_my_projects(self) -> None:
        team = self.create_team(organization=self.org, members=[self.user])
        project = self.create_project(organization=self.org, teams=[team])
        with self.feature(self.features):
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

    def test_save_with_org_projects(self) -> None:
        project = self.create_project(organization=self.org)
        with self.feature(self.features):
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

    def test_save_with_team_project(self) -> None:
        team = self.create_team(organization=self.org, members=[self.user])
        project = self.create_project(organization=self.org, teams=[team])
        self.create_project(organization=self.org, teams=[team])
        with self.feature(self.features):
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

    def test_save_without_team(self) -> None:
        team = self.create_team(organization=self.org, members=[])
        self.create_project(organization=self.org, teams=[team])
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "without team query",
                    "projects": [],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                        }
                    ],
                },
            )

        assert response.status_code == 400
        assert "No Projects found, join a Team" == response.data["detail"]

    def test_save_with_team_and_without_project(self) -> None:
        team = self.create_team(organization=self.org, members=[self.user])
        self.create_project(organization=self.org, teams=[team])
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "with team query",
                    "projects": [],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                        }
                    ],
                },
            )

        assert response.status_code == 201, response.content
        assert ExploreSavedQuery.objects.filter(name="with team query").exists()

    def test_save_with_wrong_projects(self) -> None:
        other_org = self.create_organization(owner=self.user)
        project = self.create_project(organization=other_org)
        project2 = self.create_project(organization=self.org)
        with self.feature(self.features):
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

        with self.feature(self.features):
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

    def test_save_interval(self) -> None:
        with self.feature(self.features):
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

    def test_save_invalid_interval(self) -> None:
        with self.feature(self.features):
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

    def test_save_without_chart_type(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Query",
                    "projects": [-1],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "query": "spaceAfterColon:1",
                            "visualize": [
                                {
                                    "yAxes": ["count(span.duration)"],
                                },
                            ],
                        }
                    ],
                    "interval": "1m",
                },
            )
        assert response.status_code == 201, response.content
        assert len(response.data["query"]) == 1
        assert response.data["query"][0]["visualize"] == [
            {"yAxes": ["count(span.duration)"]},
        ]

    def test_save_aggregate_field_and_orderby(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Query",
                    "projects": [-1],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "aggregateField": [
                                {
                                    "groupBy": "span.op",
                                },
                                {
                                    "yAxes": ["count(span.duration)"],
                                },
                                {
                                    "yAxes": ["avg(span.duration)"],
                                    "chartType": 0,
                                },
                            ],
                            "aggregateOrderby": "-avg(span.duration)",
                        }
                    ],
                    "interval": "1m",
                },
            )
        assert response.status_code == 201, response.content
        assert len(response.data["query"]) == 1
        assert "visualize" not in response.data["query"][0]
        assert "groupby" not in response.data["query"][0]
        assert response.data["query"][0]["aggregateField"] == [
            {
                "groupBy": "span.op",
            },
            {
                "yAxes": ["count(span.duration)"],
            },
            {
                "yAxes": ["avg(span.duration)"],
                "chartType": 0,
            },
        ]
        assert response.data["query"][0]["aggregateOrderby"] == "-avg(span.duration)"

    def test_save_invalid_ambiguous_aggregate_field(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Query",
                    "projects": [-1],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "aggregateField": [
                                {
                                    "groupBy": "span.op",
                                    "yAxes": ["count(span.duration)"],
                                    "chartType": 0,
                                },
                            ],
                        }
                    ],
                    "interval": "1m",
                },
            )
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": ErrorDetail(
                "Ambiguous aggregate field. Must specify groupBy or yAxes, not both.",
                code="parse_error",
            ),
        }

    def test_save_invalid_aggregate_field(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Query",
                    "projects": [-1],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "aggregateField": [{}],
                        }
                    ],
                    "interval": "1m",
                },
            )
        assert response.status_code == 400, response.content
        assert response.data == {
            "query": {
                "aggregateField": {
                    "yAxes": [
                        ErrorDetail(
                            "This field is required.",
                            code="required",
                        ),
                    ],
                    "groupBy": [
                        ErrorDetail(
                            "This field is required.",
                            code="required",
                        ),
                    ],
                },
            },
        }

    def test_save_invalid_aggregate_field_bad_y_axes(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Query",
                    "projects": [-1],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "aggregateField": [
                                {
                                    "yAxes": "foobar",
                                },
                            ],
                        }
                    ],
                    "interval": "1m",
                },
            )
        assert response.status_code == 400, response.content
        assert response.data == {
            "query": {
                "aggregateField": {
                    "yAxes": [
                        ErrorDetail(
                            'Expected a list of items but got type "str".',
                            code="not_a_list",
                        ),
                    ],
                },
            },
        }

    def test_save_invalid_aggregate_field_bad_group_by(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Query",
                    "projects": [-1],
                    "range": "24h",
                    "query": [
                        {
                            "fields": ["span.op", "count(span.duration)"],
                            "mode": "samples",
                            "aggregateField": [
                                {
                                    "groupBy": [123],
                                },
                            ],
                        }
                    ],
                    "interval": "1m",
                },
            )
        assert response.status_code == 400, response.content
        assert response.data == {
            "query": {
                "aggregateField": {
                    "groupBy": [
                        ErrorDetail(
                            "Not a valid string.",
                            code="invalid",
                        ),
                    ],
                },
            },
        }

    def test_get_with_migration_feature_flag(self) -> None:
        self.features_with_migration = {"organizations:expose-migrated-discover-queries": True}
        self.features_with_migration.update(self.features)
        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            date_added=before_now(),
            # sort by name so it shows up last
            name="Z - Segment span query",
            query={"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]},
            dataset=ExploreSavedQueryDataset.SEGMENT_SPANS,
        )

        ExploreSavedQueryLastVisited.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=model,
            last_visited=before_now(),
        )

        with self.feature(self.features_with_migration):
            response_with_flag = self.client.get(self.url, data={"sortBy": ["name"]})

        assert response_with_flag.status_code == 200, response_with_flag.content
        assert len(response_with_flag.data) == 6

        assert response_with_flag.data[5]["name"] == "Z - Segment span query"
        assert response_with_flag.data[5]["dataset"] == "segment_spans"

        with self.feature(self.features):
            response_without_flag = self.client.get(self.url)

        assert response_without_flag.status_code == 200, response_without_flag.content
        assert len(response_without_flag.data) == 5

    def test_post_metrics_dataset_with_metric_field(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Metrics query with metric field",
                    "projects": self.project_ids,
                    "dataset": "metrics",
                    "query": [
                        {
                            "fields": ["count()"],
                            "mode": "aggregate",
                            "metric": {
                                "name": "sentry.alert_endpoint.executed",
                                "type": "counter",
                            },
                        }
                    ],
                    "range": "24h",
                },
            )
        assert response.status_code == 201, response.content
        data = response.data
        assert data["dataset"] == "metrics"
        assert data["query"] == [
            {
                "caseInsensitive": False,
                "fields": ["count()"],
                "mode": "aggregate",
                "metric": {
                    "name": "sentry.alert_endpoint.executed",
                    "type": "counter",
                },
            }
        ]

    def test_post_metrics_dataset_with_metric_field_and_unit(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Metrics query with unit",
                    "projects": self.project_ids,
                    "dataset": "metrics",
                    "query": [
                        {
                            "fields": ["avg()"],
                            "mode": "aggregate",
                            "metric": {
                                "name": "sentry.response_time",
                                "type": "gauge",
                                "unit": "millisecond",
                            },
                        }
                    ],
                    "range": "1h",
                },
            )
        assert response.status_code == 201, response.content
        data = response.data
        assert data["dataset"] == "metrics"
        assert data["query"] == [
            {
                "caseInsensitive": False,
                "fields": ["avg()"],
                "mode": "aggregate",
                "metric": {
                    "name": "sentry.response_time",
                    "type": "gauge",
                    "unit": "millisecond",
                },
            }
        ]

    def test_get_metrics_dataset_with_metric_field(self) -> None:
        query = {
            "range": "24h",
            "query": [
                {
                    "fields": ["count()"],
                    "mode": "aggregate",
                    "metric": {
                        "name": "sentry.alert_endpoint.executed",
                        "type": "counter",
                    },
                }
            ],
        }

        model = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test metrics query",
            query=query,
            dataset=ExploreSavedQueryDataset.METRICS,
        )
        model.set_projects(self.project_ids)

        with self.feature(self.features):
            response = self.client.get(self.url)

        assert response.status_code == 200, response.content

        test_query = None
        for item in response.data:
            if item["name"] == "Test metrics query":
                test_query = item
                break

        assert test_query is not None
        assert test_query["dataset"] == "metrics"
        assert test_query["query"][0]["metric"] == {
            "name": "sentry.alert_endpoint.executed",
            "type": "counter",
        }

    def test_post_non_metrics_dataset_rejects_metric_field(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Spans query with invalid metric",
                    "projects": self.project_ids,
                    "dataset": "spans",
                    "query": [
                        {
                            "fields": ["span.op"],
                            "mode": "samples",
                            "metric": {
                                "name": "sentry.alert_endpoint.executed",
                                "type": "counter",
                            },
                        }
                    ],
                    "range": "24h",
                },
            )
        assert response.status_code == 400, response.content
        assert "Metric field is only allowed for metrics dataset" in str(response.data)

    def test_post_metrics_dataset_requires_metric_field(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Metrics query without metric field",
                    "projects": self.project_ids,
                    "dataset": "metrics",
                    "query": [
                        {
                            "fields": ["span.op"],
                            "mode": "samples",
                        }
                    ],
                    "range": "24h",
                },
            )
        assert response.status_code == 400, response.content
        assert "Metric field is required for metrics dataset" in str(response.data)

    def test_save_with_start_and_end_time(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Start and end time query",
                    "projects": self.project_ids,
                    "dataset": "spans",
                    "start": "2025-11-12T23:00:00.000Z",
                    "end": "2025-11-20T22:59:59.000Z",
                },
            )
        assert response.status_code == 201, response.content
        data = response.data
        assert data["start"] is not None
        assert data["end"] is not None

    def test_save_with_case_insensitive(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Case insensitive query",
                    "projects": self.project_ids,
                    "dataset": "spans",
                    "query": [
                        {
                            "fields": ["span.op"],
                            "mode": "samples",
                            "caseInsensitive": 1,
                        }
                    ],
                    "range": "24h",
                },
            )
        assert response.status_code == 201, response.content
        data = response.data
        assert data["query"][0]["caseInsensitive"] is True

    def test_save_replay_query(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                {
                    "name": "Replay dataset",
                    "projects": self.project_ids,
                    "dataset": "replays",
                    "query": [
                        {
                            "query": "user.email:*@sentry.io",
                        }
                    ],
                    "range": "48h",
                },
            )
        assert response.status_code == 201, response.content
        data = response.data
        assert data["query"]["query"] == "user.email:*@sentry.io"
