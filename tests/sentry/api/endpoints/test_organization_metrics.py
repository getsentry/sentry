import time
from copy import deepcopy
from typing import Optional
from unittest import mock

from django.urls import reverse

from sentry.models import ApiToken
from sentry.sentry_metrics import indexer
from sentry.snuba.metrics import _METRICS
from sentry.testutils import APITestCase
from sentry.testutils.cases import SessionMetricsTestCase
from sentry.testutils.helpers import with_feature

FEATURE_FLAG = "organizations:metrics"


class OrganizationMetricsPermissionTest(APITestCase):

    endpoints = (
        ("sentry-api-0-organization-metrics-index",),
        ("sentry-api-0-organization-metric-details", "foo"),
        ("sentry-api-0-organization-metrics-tags",),
        ("sentry-api-0-organization-metrics-tag-details", "foo"),
        ("sentry-api-0-organization-metrics-data",),
    )

    def send_get_request(self, token, endpoint, *args):
        url = reverse(endpoint, args=(self.project.organization.slug,) + args)
        return self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json")

    @with_feature(FEATURE_FLAG)
    def test_permissions(self):

        token = ApiToken.objects.create(user=self.user, scope_list=[])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code == 403

        token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code in (200, 400, 404)

    def test_feature_flag(self):
        token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code == 404


class OrganizationMetricsTest(APITestCase):

    endpoint = "sentry-api-0-organization-metrics-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @with_feature(FEATURE_FLAG)
    def test_response(self):
        response = self.get_valid_response(self.project.organization.slug)

        required_fields = {"name", "operations", "type"}
        optional_fields = {"unit"}

        for item in response.data:

            # All required fields are there:
            assert required_fields <= item.keys()

            # Only optional field is unit:
            additional_fields = item.keys() - required_fields
            if additional_fields:
                assert additional_fields <= optional_fields


class OrganizationMetricDetailsTest(APITestCase):

    endpoint = "sentry-api-0-organization-metric-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @with_feature(FEATURE_FLAG)
    def test_unknown_metric(self):
        response = self.get_response(self.project.organization.slug, "foo")

        assert response.status_code == 404

    @with_feature(FEATURE_FLAG)
    def test_valid_response(self):

        response = self.get_success_response(self.project.organization.slug, "session")

        assert response.data["name"] == "session"
        assert "tags" in response.data
        assert all(isinstance(item, str) for item in response.data["tags"])


_EXTENDED_METRICS = deepcopy(_METRICS)
_EXTENDED_METRICS["user"]["tags"] = dict(_EXTENDED_METRICS["user"]["tags"], custom_user_tag=[""])
_EXTENDED_METRICS["session"]["tags"] = dict(
    _EXTENDED_METRICS["session"]["tags"], custom_session_tag=["foo", "bar"]
)


class OrganizationMetricTagsTest(APITestCase):

    endpoint = "sentry-api-0-organization-metrics-tags"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @with_feature(FEATURE_FLAG)
    @mock.patch("sentry.snuba.metrics._METRICS", _EXTENDED_METRICS)
    def test_response(self):

        response = self.get_success_response(self.project.organization.slug)

        # Check if data are sane:
        assert isinstance(response.data, list)
        assert all(isinstance(item, dict) for item in response.data)

        # Check if intersection works:
        tags = {tag["key"] for tag in response.data}
        assert "environment" in tags
        assert "custom_session_tag" in tags  # from 'session' tags
        assert "custom_user_tag" in tags  # from 'user' tags

    @with_feature(FEATURE_FLAG)
    @mock.patch("sentry.snuba.metrics._METRICS", _EXTENDED_METRICS)
    def test_filtered_response(self):

        response = self.get_success_response(self.project.organization.slug, metric="session")

        # Check that only tags from this metrics appear:
        tags = {tag["key"] for tag in response.data}
        assert "environment" in tags
        assert "custom_session_tag" in tags  # from 'session' tags
        assert "custom_user_tag" not in tags  # from 'user' tags

    @with_feature(FEATURE_FLAG)
    def test_two_filters(self):

        response = self.get_success_response(
            self.project.organization.slug, metric=["user", "session"]
        )

        # Check that only tags from this metrics appear:
        tags = {tag["key"] for tag in response.data}
        assert "environment" in tags
        assert "custom_session_tag" not in tags  # from 'session' tags
        assert "custom_user_tag" not in tags  # from 'user' tags

    @with_feature(FEATURE_FLAG)
    def test_bad_filter(self):
        response = self.get_response(self.project.organization.slug, metric="bad")

        assert response.status_code == 400


