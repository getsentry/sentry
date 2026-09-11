import pytest
from django.urls import reverse

from sentry.discover.models import (
    DiscoverSavedQuery,
    DiscoverSavedQueryLastVisited,
    DiscoverSavedQueryStarred,
)
from sentry.explore.endpoints.explore_saved_queries import (
    PREBUILT_SAVED_QUERIES,
    sync_prebuilt_queries,
    sync_prebuilt_queries_starred,
)
from sentry.explore.models import (
    ExploreSavedQuery,
    ExploreSavedQueryDataset,
    ExploreSavedQueryLastVisited,
    ExploreSavedQueryStarred,
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

        discover_model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="My discover query",
            query=self.discover_query_body,
            version=1,
        )
        discover_model.set_projects(self.project_ids)
        # date_created/date_updated are auto_now_add/auto_now, so they can only be
        # backdated with an UPDATE.
        DiscoverSavedQuery.objects.filter(id=discover_model.id).update(
            date_created=before_now(minutes=20), date_updated=before_now(minutes=20)
        )

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

            key = sorting.strip("-")
            # The two serializers disagree on the name of the creation
            # timestamp: Explore emits dateAdded, Discover emits dateCreated.
            values = [
                row["dateCreated"] if key == "dateAdded" and "dateAdded" not in row else row[key]
                for row in response.data
            ]
            assert len(values) == len(response.data)
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

        # Most-visited of all, and on the Discover side, so the top of the list
        # has to come from the other table.
        discover_model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="My discover query",
            query=self.discover_query_body,
            version=1,
            visits=4,
        )
        discover_model.set_projects(self.project_ids)

        for forward_sort in [True, False]:
            sorting = "mostPopular" if forward_sort else "-mostPopular"
            with self.feature(self.features):
                response = self.client.get(self.url, data={"sortBy": sorting})

            assert response.status_code == 200
            values = [row["name"] for row in response.data]
            expected = ["My discover query", "My query", "Test query"]

            if forward_sort:
                assert values[:3] == expected
            else:
                assert values[-3:] == list(reversed(expected))

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

            # Test query was visited most recently, then My query, then the
            # Discover query from setUp -- last visited spans both sources.
            if forward_sort:
                assert values[:3] == ["Test query", "My query", "Discover query"]
            else:
                assert values[:3] == ["Discover query", "My query", "Test query"]

            # Never-visited rows sort last in either direction.
            assert values[-1] in {q["name"] for q in PREBUILT_SAVED_QUERIES}

    def test_get_sortby_recently_viewed_stable_order(self) -> None:
        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        same_date = before_now(minutes=1)
        created = [
            ExploreSavedQuery.objects.create(
                organization=self.org,
                created_by_id=self.user.id,
                name=f"Unvisited {i}",
                query=query,
                date_added=same_date,
                date_updated=same_date,
            )
            for i in range(3)
        ]

        with self.feature(self.features):
            response = self.client.get(self.url, data={"sortBy": "recentlyViewed"})

        assert response.status_code == 200, response.content
        expected = [q.name for q in sorted(created, key=lambda q: q.id, reverse=True)]
        returned = [row["name"] for row in response.data if row["name"].startswith("Unvisited ")]
        assert returned == expected

    def test_get_sortby_recently_viewed_nulls_last_in_both_directions(self) -> None:
        """Never-visited rows sort after every visited row, ascending or descending.

        The union's ORDER BY carries a NULLS LAST modifier, so this is the property
        that breaks first if that modifier is dropped or the annotation stops being
        projected into the combined select list.
        """
        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        second_explore = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Visited explore query",
            query=query,
            date_added=before_now(minutes=10),
            date_updated=before_now(minutes=10),
        )
        second_explore.set_projects(self.project_ids)
        ExploreSavedQueryLastVisited.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query=second_explore,
            last_visited=before_now(minutes=15),
        )

        # "Test query" and "Discover query" are visited in setUp, one per source.
        visited = {"Test query", "Discover query", "Visited explore query"}

        for sorting in ["recentlyViewed", "-recentlyViewed"]:
            with self.feature(self.features):
                response = self.client.get(self.url, data={"sortBy": sorting})

            assert response.status_code == 200, response.content
            names = [row["name"] for row in response.data]

            visited_positions = [idx for idx, name in enumerate(names) if name in visited]
            unvisited_positions = [idx for idx, name in enumerate(names) if name not in visited]

            assert len(visited_positions) == len(visited), names
            assert unvisited_positions, names
            assert max(visited_positions) < min(unvisited_positions), (sorting, names)

    def test_get_sortby_recently_viewed_orders_visited_rows_across_sources(self) -> None:
        """Ascending and descending are exact mirrors of each other."""
        with self.feature(self.features):
            forward = self.client.get(self.url, data={"sortBy": "recentlyViewed"})
        with self.feature(self.features):
            backward = self.client.get(self.url, data={"sortBy": "-recentlyViewed"})

        assert forward.status_code == 200, forward.content
        assert backward.status_code == 200, backward.content

        visited = {"Test query", "Discover query"}
        forward_visited = [row["name"] for row in forward.data if row["name"] in visited]
        backward_visited = [row["name"] for row in backward.data if row["name"] in visited]

        assert forward_visited == ["Test query", "Discover query"]
        assert backward_visited == list(reversed(forward_visited))

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
        # The caller's own queries come first, from both sources.
        assert response.data[0]["createdBy"]["id"] == str(self.user.id)
        assert response.data[1]["createdBy"]["id"] == str(self.user.id)
        assert {response.data[0]["queryType"], response.data[1]["queryType"]} == {
            "discover",
            "explore",
        }
        assert response.data[2]["createdBy"]["id"] == str(uhoh_user.id)
        assert response.data[3]["createdBy"]["id"] == str(whoops_user.id)

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
        assert len(response.data) == 2
        assert [row["name"] for row in response.data] == ["Discover query", "Test query"]
        assert [row["queryType"] for row in response.data] == ["discover", "explore"]

    def test_get_shared_queries(self) -> None:
        query = {"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]}
        # Created first, so it is oldest by dateAdded.
        discover_model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id + 1,
            name="Shared discover query",
            query=self.discover_query_body,
            version=1,
        )
        discover_model.set_projects(self.project_ids)

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
        # Both shared queries, plus the prebuilts, which have no creator.
        assert len(response.data) == 7
        assert response.data[0]["name"] == "Shared discover query"
        assert response.data[1]["name"] == "Shared query"
        names = {row["name"] for row in response.data}
        assert "Test query" not in names
        assert "Discover query" not in names

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
        DiscoverSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            discover_saved_query=self.discover_query,
            position=1,
        )

        with self.feature(self.features):
            response = self.client.get(self.url, data={"starred": "1"})
        assert response.status_code == 200, response.content
        # Five auto-starred prebuilts plus the starred Discover query.
        assert len(response.data) == 6

        # Unstars prebuilt queries
        ExploreSavedQueryStarred.objects.filter(
            organization=self.org,
            user_id=self.user.id,
            starred=True,
        ).update(starred=False)

        with self.feature(self.features):
            response = self.client.get(self.url, data={"starred": "1"})
        assert response.status_code == 200, response.content
        # Unstarring the Explore side leaves the Discover star untouched.
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Discover query"
        assert response.data[0]["queryType"] == "discover"

        DiscoverSavedQueryStarred.objects.filter(
            organization=self.org, user_id=self.user.id
        ).update(starred=False)

        with self.feature(self.features):
            response = self.client.get(self.url, data={"starred": "1"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_get_hides_queries_when_no_project_access(self) -> None:
        # Disable Open Membership so project-level access actually applies.
        self.org.flags.allow_joinleave = False
        self.org.save()

        # The "Test query" created in setUp is scoped to self.projects, which the outsider
        # will not have access to. Add one query scoped to a project the outsider DOES
        # have access to via a team — only this one should appear.
        accessible_team = self.create_team(organization=self.org)
        accessible_project = self.create_project(organization=self.org, teams=[accessible_team])
        accessible_query = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Accessible query",
            query={"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]},
        )
        accessible_query.set_projects([accessible_project.id])

        # And a "no projects" query authored by the owner — outsider must not see it.
        ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Owner all-projects query",
            query={"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]},
        )

        # The same rule has to hold on the Discover side of the union.
        accessible_discover = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Accessible discover query",
            query=self.discover_query_body,
            version=1,
        )
        accessible_discover.set_projects([accessible_project.id])

        outsider = self.create_user()
        self.create_member(
            user=outsider, organization=self.org, role="member", teams=[accessible_team]
        )
        self.login_as(outsider)

        with self.feature(self.features):
            response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        names = {item["name"] for item in response.data}
        assert "Accessible query" in names
        assert "Accessible discover query" in names
        assert "Test query" not in names
        assert "Owner all-projects query" not in names
        # Scoped to setUp's projects, which the outsider has no access to.
        assert "Discover query" not in names
        # Prebuilt queries are product-level content and must remain visible to any org member.
        prebuilt_names = {q["name"] for q in PREBUILT_SAVED_QUERIES}
        assert prebuilt_names.issubset(names)

    def test_get_prebuilt_visible_even_with_inaccessible_project(self) -> None:
        # Prebuilts normally have no projects, but the queryset filter must mirror
        # `has_object_permission`, which exempts prebuilts before any project check.
        # Pin that contract: even a prebuilt that has somehow been linked to an
        # inaccessible project must remain visible to a closed-membership member.
        self.org.flags.allow_joinleave = False
        self.org.save()

        restricted_team = self.create_team(organization=self.org, members=[])
        restricted_project = self.create_project(organization=self.org, teams=[restricted_team])

        # `prebuilt_id` / `prebuilt_version` must match the first entry of
        # `PREBUILT_SAVED_QUERIES` so `sync_prebuilt_queries` doesn't update or delete
        # the row from under us when the list endpoint runs.
        prebuilt = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=None,
            name="Edge-case prebuilt",
            query={"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]},
            prebuilt_id=1,
            prebuilt_version=1,
        )
        prebuilt.set_projects([restricted_project.id])

        outsider = self.create_user()
        self.create_member(user=outsider, organization=self.org, role="member", teams=[])
        self.login_as(outsider)

        with self.feature(self.features):
            response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        names = {item["name"] for item in response.data}
        assert "Edge-case prebuilt" in names

    def test_get_shows_unprojected_query_to_creator_only(self) -> None:
        self.org.flags.allow_joinleave = False
        self.org.save()

        # Owner-authored "no projects" query that members shouldn't see.
        ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Owner all-projects query",
            query={"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]},
        )

        outsider = self.create_user()
        team = self.create_team(organization=self.org)
        self.create_member(user=outsider, organization=self.org, role="member", teams=[team])

        # Outsider's own "no projects" query — they should still see it as the creator.
        own_query = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=outsider.id,
            name="Outsider all-projects query",
            query={"range": "24h", "query": [{"fields": ["span.op"], "mode": "samples"}]},
        )

        self.login_as(outsider)
        with self.feature(self.features):
            response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        names = {item["name"] for item in response.data}
        assert "Outsider all-projects query" in names
        assert "Owner all-projects query" not in names
        assert "Test query" not in names
        assert str(own_query.id) in {item["id"] for item in response.data}

    def test_sync_prebuilt_starred_alphabetical_for_new_user(self) -> None:
        sync_prebuilt_queries(self.org)
        sync_prebuilt_queries_starred(self.org, self.user)

        starred = list(
            ExploreSavedQueryStarred.objects.filter(
                organization=self.org, user_id=self.user.id, starred=True
            )
            .order_by("position")
            .select_related("explore_saved_query")
        )

        expected_names = sorted(
            ExploreSavedQuery.objects.filter(
                organization=self.org, prebuilt_id__isnull=False
            ).values_list("name", flat=True)
        )
        assert [s.explore_saved_query.name for s in starred] == expected_names
        assert [s.position for s in starred] == list(range(1, len(expected_names) + 1))

    def test_sync_prebuilt_starred_inserts_new_prebuilt_alphabetically_for_existing_user(
        self,
    ) -> None:
        # Seed all prebuilts as if the user had synced previously.
        sync_prebuilt_queries(self.org)
        sync_prebuilt_queries_starred(self.org, self.user)

        # Simulate a "new prebuilt added later" by removing the starred record for
        # one prebuilt that lives alphabetically in the middle of the list, then
        # compacting the remaining positions.
        sorted_names = sorted(
            ExploreSavedQuery.objects.filter(
                organization=self.org, prebuilt_id__isnull=False
            ).values_list("name", flat=True)
        )
        middle_index = len(sorted_names) // 2
        middle_name = sorted_names[middle_index]
        middle_query = ExploreSavedQuery.objects.get(organization=self.org, name=middle_name)
        ExploreSavedQueryStarred.objects.filter(
            organization=self.org, user_id=self.user.id, explore_saved_query=middle_query
        ).delete()
        for idx, row in enumerate(
            ExploreSavedQueryStarred.objects.filter(
                organization=self.org, user_id=self.user.id
            ).order_by("position"),
            start=1,
        ):
            row.position = idx
            row.save()

        sync_prebuilt_queries_starred(self.org, self.user)

        starred = list(
            ExploreSavedQueryStarred.objects.filter(
                organization=self.org, user_id=self.user.id, starred=True
            )
            .order_by("position")
            .select_related("explore_saved_query")
        )

        # User has not customized order, so the new prebuilt is inserted at its
        # alphabetical position rather than appended at the end.
        assert [s.explore_saved_query.name for s in starred] == sorted_names
        assert [s.position for s in starred] == list(range(1, len(sorted_names) + 1))
        assert starred[middle_index].explore_saved_query.name == middle_name

    def test_sync_prebuilt_starred_preserves_user_custom_order(self) -> None:
        sync_prebuilt_queries(self.org)
        sync_prebuilt_queries_starred(self.org, self.user)

        original_ids = list(
            ExploreSavedQueryStarred.objects.filter(organization=self.org, user_id=self.user.id)
            .order_by("position")
            .values_list("explore_saved_query_id", flat=True)
        )
        reversed_ids = list(reversed(original_ids))
        ExploreSavedQueryStarred.objects.reorder_starred_queries(
            self.org, self.user.id, reversed_ids
        )

        sync_prebuilt_queries_starred(self.org, self.user)

        after_ids = list(
            ExploreSavedQueryStarred.objects.filter(organization=self.org, user_id=self.user.id)
            .order_by("position")
            .values_list("explore_saved_query_id", flat=True)
        )
        assert after_ids == reversed_ids

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

        discover_starred = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Starred discover query",
            query=self.discover_query_body,
            version=1,
        )
        discover_starred.set_projects(self.project_ids)
        DiscoverSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            discover_saved_query=discover_starred,
            position=6,
        )

        with self.feature(self.features):
            response = self.client.get(self.url, data={"starred": "1"})
        assert response.status_code == 200, response.content
        # Five prebuilts, Starred query A and the Discover query. Starred query B
        # is starred by a different user, so it is not in the caller's list.
        assert len(response.data) == 7
        names = {row["name"] for row in response.data}
        assert "Starred query B" not in names

        by_name = {row["name"]: row for row in response.data}
        assert by_name["Starred query A"]["starred"] is True
        assert by_name["Starred query A"]["position"] == 1
        assert by_name["Starred query A"]["queryType"] == "explore"
        assert by_name["Starred discover query"]["starred"] is True
        assert by_name["Starred discover query"]["position"] == 6
        assert by_name["Starred discover query"]["queryType"] == "discover"

        # starred=1 orders by the caller's position across both sources.
        positions = [row["position"] for row in response.data if row["position"] is not None]
        assert positions == sorted(positions)

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

        # Add some discover objects
        discover_model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Most starred discover query",
            query=self.discover_query_body,
            version=1,
        )
        discover_model.set_projects(self.project_ids)
        for offset, position in enumerate([3, 1, 1, 1]):
            DiscoverSavedQueryStarred.objects.create(
                organization=self.org,
                user_id=self.user.id + offset,
                discover_saved_query=discover_model,
                position=position,
            )

        with self.feature(self.features):
            response = self.client.get(self.url, data={"sortBy": "mostStarred"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 10
        assert response.data[0]["name"] == "Most starred discover query"
        assert response.data[0]["queryType"] == "discover"
        assert response.data[0]["starred"] is True
        assert response.data[0]["position"] == 3
        assert response.data[1]["name"] == "Most starred query"
        assert response.data[1]["starred"] is True
        assert response.data[1]["position"] == 1
        assert response.data[2]["name"] == "Second most starred query"
        assert response.data[2]["starred"] is True
        assert response.data[2]["position"] == 2
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
        assert len(response.data) == 11
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
        # setUp's Discover query was visited longest ago, so it closes out the
        # visited group before the never-visited prebuilts.
        assert response.data[5]["name"] == "Discover query"
        assert response.data[5]["queryType"] == "discover"
        assert response.data[5]["starred"] is False

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
        assert len(response_with_flag.data) == 8

        assert response_with_flag.data[7]["name"] == "Z - Segment span query"
        assert response_with_flag.data[7]["dataset"] == "segment_spans"

        with self.feature(self.features):
            response_without_flag = self.client.get(self.url)

        assert response_without_flag.status_code == 200, response_without_flag.content
        assert len(response_without_flag.data) == 7

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

    def test_malformed_query_missing_query_field_in_get(self) -> None:
        """VULN-950: A saved query with no 'query' content returns a response
        missing the 'query' key, which crashes the frontend All Queries page."""
        malformed = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="malformed",
            query={"range": "24h"},
        )
        malformed.set_projects(self.project_ids)

        with self.feature(self.features):
            url = reverse(
                "sentry-api-0-explore-saved-query-detail",
                args=[self.org.slug, malformed.id],
            )
            response = self.client.get(url)

        assert response.status_code == 200
        # The response is missing the 'query' key entirely — this is what
        # crashes the frontend, which expects it to be an array.
        assert "query" not in response.data
