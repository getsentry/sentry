from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.explore.models import ExploreSavedQueryDataset
from sentry.explore.translation.discover_translation import (
    translate_discover_query_to_explore_query,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now


class DiscoverToExploreTranslationTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.login_as(self.user)
        self.org = self.create_organization(owner=self.user)
        self.project1 = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)

        self.env = self.create_environment(project=self.project1)

        self.simple_query = {
            "query": "event.type:transaction",
            "range": "14d",
            "yAxis": ["count()"],
            "fields": ["id", "title", "timestamp"],
            "orderby": "-timestamp",
            "display": "default",
            "environment": [],
        }

        self.simple_saved_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Simple query",
            version=2,
            query=self.simple_query,
            date_created=before_now(minutes=10),
            date_updated=before_now(minutes=10),
            visits=1,
            last_visited=before_now(minutes=5),
            dataset=DiscoverSavedQueryTypes.TRANSACTION_LIKE,
        )
        self.simple_saved_query.set_projects([self.project1.id, self.project2.id])

    def test_translate_simmple_discover_to_explore_query(self):
        new_explore_query = translate_discover_query_to_explore_query(self.simple_saved_query)
        assert new_explore_query.organization == self.org
        assert new_explore_query.created_by_id == self.user.id
        assert new_explore_query.name == "Simple query"
        assert new_explore_query.dataset == ExploreSavedQueryDataset.SEGMENT_SPANS
        assert new_explore_query.is_multi_query is False
        assert new_explore_query.organization == self.org
        assert new_explore_query.created_by_id == self.user.id
        assert new_explore_query.name == "Simple query"

        base_query = new_explore_query.query
        assert base_query["environment"] == []
        assert base_query["range"] == "14d"

        query = base_query["query"][0]
        assert query["fields"] == ["id", "transaction", "timestamp"]
        assert query["query"] == "is_transaction:1"
        assert query["mode"] == "aggregate"
        assert query["aggregateField"] == [
            {"groupBy": "id"},
            {"groupBy": "transaction"},
            {"groupBy": "timestamp"},
            {"yAxes": ["count(span.duration)"], "chartType": 2},
        ]
        assert query["aggregateOrderby"] == "-timestamp"
        assert query["orderby"] is None