class OrganizationMetricTagDetailsTest(APITestCase):

    endpoint = "sentry-api-0-organization-metrics-tag-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @with_feature(FEATURE_FLAG)
    def test_unknown_tag(self):
        response = self.get_success_response(self.project.organization.slug, "bar")

        assert response.data == []

    @with_feature(FEATURE_FLAG)
    def test_existing_tag(self):
        response = self.get_valid_response(self.project.organization.slug, "environment")

        assert response.status_code == 200

        # Check if data are sane:
        assert isinstance(response.data, list)
        for item in response.data:
            assert isinstance(item, dict), item

        assert "production" in {tag["value"] for tag in response.data}

    @with_feature(FEATURE_FLAG)
    @mock.patch("sentry.snuba.metrics._METRICS", _EXTENDED_METRICS)
    def test_filtered_response(self):

        response = self.get_success_response(
            self.project.organization.slug,
            "custom_session_tag",
            metric="session",
        )

        # Check that only tags from this metrics appear:
        assert {tag["value"] for tag in response.data} == {"foo", "bar"}

    @with_feature(FEATURE_FLAG)
    def test_two_filters(self):

        response = self.get_success_response(
            self.project.organization.slug,
            "environment",
            metric=["user", "session"],
        )

        assert {tag["value"] for tag in response.data} == {"production", "staging"}

    @with_feature(FEATURE_FLAG)
    def test_bad_filter(self):
        response = self.get_response(self.project.organization.slug, "environment", metric="bad")

        assert response.status_code == 400


class OrganizationMetricDataTest(APITestCase):

    endpoint = "sentry-api-0-organization-metrics-data"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @with_feature(FEATURE_FLAG)
    def test_missing_field(self):
        response = self.get_response(
            self.project.organization.slug,
        )

        assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_invalid_field(self):

        for field in ["", "(*&%", "foo(session", "foo(session)", "sum(bar)"]:
            response = self.get_response(self.project.organization.slug, field=field)

            assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_valid_operation(self):
        response = self.get_response(self.project.organization.slug, field="sum(session)")

        assert response.status_code == 200

        # Only one group:
        groups = response.data["groups"]
        assert len(groups) == 1 and groups[0]["by"] == {}

    @with_feature(FEATURE_FLAG)
    def test_groupby_single(self):
        response = self.get_response(
            self.project.organization.slug,
            field="sum(session)",
            groupBy="environment",
        )

        assert response.status_code == 200

    @with_feature(FEATURE_FLAG)
    def test_groupby_multiple(self):
        response = self.get_response(
            self.project.organization.slug,
            field="sum(session)",
            groupBy=["environment", "session.status"],
        )

        assert response.status_code == 200

        groups = response.data["groups"]
        assert len(groups) >= 2 and all(
            group["by"].keys() == {"environment", "session.status"} for group in groups
        )

    @with_feature(FEATURE_FLAG)
    def test_invalid_filter(self):
        for query in [
            "%w45698u",
            "release:foo or ",
        ]:

            response = self.get_response(
                self.project.organization.slug,
                field="sum(session)",
                groupBy="environment",
                query=query,
            )

            assert response.status_code == 400, query

    @with_feature(FEATURE_FLAG)
    def test_valid_filter(self):

        for query in [
            "release:",  # Empty string is OK
            "release:myapp@2.0.0",
            "release:myapp@2.0.0 and environment:production",
            "release:myapp@2.0.0 and environment:production or session.status:healthy",
        ]:

            response = self.get_success_response(
                self.project.organization.slug,
                field="sum(session)",
                groupBy="environment",
                query=query,
            )
            assert response.data.keys() == {"start", "end", "query", "intervals", "groups"}

    @with_feature(FEATURE_FLAG)
    def test_orderby_unknown(self):
        response = self.get_response(
            self.project.organization.slug, field="sum(session)", orderBy="foo"
        )
        assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_orderby_tag(self):
        """Order by tag is not supported (yet)"""
        response = self.get_response(
            self.project.organization.slug,
            field="sum(session)",
            groupBy="environment",
            orderBy="environment",
        )
        assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_orderby_2(self):
        """Only one field is supported with order by"""
        response = self.get_response(
            self.project.organization.slug,
            field=["sum(session)", "count_unique(user)"],
            orderBy=["sum(session)"],
        )
        assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_orderby_percentile(self):
        """Order by tag is not supported yet"""
        response = self.get_response(
            self.project.organization.slug, field="p95(session)", orderBy="p95(session)"
        )
        assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_limit_without_orderby(self):
        response = self.get_response(
            self.project.organization.slug,
            field="sum(session)",
            limit=3,
        )
        assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_limit_invalid(self):
        for limit in (-1, 0, "foo"):
            response = self.get_response(
                self.project.organization.slug,
                field="sum(session)",
                limit=limit,
            )
            assert response.status_code == 400


