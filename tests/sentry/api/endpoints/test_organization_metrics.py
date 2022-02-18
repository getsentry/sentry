import time
from typing import Optional
from unittest import mock

from django.urls import reverse

from sentry.models import ApiToken
from sentry.sentry_metrics import indexer
from sentry.testutils import APITestCase
from sentry.testutils.cases import SessionMetricsTestCase
from sentry.testutils.helpers import with_feature
from sentry.utils.cursors import Cursor

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


class OrganizationMetricDataTest(SessionMetricsTestCase, APITestCase):
    endpoint = "sentry-api-0-organization-metrics-data"

    def setUp(self):
        super().setUp()
        self.project2 = self.create_project()
        self.login_as(user=self.user)

    @with_feature(FEATURE_FLAG)
    def test_missing_field(self):
        response = self.get_response(self.project.organization.slug)
        assert response.status_code == 400
        assert response.json()["detail"] == 'Request is missing a "field"'

    @with_feature(FEATURE_FLAG)
    def test_invalid_field(self):
        for field in ["", "(*&%", "foo(session", "foo(session)"]:
            response = self.get_response(self.project.organization.slug, field=field)
            assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_groupby_single(self):
        indexer.record("environment")
        response = self.get_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            groupBy="environment",
        )

        assert response.status_code == 200

    @with_feature(FEATURE_FLAG)
    def test_invalid_filter(self):
        query = "release:foo or "
        response = self.get_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            groupBy="environment",
            query=query,
        )
        assert response.status_code == 400, query

    @with_feature(FEATURE_FLAG)
    def test_valid_filter(self):
        for tag in ("release", "environment"):
            indexer.record(tag)
        query = "release:myapp@2.0.0"
        response = self.get_success_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            groupBy="environment",
            query=query,
        )
        assert response.data.keys() == {"start", "end", "query", "intervals", "groups"}

    @with_feature(FEATURE_FLAG)
    def test_orderby_unknown(self):
        response = self.get_response(
            self.project.organization.slug, field="sum(sentry.sessions.session)", orderBy="foo"
        )
        assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_orderby_tag(self):
        """Order by tag is not supported (yet)"""
        response = self.get_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)", "environment"],
            groupBy="environment",
            orderBy="environment",
        )
        assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_pagination_limit_without_orderby(self):
        """
        Test that ensures an exception is raised when pagination `per_page` parameter is sent
        without order by being set
        """
        response = self.get_response(
            self.organization.slug,
            field="count(sentry.transactions.measurements.lcp)",
            groupBy="transaction",
            per_page=2,
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            "'per_page' is only supported in combination with 'orderBy'"
        )

    @with_feature(FEATURE_FLAG)
    def test_pagination_offset_without_orderby(self):
        """
        Test that ensures an exception is raised when pagination `per_page` parameter is sent
        without order by being set
        """
        response = self.get_response(
            self.organization.slug,
            field="count(sentry.transactions.measurements.lcp)",
            groupBy="transaction",
            cursor=Cursor(0, 1),
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            "'cursor' is only supported in combination with 'orderBy'"
        )

    @with_feature(FEATURE_FLAG)
    def test_statsperiod_invalid(self):
        response = self.get_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="",
        )
        assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_separate_projects(self):
        # Insert session metrics:
        self.store_session(self.build_session(project_id=self.project.id))
        self.store_session(self.build_session(project_id=self.project2.id))

        def count_sessions(project_id: Optional[int]) -> int:
            kwargs = dict(
                field="sum(sentry.sessions.session)",
                statsPeriod="1h",
                interval="1h",
            )
            if project_id is not None:
                kwargs["project"] = project_id

            response = self.get_success_response(self.organization.slug, **kwargs)
            groups = response.data["groups"]
            assert len(groups) == 1

            return groups[0]["totals"]["sum(sentry.sessions.session)"]

        # Request for entire org gives a counter of two:
        assert count_sessions(project_id=None) == 2

        # Request for single project gives a counter of one:
        assert count_sessions(project_id=self.project2.id) == 1

    @with_feature(FEATURE_FLAG)
    def test_orderby(self):
        # Record some strings
        metric_id = indexer.record("sentry.transactions.measurements.lcp")
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
            field="count(sentry.transactions.measurements.lcp)",
            query="measurement_rating:poor",
            statsPeriod="1h",
            interval="1h",
            groupBy="transaction",
            orderBy="-count(sentry.transactions.measurements.lcp)",
            per_page=2,
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
            assert totals == {"count(sentry.transactions.measurements.lcp)": expected_count}

    @with_feature(FEATURE_FLAG)
    def test_orderby_percentile(self):
        # Record some strings
        metric_id = indexer.record("sentry.transactions.measurements.lcp")
        tag1 = indexer.record("tag1")
        value1 = indexer.record("value1")
        value2 = indexer.record("value2")

        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": metric_id,
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": numbers,
                    "tags": {tag: value},
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (tag1, value1, [4, 5, 6]),
                    (tag1, value2, [1, 2, 3]),
                )
            ],
            entity="metrics_distributions",
        )

        response = self.get_success_response(
            self.organization.slug,
            field="p50(sentry.transactions.measurements.lcp)",
            statsPeriod="1h",
            interval="1h",
            groupBy="tag1",
            orderBy="p50(sentry.transactions.measurements.lcp)",
        )
        groups = response.data["groups"]
        assert len(groups) == 2

        expected = [
            ("value2", 2),  # value2 comes first because it has the smaller median
            ("value1", 5),
        ]
        for (expected_tag_value, expected_count), group in zip(expected, groups):
            # With orderBy, you only get totals:
            assert "series" not in group
            assert group["by"] == {"tag1": expected_tag_value}
            totals = group["totals"]
            assert totals == {"p50(sentry.transactions.measurements.lcp)": expected_count}

    @with_feature(FEATURE_FLAG)
    def test_orderby_percentile_with_pagination(self):
        metric_id = indexer.record("sentry.transactions.measurements.lcp")
        tag1 = indexer.record("tag1")
        value1 = indexer.record("value1")
        value2 = indexer.record("value2")

        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": metric_id,
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": numbers,
                    "tags": {tag: value},
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (tag1, value1, [4, 5, 6]),
                    (tag1, value2, [1, 2, 3]),
                )
            ],
            entity="metrics_distributions",
        )

        response = self.get_success_response(
            self.organization.slug,
            field="p50(sentry.transactions.measurements.lcp)",
            statsPeriod="1h",
            interval="1h",
            groupBy="tag1",
            orderBy="p50(sentry.transactions.measurements.lcp)",
            per_page=1,
        )
        groups = response.data["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {"tag1": "value2"}
        assert groups[0]["totals"] == {"p50(sentry.transactions.measurements.lcp)": 2}

        response = self.get_success_response(
            self.organization.slug,
            field="p50(sentry.transactions.measurements.lcp)",
            statsPeriod="1h",
            interval="1h",
            groupBy="tag1",
            orderBy="p50(sentry.transactions.measurements.lcp)",
            per_page=1,
            cursor=Cursor(0, 1),
        )
        groups = response.data["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {"tag1": "value1"}
        assert groups[0]["totals"] == {"p50(sentry.transactions.measurements.lcp)": 5}

    @with_feature(FEATURE_FLAG)
    def test_limit_with_orderby_is_overridden_by_paginator_limit(self):
        """
        Test that ensures when an `orderBy` clause is set, then the paginator limit overrides the
        `limit` parameter
        """
        metric_id = indexer.record("sentry.transactions.measurements.lcp")
        tag1 = indexer.record("tag1")
        value1 = indexer.record("value1")
        value2 = indexer.record("value2")

        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": metric_id,
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": numbers,
                    "tags": {tag: value},
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (tag1, value1, [4, 5, 6]),
                    (tag1, value2, [1, 2, 3]),
                )
            ],
            entity="metrics_distributions",
        )
        response = self.get_success_response(
            self.organization.slug,
            field="p50(sentry.transactions.measurements.lcp)",
            statsPeriod="1h",
            interval="1h",
            groupBy="tag1",
            orderBy="p50(sentry.transactions.measurements.lcp)",
            per_page=1,
            limit=2,
        )
        groups = response.data["groups"]
        assert len(groups) == 1

    @with_feature(FEATURE_FLAG)
    def test_orderby_percentile_with_many_fields_non_transactions_supported_fields(self):
        """
        Test that contains a field in the `select` that is not performance related should return
        a 400
        """
        response = self.get_response(
            self.organization.slug,
            field=[
                "p50(sentry.transactions.measurements.lcp)",
                "sum(sentry.sessions.session)",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy=["project_id", "transaction"],
            orderBy="p50(sentry.transactions.measurements.lcp)",
        )
        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "Multi-field select order by queries is not supported for metric "
            "sentry.sessions.session"
        )

    @with_feature(FEATURE_FLAG)
    def test_orderby_percentile_with_many_fields_transactions_unsupported_fields(self):
        """
        Test that contains a field in the `select` that is performance related but currently
        not supported should return a 400
        """
        response = self.get_response(
            self.organization.slug,
            field=[
                "p50(sentry.transactions.measurements.lcp)",
                "sum(user_misery)",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy=["project_id", "transaction"],
            orderBy="p50(sentry.transactions.measurements.lcp)",
        )
        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "Multi-field select order by queries is not supported for metric user_misery"
        )

    @with_feature(FEATURE_FLAG)
    def test_orderby_percentile_with_many_fields_one_entity_no_data(self):
        """
        Test that ensures that when metrics data is available then an empty response is returned
        gracefully
        """
        for metric in [
            "sentry.transactions.measurements.lcp",
            "sentry.transactions.measurements.fcp",
            "transaction",
        ]:
            indexer.record(metric)

        response = self.get_success_response(
            self.organization.slug,
            field=[
                "p50(sentry.transactions.measurements.lcp)",
                "p50(sentry.transactions.measurements.fcp)",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy=["project_id", "transaction"],
            orderBy="p50(sentry.transactions.measurements.lcp)",
        )
        groups = response.data["groups"]
        assert len(groups) == 0

    @with_feature(FEATURE_FLAG)
    def test_orderby_percentile_with_many_fields_one_entity(self):
        """
        Test that ensures when transactions are ordered correctly when all the fields requested
        are from the same entity
        """
        metric_id = indexer.record("sentry.transactions.measurements.lcp")
        metric_id_fcp = indexer.record("sentry.transactions.measurements.fcp")
        transaction_id = indexer.record("transaction")
        transaction_1 = indexer.record("/foo/")
        transaction_2 = indexer.record("/bar/")

        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": metric_id,
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": numbers,
                    "tags": {tag: value},
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (transaction_id, transaction_1, [10, 11, 12]),
                    (transaction_id, transaction_2, [4, 5, 6]),
                )
            ],
            entity="metrics_distributions",
        )
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": metric_id_fcp,
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": numbers,
                    "tags": {tag: value},
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (transaction_id, transaction_1, [1, 2, 3]),
                    (transaction_id, transaction_2, [13, 14, 15]),
                )
            ],
            entity="metrics_distributions",
        )

        response = self.get_success_response(
            self.organization.slug,
            field=[
                "p50(sentry.transactions.measurements.lcp)",
                "p50(sentry.transactions.measurements.fcp)",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy=["project_id", "transaction"],
            orderBy="p50(sentry.transactions.measurements.lcp)",
        )
        groups = response.data["groups"]
        assert len(groups) == 2

        expected = [
            ("/bar/", 5.0, 14.0),
            ("/foo/", 11.0, 2.0),
        ]
        for (expected_tag_value, expected_lcp_count, expected_fcp_count), group in zip(
            expected, groups
        ):
            # With orderBy, you only get totals:
            assert "series" not in group
            assert group["by"] == {"transaction": expected_tag_value, "project_id": self.project.id}
            totals = group["totals"]
            assert totals == {
                "p50(sentry.transactions.measurements.lcp)": expected_lcp_count,
                "p50(sentry.transactions.measurements.fcp)": expected_fcp_count,
            }

    @with_feature(FEATURE_FLAG)
    def test_orderby_percentile_with_many_fields_multiple_entities(self):
        """
        Test that ensures when transactions are ordered correctly when all the fields requested
        are from multiple entities
        """
        transaction_id = indexer.record("transaction")
        transaction_1 = indexer.record("/foo/")
        transaction_2 = indexer.record("/bar/")

        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record("sentry.transactions.measurements.lcp"),
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": numbers,
                    "tags": {tag: value},
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (transaction_id, transaction_1, [10, 11, 12]),
                    (transaction_id, transaction_2, [4, 5, 6]),
                )
            ],
            entity="metrics_distributions",
        )
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record("sentry.transactions.user"),
                    "timestamp": int(time.time()),
                    "tags": {tag: value},
                    "type": "s",
                    "value": numbers,
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (transaction_id, transaction_1, list(range(1))),
                    (transaction_id, transaction_2, list(range(5))),
                )
            ],
            entity="metrics_sets",
        )

        response = self.get_success_response(
            self.organization.slug,
            field=[
                "p50(sentry.transactions.measurements.lcp)",
                "count_unique(sentry.transactions.user)",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy=["project_id", "transaction"],
            orderBy="p50(sentry.transactions.measurements.lcp)",
        )
        groups = response.data["groups"]
        assert len(groups) == 2

        expected = [
            ("/bar/", 5.0, 5),
            ("/foo/", 11.0, 1),
        ]
        for (expected_tag_value, expected_lcp_count, users), group in zip(expected, groups):
            # With orderBy, you only get totals:
            assert "series" not in group
            assert group["by"] == {"transaction": expected_tag_value, "project_id": self.project.id}
            totals = group["totals"]
            assert totals == {
                "p50(sentry.transactions.measurements.lcp)": expected_lcp_count,
                "count_unique(sentry.transactions.user)": users,
            }

    @with_feature(FEATURE_FLAG)
    def test_orderby_percentile_with_many_fields_multiple_entities_with_paginator(self):
        """
        Test that ensures when transactions are ordered correctly when all the fields requested
        are from multiple entities
        """
        transaction_id = indexer.record("transaction")
        transaction_1 = indexer.record("/foo/")
        transaction_2 = indexer.record("/bar/")

        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record("sentry.transactions.measurements.lcp"),
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": numbers,
                    "tags": {tag: value},
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (transaction_id, transaction_1, [10, 11, 12]),
                    (transaction_id, transaction_2, [4, 5, 6]),
                )
            ],
            entity="metrics_distributions",
        )
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record("sentry.transactions.user"),
                    "timestamp": int(time.time()),
                    "tags": {tag: value},
                    "type": "s",
                    "value": numbers,
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (transaction_id, transaction_1, list(range(1))),
                    (transaction_id, transaction_2, list(range(5))),
                )
            ],
            entity="metrics_sets",
        )

        request_args = {
            "field": [
                "p50(sentry.transactions.measurements.lcp)",
                "count_unique(sentry.transactions.user)",
            ],
            "statsPeriod": "1h",
            "interval": "1h",
            "datasource": "snuba",
            "groupBy": ["project_id", "transaction"],
            "orderBy": "p50(sentry.transactions.measurements.lcp)",
            "per_page": 1,
        }

        response = self.get_success_response(self.organization.slug, **request_args)
        groups = response.data["groups"]
        assert len(groups) == 1
        assert groups[0]["by"]["transaction"] == "/bar/"
        assert groups[0]["totals"] == {
            "count_unique(sentry.transactions.user)": 5,
            "p50(sentry.transactions.measurements.lcp)": 5.0,
        }

        request_args["cursor"] = Cursor(0, 1)

        response = self.get_success_response(self.organization.slug, **request_args)
        groups = response.data["groups"]
        assert len(groups) == 1
        assert groups[0]["by"]["transaction"] == "/foo/"
        assert groups[0]["totals"] == {
            "count_unique(sentry.transactions.user)": 1,
            "p50(sentry.transactions.measurements.lcp)": 11.0,
        }

    @with_feature(FEATURE_FLAG)
    def test_orderby_percentile_with_many_fields_multiple_entities_with_missing_data(self):
        """
        Test that ensures when transactions table has null values for some fields (i.e. fields
        with a different entity than the entity of the field in the order by), then the table gets
        populated accordingly
        """
        transaction_id = indexer.record("transaction")
        transaction_1 = indexer.record("/foo/")
        transaction_2 = indexer.record("/bar/")

        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record("sentry.transactions.measurements.lcp"),
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": numbers,
                    "tags": {tag: value},
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (transaction_id, transaction_1, [10, 11, 12]),
                    (transaction_id, transaction_2, [4, 5, 6]),
                )
            ],
            entity="metrics_distributions",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=[
                "p50(sentry.transactions.measurements.lcp)",
                "count_unique(sentry.transactions.user)",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy=["project_id", "transaction"],
            orderBy="p50(sentry.transactions.measurements.lcp)",
        )
        groups = response.data["groups"]
        assert len(groups) == 2

        expected = [
            ("/bar/", 5.0, 5),
            ("/foo/", 11.0, 1),
        ]
        for (expected_tag_value, expected_lcp_count, users), group in zip(expected, groups):
            # With orderBy, you only get totals:
            assert "series" not in group
            assert group["by"] == {"transaction": expected_tag_value, "project_id": self.project.id}
            totals = group["totals"]
            assert totals == {"p50(sentry.transactions.measurements.lcp)": expected_lcp_count}

    @with_feature(FEATURE_FLAG)
    def test_groupby_project(self):
        self.store_session(self.build_session(project_id=self.project2.id))
        for _ in range(2):
            self.store_session(self.build_session(project_id=self.project.id))

        response = self.get_response(
            self.organization.slug,
            statsPeriod="1h",
            interval="1h",
            field="sum(sentry.sessions.session)",
            groupBy=["project_id", "session.status"],
        )

        assert response.status_code == 200

        groups = response.data["groups"]
        assert len(groups) >= 2 and all(
            group["by"].keys() == {"project_id", "session.status"} for group in groups
        )

        expected = {
            self.project2.id: 1,
            self.project.id: 2,
        }
        for group in groups:
            expected_count = expected[group["by"]["project_id"]]
            totals = group["totals"]
            assert totals == {"sum(sentry.sessions.session)": expected_count}

    @with_feature(FEATURE_FLAG)
    def test_unknown_groupby(self):
        """Use a tag name in groupby that does not exist in the indexer"""
        # Insert session metrics:
        self.store_session(self.build_session(project_id=self.project.id))

        # "foo" is known by indexer, "bar" is not
        indexer.record("foo")

        response = self.get_success_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="1h",
            interval="1h",
            groupBy=["session.status", "foo"],
        )

        groups = response.data["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {"session.status": "init", "foo": None}

        response = self.get_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="1h",
            interval="1h",
            groupBy=["session.status", "bar"],
        )
        assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    @mock.patch(
        "sentry.api.endpoints.organization_metrics.OrganizationMetricsDataEndpoint.default_per_page",
        1,
    )
    def test_no_limit_with_series(self):
        """Pagination args do not apply to series"""
        for minute in range(4):
            self.store_session(
                self.build_session(
                    project_id=self.project.id, started=(time.time() // 60 - minute) * 60
                )
            )
        response = self.get_success_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="4m",
            interval="1m",
        )
        group = response.data["groups"][0]
        assert group["totals"]["sum(sentry.sessions.session)"] == 4
        assert group["series"]["sum(sentry.sessions.session)"] == [1, 1, 1, 1]

    @with_feature(FEATURE_FLAG)
    def test_unknown_filter(self):
        """Use a tag key/value in filter that does not exist in the indexer"""
        # Insert session metrics:
        self.store_session(self.build_session(project_id=self.project.id))

        response = self.get_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="1h",
            interval="1h",
            query="foo:123",  # Unknown tag key
        )
        assert response.status_code == 400

        response = self.get_success_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="1h",
            interval="1h",
            query="release:123",  # Unknown tag value is fine.
        )

        groups = response.data["groups"]
        assert len(groups) == 0


