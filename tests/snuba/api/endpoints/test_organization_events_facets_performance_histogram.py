from datetime import timedelta

from django.urls import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data


class OrganizationEventsFacetsPerformanceHistogramEndpointTest(SnubaTestCase, APITestCase):
    feature_list = (
        "organizations:discover-basic",
        "organizations:global-views",
        "organizations:performance-tag-page",
    )

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1).replace(microsecond=0)
        self.two_mins_ago = before_now(minutes=2).replace(microsecond=0)
        self.day_ago = before_now(days=1).replace(microsecond=0)

        self.login_as(user=self.user)
        self.project = self.create_project()
        self.project2 = self.create_project()

        self._transaction_count = 0

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

        self.url = reverse(
            "sentry-api-0-organization-events-facets-performance-histogram",
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

    def do_request(self, query=None, feature_list=None):
        query = query if query is not None else {"aggregateColumn": "transaction.duration"}
        query["project"] = query["project"] if "project" in query else [self.project.id]
        with self.feature(feature_list or self.feature_list):
            return self.client.get(self.url, query, format="json")

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
            feature_list=(
                "organizations:discover-basic",
                "organizations:global-views",
            ),
        )
        assert error_response.status_code == 404

    def test_tag_key_limit_error(self):
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "per_page": 5,
            "statsPeriod": "14d",
            "query": "(color:red or color:blue)",
        }
        # With feature access, no tag key
        error_response = self.do_request(
            request, feature_list=self.feature_list + ("organizations:performance-tag-page",)
        )

        assert error_response.status_code == 400, error_response.content
        assert error_response.data == {
            "detail": "'tagKeyLimit' must be provided for the performance histogram."
        }

    def test_num_buckets_error(self):
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "per_page": 5,
            "statsPeriod": "14d",
            "query": "(color:red or color:blue)",
            "tagKeyLimit": 5,
        }
        # With feature access, no tag key
        error_response = self.do_request(
            request, feature_list=self.feature_list + ("organizations:performance-tag-page",)
        )

        assert error_response.status_code == 400, error_response.content
        assert error_response.data == {
            "detail": "'numBucketsPerKey' must be provided for the performance histogram."
        }

    def test_tag_key_histograms(self):
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "per_page": 5,
            "statsPeriod": "14d",
            "tagKeyLimit": 10,
            "numBucketsPerKey": 10,
            "query": "(color:red or color:blue)",
        }
        # With feature access, no tag key
        error_response = self.do_request(
            request, feature_list=self.feature_list + ("organizations:performance-tag-page",)
        )

        assert error_response.status_code == 400, error_response.content
        assert error_response.data == {"detail": "'tagKey' must be provided when using histograms."}

        # With feature access and tag key
        request["tagKey"] = "color"
        data_response = self.do_request(
            request, feature_list=self.feature_list + ("organizations:performance-tag-page",)
        )

        histogram_data = data_response.data["histogram"]["data"]
        assert len(histogram_data) == 2
        assert histogram_data[0]["count"] == 14
        assert histogram_data[0]["histogram_transaction_duration_50000_1000000_1"] == 1000000.0
        assert histogram_data[0]["tags_value"] == "red"
        assert histogram_data[0]["tags_key"] == "color"
        assert histogram_data[1]["count"] == 5
        assert histogram_data[1]["histogram_transaction_duration_50000_1000000_1"] == 4000000.0
        assert histogram_data[1]["tags_value"] == "blue"
        assert histogram_data[1]["tags_key"] == "color"

        tag_data = data_response.data["tags"]["data"]
        assert len(tag_data) == 2
        assert tag_data[0]["tags_value"] == "red"
        assert tag_data[1]["tags_value"] == "blue"

    def test_no_top_tags(self):
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "per_page": 5,
            "statsPeriod": "14d",
            "tagKeyLimit": 10,
            "numBucketsPerKey": 10,
            "tagKey": "color",
            "query": "(color:teal or color:oak)",
        }

        data_response = self.do_request(
            request, feature_list=self.feature_list + ("organizations:performance-tag-page",)
        )

        histogram_data = data_response.data["histogram"]["data"]
        assert histogram_data == []

        tag_data = data_response.data["tags"]["data"]
        assert tag_data == []

    def test_tag_key_histogram_buckets(self):
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "per_page": 5,
            "statsPeriod": "14d",
            "tagKeyLimit": 1,
            "numBucketsPerKey": 2,
            "tagKey": "color",
            "query": "(color:red or color:blue or color:green)",
        }

        data_response = self.do_request(
            request, feature_list=self.feature_list + ("organizations:performance-tag-page",)
        )

        histogram_data = data_response.data["histogram"]["data"]
        assert len(histogram_data) == 1
        assert histogram_data[0]["count"] == 14
        assert histogram_data[0]["histogram_transaction_duration_2500000_0_1"] == 0.0
        assert histogram_data[0]["tags_value"] == "red"
        assert histogram_data[0]["tags_key"] == "color"

        request["tagKeyLimit"] = 3
        data_response = self.do_request(
            request, feature_list=self.feature_list + ("organizations:performance-tag-page",)
        )

        histogram_data = data_response.data["histogram"]["data"]
        assert len(histogram_data) == 3
        assert histogram_data[0]["count"] == 14
        assert histogram_data[0]["histogram_transaction_duration_750000_750000_1"] == 750000.0
        assert histogram_data[0]["tags_value"] == "red"
        assert histogram_data[0]["tags_key"] == "color"

        assert histogram_data[1]["count"] == 5
        assert histogram_data[1]["histogram_transaction_duration_750000_750000_1"] == 3750000.0
        assert histogram_data[1]["tags_value"] == "blue"
        assert histogram_data[1]["tags_key"] == "color"

        assert histogram_data[2]["count"] == 1
        assert histogram_data[2]["histogram_transaction_duration_750000_750000_1"] == 4500000.0
        assert histogram_data[2]["tags_value"] == "green"
        assert histogram_data[2]["tags_key"] == "color"

    def test_histograms_omit_empty_measurements(self):
        request = {
            "aggregateColumn": "transaction.duration",
            "sort": "-frequency",
            "per_page": 5,
            "statsPeriod": "14d",
            "tagKeyLimit": 3,
            "numBucketsPerKey": 2,
            "tagKey": "color",
            "query": "(color:red or color:blue or color:green or color:orange)",
        }

        data_response = self.do_request(
            request, feature_list=self.feature_list + ("organizations:performance-tag-page",)
        )

        assert data_response.data["tags"]["data"][2]["tags_value"] == "orange"

        request["aggregateColumn"] = "measurements.lcp"

        data_response = self.do_request(
            request, feature_list=self.feature_list + ("organizations:performance-tag-page",)
        )

        assert data_response.data["tags"]["data"][2]["tags_value"] == "green"

        histogram_data = data_response.data["histogram"]["data"]
        assert len(histogram_data) == 3
        assert histogram_data[0]["count"] == 14
        assert histogram_data[0]["histogram_measurements_lcp_750_750_1"] == 750.0
        assert histogram_data[0]["tags_value"] == "red"
        assert histogram_data[0]["tags_key"] == "color"

        assert histogram_data[1]["count"] == 5
        assert histogram_data[1]["histogram_measurements_lcp_750_750_1"] == 3750.0
        assert histogram_data[1]["tags_value"] == "blue"
        assert histogram_data[1]["tags_key"] == "color"

        assert histogram_data[2]["count"] == 1
        assert histogram_data[2]["histogram_measurements_lcp_750_750_1"] == 4500.0
        assert histogram_data[2]["tags_value"] == "green"
        assert histogram_data[2]["tags_key"] == "color"
