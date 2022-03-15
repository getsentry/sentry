import time
from datetime import timedelta
from typing import Optional
from unittest import mock
from unittest.mock import patch

from django.utils import timezone
from freezegun import freeze_time

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.sessions import SessionMetricKey
from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.utils.cursors import Cursor
from tests.sentry.api.endpoints.test_organization_metrics import MOCKED_DERIVED_METRICS


class OrganizationMetricDataTest(MetricsAPIBaseTestCase):
    endpoint = "sentry-api-0-organization-metrics-data"

    def setUp(self):
        super().setUp()
        self.project2 = self.create_project()
        self.login_as(user=self.user)

    def test_missing_field(self):
        response = self.get_response(self.project.organization.slug)
        assert response.status_code == 400
        assert response.json()["detail"] == 'Request is missing a "field"'

    def test_invalid_field(self):
        for field in ["", "(*&%", "foo(session", "foo(session)"]:
            response = self.get_response(self.project.organization.slug, field=field)
            assert response.status_code == 400

    def test_groupby_single(self):
        indexer.record("environment")
        response = self.get_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            groupBy="environment",
        )

        assert response.status_code == 200

    def test_invalid_filter(self):
        query = "release:foo or "
        response = self.get_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            groupBy="environment",
            query=query,
        )
        assert response.status_code == 400, query

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

    def test_orderby_unknown(self):
        response = self.get_response(
            self.project.organization.slug, field="sum(sentry.sessions.session)", orderBy="foo"
        )
        assert response.status_code == 400

    def test_orderby_tag(self):
        """Order by tag is not supported (yet)"""
        response = self.get_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)", "environment"],
            groupBy="environment",
            orderBy="environment",
        )
        assert response.status_code == 400

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

    def test_statsperiod_invalid(self):
        response = self.get_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="",
        )
        assert response.status_code == 400

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
            assert group["by"] == {"transaction": expected_transaction}
            assert group["series"] == {
                "count(sentry.transactions.measurements.lcp)": [expected_count]
            }
            assert group["totals"] == {
                "count(sentry.transactions.measurements.lcp)": expected_count
            }

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
            assert group["by"] == {"tag1": expected_tag_value}
            assert group["totals"] == {"p50(sentry.transactions.measurements.lcp)": expected_count}
            assert group["series"] == {
                "p50(sentry.transactions.measurements.lcp)": [expected_count]
            }

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
            assert group["by"] == {"transaction": expected_tag_value, "project_id": self.project.id}
            assert group["totals"] == {
                "p50(sentry.transactions.measurements.lcp)": expected_lcp_count,
                "p50(sentry.transactions.measurements.fcp)": expected_fcp_count,
            }
            assert group["series"] == {
                "p50(sentry.transactions.measurements.lcp)": [expected_lcp_count],
                "p50(sentry.transactions.measurements.fcp)": [expected_fcp_count],
            }

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
            assert group["by"] == {"transaction": expected_tag_value, "project_id": self.project.id}
            assert group["totals"] == {
                "p50(sentry.transactions.measurements.lcp)": expected_lcp_count,
                "count_unique(sentry.transactions.user)": users,
            }
            assert group["series"] == {
                "p50(sentry.transactions.measurements.lcp)": [expected_lcp_count],
                "count_unique(sentry.transactions.user)": [users],
            }

    @freeze_time((timezone.now() - timedelta(days=2)).replace(hour=3, minute=21, second=34))
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
        user_metric = indexer.record("sentry.transactions.user")
        user_ts = time.time()
        for ts, ranges in [
            (int(user_ts), [range(4, 5), range(6, 11)]),
            (int(user_ts // 60 - 15) * 60, [range(3), range(6)]),
        ]:
            self._send_buckets(
                [
                    {
                        "org_id": self.organization.id,
                        "project_id": self.project.id,
                        "metric_id": user_metric,
                        "timestamp": ts,
                        "tags": {tag: value},
                        "type": "s",
                        "value": numbers,
                        "retention_days": 90,
                    }
                    for tag, value, numbers in (
                        (transaction_id, transaction_1, list(ranges[0])),
                        (transaction_id, transaction_2, list(ranges[1])),
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
            "interval": "10m",
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
            "count_unique(sentry.transactions.user)": 11,
            "p50(sentry.transactions.measurements.lcp)": 5.0,
        }
        assert groups[0]["series"] == {
            "p50(sentry.transactions.measurements.lcp)": [None, None, None, None, None, 5.0],
            "count_unique(sentry.transactions.user)": [0, 0, 0, 6, 0, 5],
        }

        request_args["cursor"] = Cursor(0, 1)

        response = self.get_success_response(self.organization.slug, **request_args)
        groups = response.data["groups"]
        assert len(groups) == 1
        assert groups[0]["by"]["transaction"] == "/foo/"
        assert groups[0]["totals"] == {
            "count_unique(sentry.transactions.user)": 4,
            "p50(sentry.transactions.measurements.lcp)": 11.0,
        }
        assert groups[0]["series"] == {
            "p50(sentry.transactions.measurements.lcp)": [None, None, None, None, None, 11.0],
            "count_unique(sentry.transactions.user)": [0, 0, 0, 3, 0, 1],
        }

    def test_series_are_limited_to_total_order_in_case_with_one_field_orderby(self):
        # Create time series [1, 2, 3, 4] for every release:
        for minute in range(4):
            for _ in range(minute + 1):
                # One for each release
                for release in ("foo", "bar", "baz"):
                    self.store_session(
                        self.build_session(
                            project_id=self.project.id,
                            started=(time.time() // 60 - 3 + minute) * 60,
                            release=release,
                        )
                    )
        response = self.get_success_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="4m",
            interval="1m",
            groupBy="release",
            orderBy="-sum(sentry.sessions.session)",
            per_page=1,  # limit to a single page
        )

        for group in response.data["groups"]:
            assert group["series"]["sum(sentry.sessions.session)"] == [1, 2, 3, 4]

        assert len(response.data["groups"]) == 1

    def test_one_field_orderby_with_no_groupby_returns_one_row(self):
        # Create time series [1, 2, 3, 4] for every release:
        for minute in range(4):
            for _ in range(minute + 1):
                # One for each release
                for release in ("foo", "bar", "baz"):
                    self.store_session(
                        self.build_session(
                            project_id=self.project.id,
                            started=(time.time() // 60 - 3 + minute) * 60,
                            release=release,
                        )
                    )
        response = self.get_success_response(
            self.organization.slug,
            field=["sum(sentry.sessions.session)", "count_unique(sentry.sessions.session.user)"],
            statsPeriod="4m",
            interval="1m",
            orderBy="-sum(sentry.sessions.session)",
            per_page=1,  # limit to a single page
        )

        for group in response.data["groups"]:
            assert group["series"]["sum(sentry.sessions.session)"] == [3, 6, 9, 12]

        assert len(response.data["groups"]) == 1

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
            assert group["by"] == {"transaction": expected_tag_value, "project_id": self.project.id}
            assert group["totals"] == {
                "count_unique(sentry.transactions.user)": 0,
                "p50(sentry.transactions.measurements.lcp)": expected_lcp_count,
            }
            assert group["series"] == {
                "count_unique(sentry.transactions.user)": [0],
                "p50(sentry.transactions.measurements.lcp)": [expected_lcp_count],
            }

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

    @mock.patch(
        "sentry.api.endpoints.organization_metrics.OrganizationMetricsDataEndpoint.default_per_page",
        1,
    )
    @freeze_time((timezone.now() - timedelta(days=2)).replace(hour=3, minute=21, second=30))
    def test_no_limit_with_series(self):
        """Pagination args do not apply to series"""
        indexer.record("session.status")
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
        assert len(groups) == 1
        assert groups[0]["totals"]["sum(sentry.sessions.session)"] == 0
        assert groups[0]["series"]["sum(sentry.sessions.session)"] == [0]


class DerivedMetricsDataTest(MetricsAPIBaseTestCase):
    endpoint = "sentry-api-0-organization-metrics-data"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    @patch("sentry.snuba.metrics.query_builder.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    def test_derived_metric_incorrectly_defined_as_singular_entity(self):
        for status in ["ok", "crashed"]:
            for minute in range(4):
                self.store_session(
                    self.build_session(
                        project_id=self.project.id,
                        started=(time.time() // 60 - minute) * 60,
                        status=status,
                    )
                )
        response = self.get_response(
            self.organization.slug,
            field=["crash_free_fake"],
            statsPeriod="6m",
            interval="1m",
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            "Derived Metric crash_free_fake cannot be calculated from a single entity"
        )

    @freeze_time((timezone.now() - timedelta(days=2)).replace(hour=3, minute=26, second=31))
    def test_crash_free_percentage(self):
        for status in ["ok", "crashed"]:
            for minute in range(4):
                self.store_session(
                    self.build_session(
                        project_id=self.project.id,
                        started=(time.time() // 60 - minute) * 60,
                        status=status,
                    )
                )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.crash_free_rate", "session.init", "session.crashed"],
            statsPeriod="6m",
            interval="1m",
        )
        group = response.data["groups"][0]
        assert group["totals"]["session.crash_free_rate"] == 50
        assert group["totals"]["session.init"] == 8
        assert group["totals"]["session.crashed"] == 4
        assert group["series"]["session.crash_free_rate"] == [None, None, 50, 50, 50, 50]

    @freeze_time((timezone.now() - timedelta(days=2)).replace(hour=3, minute=26, second=31))
    def test_crash_free_percentage_with_orderby(self):
        for status in ["ok", "crashed"]:
            for minute in range(4):
                self.store_session(
                    self.build_session(
                        project_id=self.project.id,
                        started=(time.time() // 60 - minute) * 60,
                        status=status,
                        release="foobar@1.0",
                    )
                )
        for minute in range(4):
            self.store_session(
                self.build_session(
                    project_id=self.project.id,
                    started=(time.time() // 60 - minute) * 60,
                    status="ok",
                    release="foobar@2.0",
                )
            )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.crash_free_rate"],
            statsPeriod="6m",
            interval="1m",
            groupBy="release",
            orderBy="-session.crash_free_rate",
        )
        group = response.data["groups"][0]
        assert group["by"]["release"] == "foobar@2.0"
        assert group["totals"]["session.crash_free_rate"] == 100
        assert group["series"]["session.crash_free_rate"] == [None, None, 100, 100, 100, 100]

        group = response.data["groups"][1]
        assert group["by"]["release"] == "foobar@1.0"
        assert group["totals"]["session.crash_free_rate"] == 50
        assert group["series"]["session.crash_free_rate"] == [None, None, 50, 50, 50, 50]

    def test_crash_free_rate_when_no_session_metrics_data_exist(self):
        response = self.get_success_response(
            self.organization.slug,
            project=[self.project.id],
            field=["session.crash_free_rate", "sum(sentry.sessions.session)"],
            statsPeriod="6m",
            interval="6m",
            orderBy="-session.crash_free_rate",
        )
        group = response.data["groups"][0]
        assert group["totals"]["session.crash_free_rate"] is None
        assert group["totals"]["sum(sentry.sessions.session)"] == 0
        assert group["series"]["sum(sentry.sessions.session)"] == [0]
        assert group["series"]["session.crash_free_rate"] == [None]

    def test_crash_free_rate_when_no_session_metrics_data_with_orderby_and_groupby(self):
        indexer.record("release")
        response = self.get_success_response(
            self.organization.slug,
            project=[self.project.id],
            field=["session.crash_free_rate", "sum(sentry.sessions.session)"],
            statsPeriod="6m",
            interval="6m",
            groupBy=["release"],
            orderBy="-session.crash_free_rate",
        )
        assert response.data["groups"] == []

    def test_incorrect_crash_free_rate(self):
        response = self.get_response(
            self.organization.slug,
            field=["sum(session.crash_free_rate)"],
            statsPeriod="6m",
            interval="1m",
        )
        assert (response.json()["detail"]) == (
            "Failed to parse sum(session.crash_free_rate). No operations can be applied on this "
            "field as it is already a derived metric with an aggregation applied to it."
        )

    def test_errored_sessions(self):
        session_metric = indexer.record(SessionMetricKey.SESSION.value)
        indexer.record("sentry.sessions.session.duration")
        indexer.record("sentry.sessions.user")
        session_error_metric = indexer.record("sentry.sessions.session.error")
        session_status_tag = indexer.record("session.status")
        release_tag = indexer.record("release")
        user_ts = time.time()
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": session_metric,
                    "timestamp": (user_ts // 60 - 4) * 60,
                    "tags": {
                        session_status_tag: indexer.record("errored_preaggr"),
                        release_tag: indexer.record("foo"),
                    },
                    "type": "c",
                    "value": 4,
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": session_metric,
                    "timestamp": user_ts,
                    "tags": {
                        session_status_tag: indexer.record("init"),
                        release_tag: indexer.record("foo"),
                    },
                    "type": "c",
                    "value": 10,
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
                    "metric_id": session_error_metric,
                    "timestamp": user_ts,
                    "tags": {tag: value},
                    "type": "s",
                    "value": numbers,
                    "retention_days": 90,
                }
                for tag, value, numbers in ((release_tag, indexer.record("foo"), list(range(3))),)
            ],
            entity="metrics_sets",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.errored_preaggregated", "session.errored_set"],
            statsPeriod="6m",
            interval="1m",
        )
        group = response.data["groups"][0]
        assert group["totals"]["session.errored_set"] == 3
        assert group["totals"]["session.errored_preaggregated"] == 4