class OrganizationMetricMetaIntegrationTest(SessionMetricsTestCase, APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        now = int(time.time())

        # TODO: move _send to SnubaMetricsTestCase
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record("metric1"),
                    "timestamp": now,
                    "tags": {
                        indexer.record("tag1"): indexer.record("value1"),
                        indexer.record("tag2"): indexer.record("value2"),
                    },
                    "type": "c",
                    "value": 1,
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record("metric1"),
                    "timestamp": now,
                    "tags": {
                        indexer.record("tag3"): indexer.record("value3"),
                    },
                    "type": "c",
                    "value": 1,
                    "retention_days": 90,
                },
            ],
            entity="metrics_counters",
        )
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record("metric2"),
                    "timestamp": now,
                    "tags": {
                        indexer.record("tag4"): indexer.record("value3"),
                        indexer.record("tag1"): indexer.record("value2"),
                        indexer.record("tag2"): indexer.record("value1"),
                    },
                    "type": "s",
                    "value": [123],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record("metric3"),
                    "timestamp": now,
                    "tags": {},
                    "type": "s",
                    "value": [123],
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )


class OrganizationMetricsIndexIntegrationTest(OrganizationMetricMetaIntegrationTest):

    endpoint = "sentry-api-0-organization-metrics-index"

    @with_feature(FEATURE_FLAG)
    def test_metrics_index(self):
        """

        Note that this test will fail once we have a metrics meta store,
        because the setUp bypasses it.
        """

        response = self.get_success_response(
            self.organization.slug,
        )

        assert response.data == [
            {"name": "metric1", "type": "counter", "operations": ["sum"], "unit": None},
            {"name": "metric2", "type": "set", "operations": ["count_unique"], "unit": None},
            {"name": "metric3", "type": "set", "operations": ["count_unique"], "unit": None},
        ]


