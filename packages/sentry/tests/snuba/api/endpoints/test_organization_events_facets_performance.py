from datetime import timedelta

from django.urls import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data


class BaseOrganizationEventsFacetsPerformanceEndpointTest(SnubaTestCase, APITestCase):
    feature_list = (
        "organizations:discover-basic",
        "organizations:global-views",
        "organizations:performance-view",
    )

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1).replace(microsecond=0)
        self.two_mins_ago = before_now(minutes=2).replace(microsecond=0)
        self.day_ago = before_now(days=1).replace(microsecond=0)

        self.login_as(user=self.user)
        self.project = self.create_project()
        self.project2 = self.create_project()

    def do_request(self, query=None, features=None):
        query = query if query is not None else {"aggregateColumn": "transaction.duration"}
        query["project"] = query["project"] if "project" in query else [self.project.id]

        feature_dict = {feature: True for feature in self.feature_list}
        feature_dict.update(features or {})
        with self.feature(feature_dict):
            return self.client.get(self.url, query, format="json")


class OrganizationEventsFacetsPerformanceEndpointTest(
    BaseOrganizationEventsFacetsPerformanceEndpointTest
):
    def setUp(self):
        super().setUp()

        self._transaction_count = 0

        for i in range(5):
            self.store_transaction(
                tags=[["color", "blue"], ["many", "yes"]], duration=4000, lcp=3000
            )
        for i in range(14):
            self.store_transaction(tags=[["color", "red"], ["many", "yes"]], duration=1000, lcp=500)
        for i in range(1):
            self.store_transaction(
                tags=[["color", "green"], ["many", "no"]], duration=5000, lcp=4000
            )

        self.url = reverse(
            "sentry-api-0-organization-events-facets-performance",
            kwargs={"organization_slug": self.project.organization.slug},
        )

    def store_transaction(
        self, name="exampleTransaction", duration=100, tags=None, project_id=None, lcp=None
    ):
        if tags is None:
            tags = []
        if project_id is None:
            project_id = self.project.id
        event = load_data("transaction").copy()
        event.data["tags"].extend(tags)
        event.update(
            {
                "transaction": name,
                "event_id": f"{self._transaction_count:02x}".rjust(32, "0"),
                "start_timestamp": iso_format(self.two_mins_ago - timedelta(seconds=duration)),
                "timestamp": iso_format(self.two_mins_ago),
            }
        )

        if lcp:
            event["measurements"]["lcp"]["value"] = lcp
        else:
            del event["measurements"]["lcp"]

        self._transaction_count += 1
        self.store_event(data=event, project_id=project_id)

    def test_basic_request(self):
        response = self.do_request()
        assert response.status_code == 200, response.content

        data = response.data["data"]
        assert len(data) == 2
        assert data[0] == {
            "aggregate": 4000000.0,
            "comparison": 2.051282051282051,
            "count": 5,
            "frequency": 0.25,
            "sumdelta": 10250000.0,
            "tags_key": "color",
            "tags_value": "blue",
        }

    def test_sort_frequency(self):
        # Descending
        response = self.do_request(
            {
                "aggregateColumn": "transaction.duration",
                "sort": "-frequency",
                "per_page": 20,
                "statsPeriod": "14d",
            }
        )
        assert response.status_code == 200, response.content

        data = response.data["data"]
        assert len(data) == 2

        # The first set of generated is the most frequent since the 14 transactions are excluded because of 1000 duration
        assert data[0]["count"] == 5
        assert data[0]["tags_key"] == "color"
        assert data[0]["tags_value"] == "blue"

        # The 14 transactions with many=yes are excluded because of 1000 duration
        assert data[1]["count"] == 1
        assert data[1]["tags_key"] == "many"
        assert data[1]["tags_value"] == "no"

        # Ascending
        response = self.do_request(
            {
                "aggregateColumn": "transaction.duration",
                "sort": "frequency",
                "per_page": 5,
                "statsPeriod": "14d",
            }
        )

        data = response.data["data"]
        assert len(data) == 2
        assert data[0]["count"] == 1
        assert data[0]["tags_key"] == "color"
        assert data[0]["tags_value"] == "green"

        assert data[1]["count"] == 1
        assert data[1]["tags_key"] == "many"
        assert data[1]["tags_value"] == "no"

    def test_basic_query(self):
        response = self.do_request(
            {
                "aggregateColumn": "transaction.duration",
                "sort": "-frequency",
                "per_page": 5,
                "statsPeriod": "14d",
                "query": "(color:red or color:blue)",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count"] == 5
        assert data[0]["tags_key"] == "color"
        assert data[0]["tags_value"] == "blue"

    def test_multiple_projects_not_allowed(self):
        response = self.do_request(
            {
                "aggregateColumn": "transaction.duration",
                "project": [self.project.id, self.project2.id],
            }
        )
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": "You cannot view facet performance for multiple projects."
        }

    def test_missing_tags_column(self):
        response = self.do_request({})
        assert response.status_code == 400, response.content
        assert response.data == {"detail": "'aggregateColumn' must be provided."}

    def test_invalid_tags_column(self):
        response = self.do_request({"aggregateColumn": "abc"})

        assert response.status_code == 400, response.content
        assert response.data == {"detail": "'abc' is not a supported tags column."}

    def test_all_tag_keys(self):
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "per_page": 5,
            "statsPeriod": "14d",
            "query": "(color:red or color:blue)",
            "allTagKeys": True,
        }

        # With feature access
        response = self.do_request(request)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 5
        assert data[0]["count"] == 19
        assert data[0]["tags_key"] == "application"
        assert data[0]["tags_value"] == "countries"

    def test_tag_frequency(self):
        # LCP-less transaction should be ignored in total counts for frequency.
        self.store_transaction(tags=[["color", "orange"], ["many", "maybe"]], lcp=None)

        request = {
            "aggregateColumn": "measurements.lcp",
            "sort": "-frequency",
            "per_page": 5,
            "statsPeriod": "14d",
            "query": "(color:red or color:blue)",
            "allTagKeys": True,
        }

        response = self.do_request(request)
        assert response.status_code == 200, response.content

        data = response.data["data"]
        assert len(data) == 5
        assert data[0]["count"] == 19
        assert data[0]["tags_key"] == "application"
        assert data[0]["tags_value"] == "countries"

        # Only transactions with lcp should be considered
        assert data[0]["frequency"] == 1

    def test_tag_key_values(self):
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "per_page": 5,
            "statsPeriod": "14d",
            "tagKey": "color",
        }
        # With feature access
        response = self.do_request(request)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 3
        assert data[0]["count"] == 14
        assert data[0]["tags_key"] == "color"
        assert data[0]["tags_value"] == "red"

    def test_aggregate_zero(self):
        # LCP-less transaction should be ignored in total counts for frequency.
        self.store_transaction(tags=[["color", "purple"]], duration=0)

        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "per_page": 5,
            "statsPeriod": "14d",
            "tagKey": "color",
            "query": "(color:purple)",
        }

        response = self.do_request(request)
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count"] == 1
        assert data[0]["comparison"] == 0
        assert data[0]["tags_key"] == "color"
        assert data[0]["tags_value"] == "purple"
