from django.urls import reverse

from sentry.discover.models import DiscoverSavedQuery
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class DiscoverSavedQueryBase(APITestCase, SnubaTestCase):
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
        query = {"fields": ["test"], "conditions": [], "limit": 10}

        model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test query",
            query=query,
            version=1,
        )

        model.set_projects(self.project_ids)


class DiscoverSavedQueriesTest(DiscoverSavedQueryBase):
    feature_name = "organizations:discover"

    def setUp(self):
        super().setUp()
        self.url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])

    def test_get(self):
        with self.feature(self.feature_name):
            response = self.client.get(self.url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Test query"
        assert response.data[0]["projects"] == self.project_ids
        assert response.data[0]["fields"] == ["test"]
        assert response.data[0]["conditions"] == []
        assert response.data[0]["limit"] == 10
        assert response.data[0]["version"] == 1
        assert "createdBy" in response.data[0]
        assert response.data[0]["createdBy"]["username"] == self.user.username
        assert not response.data[0]["expired"]

    def test_get_version_filter(self):
        with self.feature(self.feature_name):
            response = self.client.get(self.url, format="json", data={"query": "version:1"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Test query"

        with self.feature(self.feature_name):
            response = self.client.get(self.url, format="json", data={"query": "version:2"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

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
            query = {"fields": ["test"], "conditions": [], "limit": 10}
            model = DiscoverSavedQuery.objects.create(
                organization=self.org,
                created_by_id=self.user.id,
                name=f"My query {i}",
                query=query,
                version=1,
            )
            model.set_projects(self.project_ids)

        with self.feature(self.feature_name):
            response = self.client.get(self.url, data={"per_page": 1})
        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        with self.feature(self.feature_name):
            # The all parameter ignores pagination and returns all values.
            response = self.client.get(self.url, data={"per_page": 1, "all": 1})
        assert response.status_code == 200, response.content
        assert len(response.data) == 11

    def test_get_sortby(self):
        query = {"fields": ["message"], "query": "", "limit": 10}
        model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="My query",
            query=query,
            version=2,
            date_created=before_now(minutes=10),
            date_updated=before_now(minutes=10),
        )
        model.set_projects(self.project_ids)

        sort_options = {
            "dateCreated": True,
            "-dateCreated": False,
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
        query = {"fields": ["message"], "query": "", "limit": 10}
        model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="My query",
            query=query,
            version=2,
            visits=3,
            date_created=before_now(minutes=10),
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
        query = {"fields": ["message"], "query": "", "limit": 10}
        model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="My query",
            query=query,
            version=2,
            visits=3,
            date_created=before_now(minutes=10),
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

        query = {"fields": ["message"], "query": "", "limit": 10}
        model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=uhoh_user.id,
            name="a query for uhoh",
            query=query,
            version=2,
            date_created=before_now(minutes=10),
            date_updated=before_now(minutes=10),
        )
        model.set_projects(self.project_ids)

        model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=whoops_user.id,
            name="a query for whoops",
            query=query,
            version=2,
            date_created=before_now(minutes=10),
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
        DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="My expired query",
            query=query,
            version=2,
            date_created=before_now(days=90),
            date_updated=before_now(minutes=10),
        )
        with self.options({"system.event-retention-days": 60}), self.feature(self.feature_name):
            response = self.client.get(self.url, {"query": "name:My expired query"})

        assert response.status_code == 200, response.content
        assert response.data[0]["expired"]

    def test_get_ignores_homepage_queries(self):
        query = {"fields": ["test"], "conditions": [], "limit": 10}
        model = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Homepage Test Query",
            query=query,
            version=2,
            date_created=before_now(minutes=10),
            date_updated=before_now(minutes=10),
            is_homepage=True,
        )
        model.set_projects(self.project_ids)

        with self.feature(self.feature_name):
            response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert not any([query["name"] == "Homepage Test Query" for query in response.data])

    def test_post(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
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
        assert "start" not in response.data
        assert "end" not in response.data

    def test_post_invalid_projects(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
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
            response = self.client.post(
                self.url,
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
            response = self.client.post(
                self.url,
                {
                    "name": "New query",
                    "projects": self.project_ids,
                    "fields": ["id"],
                    "range": "24h",
                    "limit": 20,
                    "environment": ["dev"],
                    "yAxis": ["count(id)"],
                    "aggregations": [],
                    "orderby": "-time",
                },
            )
        assert response.status_code == 400, response.content
        assert (
            "You cannot use the environment, yAxis attribute(s) with the selected version"
            == response.data["non_field_errors"][0]
        )


class DiscoverSavedQueriesVersion2Test(DiscoverSavedQueryBase):
    feature_name = "organizations:discover-query"

    def setUp(self):
        super().setUp()
        self.url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])

    def test_post_invalid_conditions(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
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
        assert (
            "You cannot use the conditions attribute(s) with the selected version"
            == response.data["non_field_errors"][0]
        )

    def test_post_require_selected_fields(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "New query",
                    "projects": self.project_ids,
                    "fields": [],
                    "range": "24h",
                    "version": 2,
                },
            )
        assert response.status_code == 400, response.content
        assert "You must include at least one field." == response.data["non_field_errors"][0]

    def test_post_success(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "new query",
                    "projects": self.project_ids,
                    "fields": ["title", "count()", "project"],
                    "environment": ["dev"],
                    "query": "event.type:error browser.name:Firefox",
                    "range": "24h",
                    "yAxis": ["count(id)"],
                    "display": "releases",
                    "version": 2,
                },
            )
        assert response.status_code == 201, response.content
        data = response.data
        assert data["fields"] == ["title", "count()", "project"]
        assert data["range"] == "24h"
        assert data["environment"] == ["dev"]
        assert data["query"] == "event.type:error browser.name:Firefox"
        assert data["yAxis"] == ["count(id)"]
        assert data["display"] == "releases"
        assert data["version"] == 2

    def test_post_all_projects(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
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

    def test_save_with_project(self):
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "project query",
                    "projects": self.project_ids,
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "query": f"project:{self.projects[0].slug}",
                    "version": 2,
                },
            )
        assert response.status_code == 201, response.content
        assert DiscoverSavedQuery.objects.filter(name="project query").exists()

    def test_save_with_project_and_my_projects(self):
        team = self.create_team(organization=self.org, members=[self.user])
        project = self.create_project(organization=self.org, teams=[team])
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "project query",
                    "projects": [],
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "query": f"project:{project.slug}",
                    "version": 2,
                },
            )
        assert response.status_code == 201, response.content
        assert DiscoverSavedQuery.objects.filter(name="project query").exists()

    def test_save_with_org_projects(self):
        project = self.create_project(organization=self.org)
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "project query",
                    "projects": [project.id],
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "version": 2,
                },
            )
        assert response.status_code == 201, response.content
        assert DiscoverSavedQuery.objects.filter(name="project query").exists()

    def test_save_with_team_project(self):
        team = self.create_team(organization=self.org, members=[self.user])
        project = self.create_project(organization=self.org, teams=[team])
        self.create_project(organization=self.org, teams=[team])
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "project query",
                    "projects": [project.id],
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "version": 2,
                },
            )
        assert response.status_code == 201, response.content
        assert DiscoverSavedQuery.objects.filter(name="project query").exists()

    def test_save_without_team(self):
        team = self.create_team(organization=self.org, members=[])
        self.create_project(organization=self.org, teams=[team])
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "without team query",
                    "projects": [],
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "version": 2,
                },
            )

        assert response.status_code == 400
        assert "No Projects found, join a Team" == response.data["detail"]

    def test_save_with_team_and_without_project(self):
        team = self.create_team(organization=self.org, members=[self.user])
        self.create_project(organization=self.org, teams=[team])
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "with team query",
                    "projects": [],
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "version": 2,
                },
            )

        assert response.status_code == 201, response.content
        assert DiscoverSavedQuery.objects.filter(name="with team query").exists()

    def test_save_with_wrong_projects(self):
        other_org = self.create_organization(owner=self.user)
        project = self.create_project(organization=other_org)
        project2 = self.create_project(organization=self.org)
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "project query",
                    "projects": [project.id],
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "query": f"project:{project.slug}",
                    "version": 2,
                },
            )
        assert response.status_code == 403, response.content
        assert not DiscoverSavedQuery.objects.filter(name="project query").exists()

        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "project query",
                    "projects": [project.id, project2.id],
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "query": f"project:{project.slug} project:{project2.slug}",
                    "version": 2,
                },
            )
        assert response.status_code == 403, response.content
        assert not DiscoverSavedQuery.objects.filter(name="project query").exists()

        # Mix of wrong + valid
        with self.feature(self.feature_name):
            url = reverse("sentry-api-0-discover-saved-queries", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "name": "project query",
                    "projects": [-1],
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "query": f"project:{project.slug} project:{project2.slug}",
                    "version": 2,
                },
            )
        assert response.status_code == 400, response.content
        assert not DiscoverSavedQuery.objects.filter(name="project query").exists()

    def test_save_with_equation(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "Equation query",
                    "projects": [-1],
                    "fields": [
                        "title",
                        "equation|count_if(measurements.lcp,greater,4000) / count()",
                        "count()",
                        "count_if(measurements.lcp,greater,4000)",
                    ],
                    "orderby": "equation[0]",
                    "range": "24h",
                    "query": "title:1",
                    "version": 2,
                },
            )
        assert response.status_code == 201, response.content
        assert DiscoverSavedQuery.objects.filter(name="Equation query").exists()

    def test_save_with_invalid_equation(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "Equation query",
                    "projects": [-1],
                    "fields": [
                        "title",
                        "equation|count_if(measurements.lcp,greater,4000) / 0",
                        "count()",
                        "count_if(measurements.lcp,greater,4000)",
                    ],
                    "orderby": "equation[0]",
                    "range": "24h",
                    "query": "title:1",
                    "version": 2,
                },
            )
        assert response.status_code == 400, response.content
        assert not DiscoverSavedQuery.objects.filter(name="Equation query").exists()

    def test_save_invalid_query(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "Bad query",
                    "projects": [-1],
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "query": "spaceAfterColon: 1",
                    "version": 2,
                },
            )
        assert response.status_code == 400, response.content
        assert not DiscoverSavedQuery.objects.filter(name="Bad query").exists()

    def test_save_invalid_query_orderby(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "Bad query",
                    "projects": [-1],
                    "fields": ["title", "count()"],
                    "orderby": "fake()",
                    "range": "24h",
                    "query": "title:1",
                    "version": 2,
                },
            )
        assert response.status_code == 400, response.content
        assert not DiscoverSavedQuery.objects.filter(name="Bad query").exists()

    def test_save_interval(self):
        with self.feature(self.feature_name):
            response = self.client.post(
                self.url,
                {
                    "name": "Interval query",
                    "projects": [-1],
                    "fields": ["title", "count()"],
                    "statsPeriod": "24h",
                    "query": "spaceAfterColon:1",
                    "version": 2,
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
                    "fields": ["title", "count()"],
                    "range": "24h",
                    "query": "spaceAfterColon:1",
                    "version": 2,
                    "interval": "1s",
                },
            )
        assert response.status_code == 400, response.content