class OrganizationMetricDetailsIntegrationTest(OrganizationMetricMetaIntegrationTest):

    endpoint = "sentry-api-0-organization-metric-details"

    @with_feature(FEATURE_FLAG)
    def test_metric_details(self):
        # metric1:
        response = self.get_success_response(
            self.organization.slug,
            "metric1",
        )
        assert response.data == {
            "name": "metric1",
            "type": "counter",
            "operations": ["sum"],
            "unit": None,
            "tags": [
                {"key": "tag1"},
                {"key": "tag2"},
                {"key": "tag3"},
            ],
        }

        # metric2:
        response = self.get_success_response(
            self.organization.slug,
            "metric2",
        )
        assert response.data == {
            "name": "metric2",
            "type": "set",
            "operations": ["count_unique"],
            "unit": None,
            "tags": [
                {"key": "tag1"},
                {"key": "tag2"},
                {"key": "tag4"},
            ],
        }

        # metric3:
        response = self.get_success_response(
            self.organization.slug,
            "metric3",
        )
        assert response.data == {
            "name": "metric3",
            "type": "set",
            "operations": ["count_unique"],
            "unit": None,
            "tags": [],
        }


class OrganizationMetricsTagsIntegrationTest(OrganizationMetricMetaIntegrationTest):

    endpoint = "sentry-api-0-organization-metrics-tags"

    @with_feature(FEATURE_FLAG)
    def test_metric_tags(self):
        response = self.get_success_response(
            self.organization.slug,
        )
        assert response.data == [
            {"key": "tag1"},
            {"key": "tag2"},
            {"key": "tag3"},
            {"key": "tag4"},
        ]

        # When metric names are supplied, get intersection of tag names:
        response = self.get_success_response(
            self.organization.slug,
            metric=["metric1", "metric2"],
        )
        assert response.data == [
            {"key": "tag1"},
            {"key": "tag2"},
        ]

        response = self.get_success_response(
            self.organization.slug,
            metric=["metric1", "metric2", "metric3"],
        )
        assert response.data == []


