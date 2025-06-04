from uuid import uuid4

from django.urls import reverse

from sentry.testutils.cases import APITestCase, BaseSpansTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationSpansFieldsStatsEndpointTest(BaseSpansTestCase, APITestCase):
    is_eap = True
    view = "sentry-api-0-organization-spans-fields-stats"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, query=None, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-spans-fields-stats"]

        if query and "type" not in query.keys():
            query["type"] = "string"

        with self.feature(features):
            response = self.client.get(
                reverse(self.view, kwargs={"organization_id_or_slug": self.organization.slug}),
                query,
                format="json",
                **kwargs,
            )

            return response

    def _generate_one_span(self, tags=None):
        if tags is None:
            tags = {"foo": "bar"}

        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            transaction="foo",
            duration=100,
            exclusive_time=100,
            tags=tags,
            is_eap=self.is_eap,
        )

    def test_no_project(self):
        response = self.do_request()
        assert response.status_code == 200, response.data
        assert response.data == {"attributeDistributions": []}

    def test_no_feature(self):
        response = self.do_request(features=[])
        assert response.status_code == 404, response.data

    def test_invalid_params(self):
        self._generate_one_span()
        response = self.do_request(query={"max_buckets": "invalid", "max_attributes": "invalid"})
        assert response.status_code == 400, response.data
        assert "A valid integer is required" in str(response.data)

    def test_valid_max_params(self):
        self._generate_one_span()
        response = self.do_request(query={"max_buckets": "50", "max_attributes": "100"})
        assert response.status_code == 200, response.data
        assert "attributeDistributions" in str(response.data)

    def test_invalid_max_buckets(self):
        self._generate_one_span()
        # max_buckets is more than 100
        response = self.do_request(query={"max_buckets": "200", "max_attributes": "100"})
        assert response.status_code == 400, response.data
        assert "Ensure this value is less than or equal to 100" in str(response.data)

    def test_invalid_date_params(self):
        self._generate_one_span()
        response = self.do_request(
            query={
                "start": "invalid-date",
                "end": "invalid-date",
            }
        )
        assert response.status_code == 400, response.data

    def test_max_attributes(self, max_attributes=3):
        tags = [{f"test_tag_{i}": f"value_{i}"} for i in range(max_attributes)]

        for tag in tags:
            self._generate_one_span(tag)

        # set max_attributes smaller than the number of attributes, so we can test if max_attributes is respected
        response = self.do_request(query={"max_attributes": max_attributes - 1})
        assert response.status_code == 200, response.data

        distributions = response.data["results"][0]["attributeDistributions"]["attributes"]
        assert len(distributions) == max_attributes - 1

    def test_max_buckets(self, max_buckets=3):
        tags = [{"test_tag": f"value_{i}"} for i in range(max_buckets)]

        for tag in tags:
            self._generate_one_span(tag)

        # set max_buckets smaller than the number of values, so we can test if max_buckets is respected
        response = self.do_request(query={"max_buckets": max_buckets - 1})
        assert response.status_code == 200, response.data
        distributions = response.data["results"][0]["attributeDistributions"]["attributes"][0][
            "buckets"
        ]

        assert len(distributions) == max_buckets - 1

    def test_distribution_values(self):
        tags = [
            {"broswer": "chrome", "device": "desktop"},
            {"broswer": "chrome", "device": "mobile"},
            {"broswer": "chrome", "device": "desktop"},
            {"broswer": "safari", "device": "mobile"},
            {"broswer": "chrome", "device": "desktop"},
        ]

        for tag in tags:
            self._generate_one_span(tag)

        response = self.do_request(query={"dataset": "spans"})
        assert response.status_code == 200, response.data
        distributions = response.data["results"][0]["attributeDistributions"]["attributes"]
        assert distributions[0]["attributeName"] == "broswer"
        assert distributions[0]["buckets"] == [
            {"label": "chrome", "value": 4.0},
            {"label": "safari", "value": 1.0},
        ]
        assert distributions[1]["attributeName"] == "device"
        assert distributions[1]["buckets"] == [
            {"label": "desktop", "value": 3.0},
            {"label": "mobile", "value": 2.0},
        ]

    def test_filter_query(self):
        tags = [
            {"broswer": "chrome", "device": "desktop"},
            {"broswer": "chrome", "device": "mobile"},
        ]

        for tag in tags:
            self._generate_one_span(tag)

        response = self.do_request(query={"query": "device:desktop"})
        assert response.status_code == 200, response.data
        distributions = response.data["results"][0]["attributeDistributions"]["attributes"]
        assert distributions[0]["attributeName"] == "broswer"
        # the second span has a different device value, so it should not be included in the results
        assert distributions[0]["buckets"] == [
            {"label": "chrome", "value": 1.0},
        ]