class OrganizationMetricIntegrationTest(SessionMetricsTestCase, APITestCase):
    endpoint = "sentry-api-0-organization-metrics-data"

    def setUp(self):
        super().setUp()
        self.project2 = self.create_project()
        self.login_as(user=self.user)

    @with_feature(FEATURE_FLAG)
    def test_separate_projects(self):
        # Insert session metrics:
        self.store_session(self.build_session(project_id=self.project.id))
        self.store_session(self.build_session(project_id=self.project2.id))

        def count_sessions(project_id: Optional[int]) -> int:
            kwargs = dict(
                field="sum(session)",
                statsPeriod="1h",
                interval="1h",
                datasource="snuba",
            )
            if project_id is not None:
                kwargs["project"] = project_id

            response = self.get_success_response(self.organization.slug, **kwargs)
            groups = response.data["groups"]
            assert len(groups) == 1

            return groups[0]["totals"]["sum(session)"]

        # Request for entire org gives a counter of two:
        assert count_sessions(project_id=None) == 2

        # Request for single project gives a counter of one:
        assert count_sessions(project_id=self.project2.id) == 1

    @with_feature(FEATURE_FLAG)
    def test_orderby(self):
        # Record some strings
        metric_id = indexer.record("measurement.lcp")
        k_transaction = indexer.record("transaction")
        v_foo = indexer.record("/foo")
        v_bar = indexer.record("/bar")
        v_baz = indexer.record("/baz")
        k_rating = indexer.record("measurement_rating")
        v_good = indexer.record("good")
        v_meh = indexer.record("meh")
        v_poor = indexer.record("poor")

        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": metric_id,
                    "timestamp": int(time.time()),
                    "tags": {
                        k_transaction: v_transaction,
                        k_rating: v_rating,
                    },
                    "type": "d",
                    "value": count
                    * [123.4],  # count decides the cardinality of this distribution bucket
                    "retention_days": 90,
                }
                for v_transaction, count in ((v_foo, 1), (v_bar, 3), (v_baz, 2))
                for v_rating in (v_good, v_meh, v_poor)
            ],
            entity="metrics_distributions",
        )

        response = self.get_success_response(
            self.organization.slug,
            field="count(measurement.lcp)",
            query="measurement_rating:poor",
            statsPeriod="1h",
            interval="1h",
            datasource="snuba",
            groupBy="transaction",
            orderBy="-count(measurement.lcp)",
            limit=2,
        )
        groups = response.data["groups"]
        assert len(groups) == 2

        expected = [
            ("/bar", 3),
            ("/baz", 2),
        ]
        for (expected_transaction, expected_count), group in zip(expected, groups):
            # With orderBy, you only get totals:
            assert "series" not in group
            assert group["by"] == {"transaction": expected_transaction}
            totals = group["totals"]
            assert totals == {"count(measurement.lcp)": expected_count}