class OrganizationMetricsTagDetailsIntegrationTest(OrganizationMetricMetaIntegrationTest):

    endpoint = "sentry-api-0-organization-metrics-tag-details"

    @with_feature(FEATURE_FLAG)
    def test_unknown_tag(self):
        indexer.record("bar")
        response = self.get_success_response(self.project.organization.slug, "bar")
        assert response.data == []

    @with_feature(FEATURE_FLAG)
    def test_non_existing_tag(self):
        response = self.get_response(self.project.organization.slug, "bar")
        assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_non_existing_filter(self):
        indexer.record("bar")
        response = self.get_response(self.project.organization.slug, "bar", metric="bad")
        assert response.status_code == 200
        assert response.data == []

    @with_feature(FEATURE_FLAG)
    def test_metric_tag_details(self):
        response = self.get_success_response(
            self.organization.slug,
            "tag1",
        )
        assert response.data == [
            {"key": "tag1", "value": "value1"},
            {"key": "tag1", "value": "value2"},
        ]

        # When single metric_name is supplied, get only tag values for that metric:
        response = self.get_success_response(
            self.organization.slug,
            "tag1",
            metric=["metric1"],
        )
        assert response.data == [
            {"key": "tag1", "value": "value1"},
        ]

        # When metric names are supplied, get intersection of tags:
        response = self.get_success_response(
            self.organization.slug,
            "tag1",
            metric=["metric1", "metric2"],
        )
        assert response.data == []
