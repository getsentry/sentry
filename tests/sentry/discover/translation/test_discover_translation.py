from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.explore.translation.discover_translation import (
    translate_discover_query_to_explore_query,
)
from sentry.testutils.cases import TestCase


class DiscoverExploreTranslationTest(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)
        self.environment = self.create_environment(organization=self.org, project=self.project)
        self.user = self.create_user(name="test user")
        self.login_as(self.user)

        self.simple_discover_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="simple discover query",
            dataset=DiscoverSavedQueryTypes.TRANSACTION_LIKE,
            query={
                "environment": [self.environment.name],
                "range": "1d",
                "fields": ["transaction", "count()"],
                "query": "",
                "orderby": "-count()",
                "yAxis": ["count()"],
                "display": "default",
            },
        )

        self.samples_discover_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="samples discover query",
            dataset=DiscoverSavedQueryTypes.TRANSACTION_LIKE,
            query={
                "environment": [self.environment.name],
                "range": "1d",
                "fields": ["transaction", "timestamp"],
                "query": "",
                "orderby": "-timestamp",
                "yAxis": ["count()"],
                "display": "default",
            },
        )

    def test_translate_discover_query_to_explore_query(self):
        new_explore_query = translate_discover_query_to_explore_query(self.simple_discover_query)

        assert new_explore_query.created_by_id == self.user.id
        assert new_explore_query.dataset == 101
        assert new_explore_query.organization == self.org
        assert new_explore_query.name == self.simple_discover_query.name
        assert new_explore_query.query["environment"] == [self.environment.name]
        assert new_explore_query.query["range"] == "1d"
        assert new_explore_query.query["query"][0]["query"] == "is_transaction:1"
        assert new_explore_query.query["query"][0]["fields"] == [
            "transaction",
            "count(span.duration)",
        ]
        assert new_explore_query.query["query"][0]["orderby"] == "-count(span.duration)"
        assert new_explore_query.query["query"][0]["groupby"] == ["transaction"]
        assert new_explore_query.query["query"][0]["mode"] == "aggregate"
        assert new_explore_query.query["query"][0]["visualize"][0]["chartType"] == "area"
        assert new_explore_query.query["query"][0]["visualize"][0]["yAxes"] == [
            "count(span.duration)"
        ]

    def test_translate_discover_query_to_explore_query_samples_mode(self):
        new_explore_query = translate_discover_query_to_explore_query(self.samples_discover_query)

        assert new_explore_query.created_by_id == self.user.id
        assert new_explore_query.dataset == 101
        assert new_explore_query.organization == self.org
        assert new_explore_query.name == self.samples_discover_query.name
        assert new_explore_query.query["environment"] == [self.environment.name]
        assert new_explore_query.query["range"] == "1d"
        assert new_explore_query.query["query"][0]["query"] == "is_transaction:1"
        assert new_explore_query.query["query"][0]["fields"] == ["transaction", "timestamp"]
        assert new_explore_query.query["query"][0]["orderby"] == "-timestamp"
        assert new_explore_query.query["query"][0]["groupby"] == []
        assert new_explore_query.query["query"][0]["mode"] == "samples"
        assert new_explore_query.query["query"][0]["visualize"][0]["chartType"] == "area"
        assert new_explore_query.query["query"][0]["visualize"][0]["yAxes"] == [
            "count(span.duration)"
        ]
