from django.urls import reverse

from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryStarred
from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryStarred
from sentry.testutils.cases import APITestCase


class SavedQueryStarredOrderTest(APITestCase):
    feature_flags = {
        "organizations:visibility-explore-view": True,
        "organizations:discover-queries-in-all-queries": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

        self.explore_a = self.create_explore_query("Explore A", position=1)
        self.discover_x = self.create_discover_query("Discover X", position=2)
        self.explore_b = self.create_explore_query("Explore B", position=3)
        self.discover_y = self.create_discover_query("Discover Y", position=4)

        self.url = reverse("sentry-api-0-saved-query-starred-order", args=[self.org.slug])

    def create_explore_query(self, name: str, position: int) -> ExploreSavedQuery:
        query = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name=name,
            query=[{"fields": ["span.op"], "mode": "samples"}],
        )
        ExploreSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            explore_saved_query_id=query.id,
            position=position,
            starred=True,
        )
        return query

    def create_discover_query(self, name: str, position: int) -> DiscoverSavedQuery:
        query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name=name,
            query={"fields": ["title"], "conditions": "", "limit": 10},
        )
        DiscoverSavedQueryStarred.objects.create(
            organization=self.org,
            user_id=self.user.id,
            discover_saved_query_id=query.id,
            position=position,
            starred=True,
        )
        return query

    def ref(self, query: DiscoverSavedQuery | ExploreSavedQuery) -> dict[str, object]:
        query_type = "discover" if isinstance(query, DiscoverSavedQuery) else "explore"
        return {"type": query_type, "id": query.id}

    def current_order(self) -> list[tuple[str, int]]:
        rows = [
            ("discover", row.discover_saved_query_id, row.position)
            for row in DiscoverSavedQueryStarred.objects.filter(
                organization=self.org, user_id=self.user.id, position__isnull=False
            )
        ] + [
            ("explore", row.explore_saved_query_id, row.position)
            for row in ExploreSavedQueryStarred.objects.filter(
                organization=self.org, user_id=self.user.id, position__isnull=False
            )
        ]
        return [
            (query_type, query_id)
            for query_type, query_id, _ in sorted(rows, key=lambda r: r[2] or 0)
        ]

    def test_moves_a_discover_query_above_an_explore_query(self) -> None:
        """The case a single-product reorder cannot express: X crossing A."""
        with self.feature(self.feature_flags):
            response = self.client.put(
                self.url,
                data={
                    "queries": [
                        self.ref(self.discover_x),
                        self.ref(self.explore_a),
                        self.ref(self.explore_b),
                        self.ref(self.discover_y),
                    ]
                },
            )

        assert response.status_code == 204
        assert self.current_order() == [
            ("discover", self.discover_x.id),
            ("explore", self.explore_a.id),
            ("explore", self.explore_b.id),
            ("discover", self.discover_y.id),
        ]

    def test_reverses_the_whole_list(self) -> None:
        with self.feature(self.feature_flags):
            response = self.client.put(
                self.url,
                data={
                    "queries": [
                        self.ref(self.discover_y),
                        self.ref(self.explore_b),
                        self.ref(self.discover_x),
                        self.ref(self.explore_a),
                    ]
                },
            )

        assert response.status_code == 204
        assert self.current_order() == [
            ("discover", self.discover_y.id),
            ("explore", self.explore_b.id),
            ("discover", self.discover_x.id),
            ("explore", self.explore_a.id),
        ]

    def test_rejects_a_partial_list(self) -> None:
        """A payload naming only one product cannot express the user's intent, so it errors."""
        with self.feature(self.feature_flags):
            response = self.client.put(
                self.url,
                data={"queries": [self.ref(self.discover_y), self.ref(self.discover_x)]},
            )

        assert response.status_code == 400
        assert self.current_order() == [
            ("explore", self.explore_a.id),
            ("discover", self.discover_x.id),
            ("explore", self.explore_b.id),
            ("discover", self.discover_y.id),
        ]

    def test_rejects_duplicate_refs(self) -> None:
        with self.feature(self.feature_flags):
            response = self.client.put(
                self.url,
                data={
                    "queries": [
                        self.ref(self.discover_x),
                        self.ref(self.discover_x),
                        self.ref(self.explore_a),
                        self.ref(self.explore_b),
                    ]
                },
            )

        assert response.status_code == 400

    def test_empty_list_is_a_noop_when_nothing_is_starred(self) -> None:
        DiscoverSavedQueryStarred.objects.all().delete()
        ExploreSavedQueryStarred.objects.all().delete()

        with self.feature(self.feature_flags):
            response = self.client.put(self.url, data={"queries": []})

        assert response.status_code == 204
