from datetime import timedelta

from django.urls import reverse

from sentry.testutils.helpers.datetime import iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.cursors import Cursor
from sentry.utils.samples import load_data
from tests.snuba.api.endpoints.test_organization_events_facets_performance import (
    BaseOrganizationEventsFacetsPerformanceEndpointTest,
)


@region_silo_test
class OrganizationEventsFacetsPerformanceHistogramEndpointTest(
    BaseOrganizationEventsFacetsPerformanceEndpointTest
):
    feature_list = (
        "organizations:discover-basic",
        "organizations:global-views",
        "organizations:performance-view",
    )

    def setUp(self):
        super().setUp()

        self._transaction_count = 0

        self.url = reverse(
            "sentry-api-0-organization-events-facets-performance-histogram",
            kwargs={"organization_slug": self.project.organization.slug},
        )

    # Function to set up some transactions for most tests
    def setup_transactions(self):
        for i in range(5):
            self.store_transaction(
                tags=[["color", "blue"], ["many", "yes"]], duration=4000, lcp=4000
            )

        # LCP-less transaction
        self.store_transaction(tags=[["color", "orange"], ["many", "maybe"]], lcp=None)

        for i in range(14):
            self.store_transaction(
                tags=[["color", "red"], ["many", "yes"]], duration=1000, lcp=1000
            )
        for i in range(1):
            self.store_transaction(
                tags=[["color", "green"], ["many", "no"]], duration=5000, lcp=5000
            )

    def store_transaction(
        self,
        name="exampleTransaction",
        duration=100,
        tags=None,
        project_id=None,
        lcp=None,
        user_id=None,
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
        if user_id:
            event["user"] = {
                "email": "foo@example.com",
                "id": user_id,
                "ip_address": "127.0.0.1",
                "username": "foo",
            }

        if lcp:
            event["measurements"]["lcp"]["value"] = lcp
        else:
            del event["measurements"]["lcp"]

        self._transaction_count += 1
        self.store_event(data=event, project_id=project_id)

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

    def test_no_access(self):
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "per_page": 5,
            "statsPeriod": "14d",
            "query": "(color:red or color:blue)",
        }
        error_response = self.do_request(
            request,
            {
                "organizations:performance-view": False,
            },
        )
        assert error_response.status_code == 404

    def test_num_buckets_error(self):
        self.setup_transactions()
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "statsPeriod": "14d",
            "query": "(color:red or color:blue)",
            "per_page": 5,
        }
        # With feature access, no tag key
        error_response = self.do_request(request)

        assert error_response.status_code == 400, error_response.content
        assert error_response.data == {
            "detail": "'numBucketsPerKey' must be provided for the performance histogram."
        }

    def test_tag_key_histograms(self):
        self.setup_transactions()
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "statsPeriod": "14d",
            "per_page": 10,
            "numBucketsPerKey": 10,
            "query": "(color:red or color:blue)",
        }
        # With feature access, no tag key
        error_response = self.do_request(request)

        assert error_response.status_code == 400, error_response.content
        assert error_response.data == {"detail": "'tagKey' must be provided when using histograms."}

        # With feature access and tag key
        request["tagKey"] = "color"
        data_response = self.do_request(request)

        histogram_data = data_response.data["histogram"]["data"]
        assert len(histogram_data) == 2
        assert histogram_data[0]["count"] == 14

        assert histogram_data[0]["histogram_transaction_duration_500000_1000000_1"] == 1000000.0
        assert histogram_data[0]["tags_value"] == "red"
        assert histogram_data[0]["tags_key"] == "color"
        assert histogram_data[1]["count"] == 5
        assert histogram_data[1]["histogram_transaction_duration_500000_1000000_1"] == 4000000.0
        assert histogram_data[1]["tags_value"] == "blue"
        assert histogram_data[1]["tags_key"] == "color"

        tag_data = data_response.data["tags"]["data"]
        assert len(tag_data) == 2
        assert tag_data[0]["tags_value"] == "red"
        assert tag_data[1]["tags_value"] == "blue"

    def test_no_top_tags(self):
        self.setup_transactions()
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "statsPeriod": "14d",
            "per_page": 10,
            "numBucketsPerKey": 10,
            "tagKey": "color",
            "query": "(color:teal or color:oak)",
        }

        data_response = self.do_request(request)

        histogram_data = data_response.data["histogram"]["data"]
        assert histogram_data == []

        tag_data = data_response.data["tags"]["data"]
        assert tag_data == []

    def test_tag_key_histogram_buckets(self):
        self.setup_transactions()
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "statsPeriod": "14d",
            "per_page": 1,
            "numBucketsPerKey": 2,
            "tagKey": "color",
            "query": "(color:red or color:blue or color:green)",
        }

        data_response = self.do_request(request)

        histogram_data = data_response.data["histogram"]["data"]
        assert len(histogram_data) == 1
        assert histogram_data[0]["count"] == 14
        assert histogram_data[0]["histogram_transaction_duration_2500000_0_1"] == 0.0
        assert histogram_data[0]["tags_value"] == "red"
        assert histogram_data[0]["tags_key"] == "color"

        request["per_page"] = 3
        data_response = self.do_request(request)

        histogram_data = data_response.data["histogram"]["data"]
        assert len(histogram_data) == 3

        assert histogram_data[0]["count"] == 14
        assert histogram_data[0]["histogram_transaction_duration_2500000_0_1"] == 0.0
        assert histogram_data[0]["tags_value"] == "red"
        assert histogram_data[0]["tags_key"] == "color"

        assert histogram_data[1]["count"] == 5
        assert histogram_data[1]["histogram_transaction_duration_2500000_0_1"] == 2500000.0
        assert histogram_data[1]["tags_value"] == "blue"
        assert histogram_data[1]["tags_key"] == "color"

        assert histogram_data[2]["count"] == 1
        assert histogram_data[2]["histogram_transaction_duration_2500000_0_1"] == 5000000.0
        assert histogram_data[2]["tags_value"] == "green"
        assert histogram_data[2]["tags_key"] == "color"

    def test_histograms_omit_empty_measurements(self):
        self.setup_transactions()
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "statsPeriod": "14d",
            "per_page": 3,
            "numBucketsPerKey": 2,
            "tagKey": "color",
            "query": "(color:red or color:blue or color:green or color:orange)",
        }

        data_response = self.do_request(request)

        assert data_response.data["tags"]["data"][2]["tags_value"] == "green"

        request["aggregateColumn"] = "measurements.lcp"

        data_response = self.do_request(request)

        tags_data = data_response.data["tags"]["data"]
        assert len(tags_data) == 3
        assert tags_data[2]["tags_value"] == "green"

        histogram_data = data_response.data["histogram"]["data"]
        assert len(histogram_data) == 3
        assert histogram_data[0]["count"] == 14
        assert histogram_data[0]["histogram_measurements_lcp_2500_0_1"] == 0.0
        assert histogram_data[0]["tags_value"] == "red"
        assert histogram_data[0]["tags_key"] == "color"

        assert histogram_data[1]["count"] == 5
        assert histogram_data[1]["histogram_measurements_lcp_2500_0_1"] == 2500.0
        assert histogram_data[1]["tags_value"] == "blue"
        assert histogram_data[1]["tags_key"] == "color"

        assert histogram_data[2]["count"] == 1
        assert histogram_data[2]["histogram_measurements_lcp_2500_0_1"] == 5000.0
        assert histogram_data[2]["tags_value"] == "green"
        assert histogram_data[2]["tags_key"] == "color"

    def test_histogram_user_field(self):
        self.setup_transactions()
        self.store_transaction(
            tags=[["color", "blue"], ["many", "yes"]], duration=4000, user_id=555
        )

        request = {
            "aggregateColumn": "transaction.duration",
            "per_page": 1,
            "numBucketsPerKey": 2,
            "tagKey": "user",
            "query": "(user.id:555)",
        }

        data_response = self.do_request(request)

        histogram_data = data_response.data["histogram"]["data"]
        assert histogram_data[0]["count"] == 1
        assert histogram_data[0]["tags_value"] == "id:555"
        assert histogram_data[0]["tags_key"] == "user"

        tag_data = data_response.data["tags"]["data"]
        assert tag_data[0]["count"] == 1
        assert tag_data[0]["tags_value"] == "id:555"

    def test_histogram_pagination(self):
        self.setup_transactions()
        request = {
            "aggregateColumn": "transaction.duration",
            "per_page": 3,
            "numBucketsPerKey": 2,
            "tagKey": "color",
        }

        data_response = self.do_request(request)

        tag_data = data_response.data["tags"]["data"]
        assert len(tag_data) == 3

        request["cursor"] = Cursor(0, 3)

        data_response = self.do_request(request)

        tag_data = data_response.data["tags"]["data"]
        assert len(tag_data) == 1

    def test_histogram_sorting(self):
        self.setup_transactions()
        request = {
            "aggregateColumn": "transaction.duration",
            "per_page": 1,
            "sort": "-frequency",
            "numBucketsPerKey": 2,
            "tagKey": "color",
        }

        data_response = self.do_request(request)

        tag_data = data_response.data["tags"]["data"]
        assert len(tag_data) == 1
        assert tag_data[0]["tags_value"] == "red"
        assert tag_data[0]["count"] == 14

        request["sort"] = "-aggregate"

        data_response = self.do_request(request)

        tag_data = data_response.data["tags"]["data"]
        assert len(tag_data) == 1
        assert tag_data[0]["tags_value"] == "green"
        assert tag_data[0]["count"] == 1

    def test_histogram_high_buckets(self):
        for i in range(10):
            self.store_transaction(tags=[["fruit", "apple"]], duration=i * 100 + 50)
            self.store_transaction(tags=[["fruit", "orange"]], duration=i * 100 + 1000 + 50)

        request = {
            "aggregateColumn": "transaction.duration",
            "per_page": 2,
            "sort": "-frequency",
            "numBucketsPerKey": 20,
            "tagKey": "fruit",
        }

        data_response = self.do_request(request)

        histogram_data = data_response.data["histogram"]["data"]
        assert len(histogram_data) == 20

        for i, d in enumerate(histogram_data):
            assert d["count"] == 1
            assert d["histogram_transaction_duration_100000_0_1"] == i * 100000.0
            if i < 10:
                assert d["tags_value"] == "apple"
            else:
                assert d["tags_value"] == "orange"

        tag_data = data_response.data["tags"]["data"]
        assert len(tag_data) == 2
        assert tag_data[0]["tags_value"] == "apple"
        assert tag_data[0]["count"] == 10
        assert tag_data[0]["aggregate"] == 500000.0

        assert tag_data[1]["tags_value"] == "orange"
        assert tag_data[1]["count"] == 10
        assert tag_data[1]["aggregate"] == 1500000.0
