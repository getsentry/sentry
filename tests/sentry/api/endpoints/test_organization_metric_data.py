import time
from datetime import datetime, timedelta
from typing import Optional
from unittest import mock
from unittest.mock import patch

from django.utils import timezone
from freezegun import freeze_time

from sentry.sentry_metrics import indexer
from sentry.snuba.metrics.naming_layer.mri import SessionMRI, TransactionMRI
from sentry.snuba.metrics.naming_layer.public import (
    SessionMetricKey,
    TransactionMetricKey,
    TransactionSatisfactionTagValue,
    TransactionStatusTagValue,
    TransactionTagsKey,
)
from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.utils.cursors import Cursor
from tests.sentry.api.endpoints.test_organization_metrics import MOCKED_DERIVED_METRICS


class OrganizationMetricDataTest(MetricsAPIBaseTestCase):
    endpoint = "sentry-api-0-organization-metrics-data"

    def setUp(self):
        super().setUp()
        self.project2 = self.create_project()
        self.login_as(user=self.user)

        self.transaction_lcp_metric = indexer.record(
            self.project.organization.id, TransactionMRI.MEASUREMENTS_LCP.value
        )
        org_id = self.organization.id
        self.session_metric = indexer.record(org_id, SessionMRI.SESSION.value)
        self.session_error_metric = indexer.record(org_id, SessionMRI.ERROR.value)

    def test_missing_field(self):
        response = self.get_response(self.project.organization.slug)
        assert response.status_code == 400
        assert response.json()["detail"] == 'Request is missing a "field"'

    def test_invalid_field(self):
        for field in ["", "(*&%", "foo(session", "foo(session)"]:
            response = self.get_response(self.project.organization.slug, field=field)
            assert response.status_code == 400

    def test_groupby_single(self):
        indexer.record(self.project.organization_id, "environment")
        response = self.get_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            groupBy="environment",
        )

        assert response.status_code == 200

    def test_groupby_session_status(self):
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
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            groupBy="session.status",
            statsPeriod="1h",
            interval="1h",
        )
        assert response.data["detail"] == (
            "Tag name session.status cannot be used to groupBy query"
        )

    def test_filter_session_status(self):
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
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            query="session.status:crashed",
            statsPeriod="1h",
            interval="1h",
        )
        assert response.data["detail"] == ("Tag name session.status is not a valid query filter")

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
        self.create_release(version="foo", project=self.project)
        for tag in ("release", "environment"):
            indexer.record(self.project.organization_id, tag)
        query = "release:latest"
        response = self.get_success_response(
            self.project.organization.slug,
            project=self.project.id,
            field="sum(sentry.sessions.session)",
            groupBy="environment",
            query=query,
        )
        assert response.data.keys() == {"start", "end", "query", "intervals", "groups", "meta"}

    def test_validate_include_meta_not_enabled_by_default(self):
        self.create_release(version="foo", project=self.project)
        for tag in ("release", "environment"):
            indexer.record(self.project.organization_id, tag)
        response = self.get_success_response(
            self.project.organization.slug,
            project=self.project.id,
            field="sum(sentry.sessions.session)",
            groupBy="environment",
            query="",
        )
        assert response.data["meta"] == []

    def test_orderby_unknown(self):
        response = self.get_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            orderBy="foo",
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

    def test_date_range_too_long(self):
        response = self.get_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            interval="10s",
            statsPeriod="90d",
            per_page=1,
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            "Your interval and date range would create too many results. Use a larger interval, "
            "or a smaller date range."
        )

    def test_interval_must_be_multiple_of_smallest_interval(self):
        response = self.get_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            interval="15s",
            statsPeriod="1d",
            per_page=1,
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            "The interval has to be a multiple of the minimum interval of ten seconds."
        )

    def test_interval_should_divide_day_with_no_remainder(self):
        response = self.get_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            interval="3610s",
            statsPeriod="2d",
            per_page=1,
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            "The interval should divide one day without a remainder."
        )

    def test_filter_by_project_slug(self):
        p = self.create_project(name="sentry2")
        p2 = self.create_project(name="sentry3")

        for minute in range(2):
            self.store_session(
                self.build_session(
                    project_id=self.project.id,
                    started=(time.time() // 60 - minute) * 60,
                    status="ok",
                )
            )
        for minute in range(3):
            self.store_session(
                self.build_session(
                    project_id=p.id,
                    started=(time.time() // 60 - minute) * 60,
                    status="ok",
                )
            )
        for minute in range(5):
            self.store_session(
                self.build_session(
                    project_id=p2.id,
                    started=(time.time() // 60 - minute) * 60,
                    status="ok",
                )
            )

        response = self.get_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            project=[p.id, p2.id, self.project.id],
            query="project:[sentry2,sentry3]",
            interval="24h",
            statsPeriod="24h",
        )
        assert response.status_code == 200
        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {"sum(sentry.sessions.session)": 8},
                "series": {"sum(sentry.sessions.session)": [8]},
            }
        ]

    def test_group_by_project(self):
        prj_foo = self.create_project(name="foo")
        prj_boo = self.create_project(name="boo")

        for minute in range(2):
            self.store_session(
                self.build_session(
                    project_id=self.project.id,
                    started=(time.time() // 60 - minute) * 60,
                    status="ok",
                )
            )
        for minute in range(3):
            self.store_session(
                self.build_session(
                    project_id=prj_foo.id,
                    started=(time.time() // 60 - minute) * 60,
                    status="ok",
                )
            )
        for minute in range(5):
            self.store_session(
                self.build_session(
                    project_id=prj_boo.id,
                    started=(time.time() // 60 - minute) * 60,
                    status="ok",
                )
            )

        response = self.get_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            project=[prj_foo.id, prj_boo.id, self.project.id],
            interval="24h",
            statsPeriod="24h",
            groupBy="project",
        )
        assert response.status_code == 200
        expected_output = {
            prj_foo.id: {
                "by": {"project_id": prj_foo.id},
                "series": {"sum(sentry.sessions.session)": [3.0]},
                "totals": {"sum(sentry.sessions.session)": 3.0},
            },
            self.project.id: {
                "by": {"project_id": self.project.id},
                "series": {"sum(sentry.sessions.session)": [2.0]},
                "totals": {"sum(sentry.sessions.session)": 2.0},
            },
            prj_boo.id: {
                "by": {"project_id": prj_boo.id},
                "series": {"sum(sentry.sessions.session)": [5.0]},
                "totals": {"sum(sentry.sessions.session)": 5.0},
            },
        }
        for grp in response.data["groups"]:
            prj_id = grp["by"]["project_id"]
            assert grp == expected_output[prj_id]

    def test_pagination_limit_without_orderby(self):
        """
        Test that ensures a successful response is returned even when sending a per_page
        without an orderBy
        """
        response = self.get_response(
            self.organization.slug,
            field=f"count({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            groupBy="transaction",
            per_page=2,
        )
        assert response.status_code == 200

    def test_pagination_offset_without_orderby(self):
        """
        Test that ensures a successful response is returned even when requesting an offset
        without an orderBy
        """
        response = self.get_response(
            self.organization.slug,
            field=f"count({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            groupBy="transaction",
            cursor=Cursor(0, 1),
            statsPeriod="1h",
        )
        assert response.status_code == 200, response.data

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
        org_id = self.organization.id
        k_transaction = indexer.record(org_id, "transaction")
        v_foo = indexer.record(org_id, "/foo")
        v_bar = indexer.record(org_id, "/bar")
        v_baz = indexer.record(org_id, "/baz")
        k_rating = indexer.record(org_id, "measurement_rating")
        v_good = indexer.record(org_id, "good")
        v_meh = indexer.record(org_id, "meh")
        v_poor = indexer.record(org_id, "poor")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.transaction_lcp_metric,
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
            field=f"count({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            query="measurement_rating:poor",
            statsPeriod="1h",
            interval="1h",
            groupBy="transaction",
            orderBy=f"-count({TransactionMetricKey.MEASUREMENTS_LCP.value})",
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
                f"count({TransactionMetricKey.MEASUREMENTS_LCP.value})": [expected_count]
            }
            assert group["totals"] == {
                f"count({TransactionMetricKey.MEASUREMENTS_LCP.value})": expected_count
            }

    def test_orderby_percentile(self):
        # Record some strings
        org_id = self.organization.id
        tag1 = indexer.record(org_id, "tag1")
        value1 = indexer.record(org_id, "value1")
        value2 = indexer.record(org_id, "value2")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.transaction_lcp_metric,
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
            field=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            statsPeriod="1h",
            interval="1h",
            groupBy="tag1",
            orderBy=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
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
            assert group["totals"] == {
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": expected_count
            }
            assert group["series"] == {
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": [expected_count]
            }

    def test_orderby_percentile_with_pagination(self):
        org_id = self.organization.id
        tag1 = indexer.record(org_id, "tag1")
        value1 = indexer.record(org_id, "value1")
        value2 = indexer.record(org_id, "value2")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.transaction_lcp_metric,
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
            field=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            statsPeriod="1h",
            interval="1h",
            groupBy="tag1",
            orderBy=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            per_page=1,
        )
        groups = response.data["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {"tag1": "value2"}
        assert groups[0]["totals"] == {f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": 2}

        response = self.get_success_response(
            self.organization.slug,
            field=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            statsPeriod="1h",
            interval="1h",
            groupBy="tag1",
            orderBy=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            per_page=1,
            cursor=Cursor(0, 1),
        )
        groups = response.data["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {"tag1": "value1"}
        assert groups[0]["totals"] == {f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": 5}

    def test_limit_with_orderby_is_overridden_by_paginator_limit(self):
        """
        Test that ensures when an `orderBy` clause is set, then the paginator limit overrides the
        `limit` parameter
        """
        org_id = self.organization.id
        tag1 = indexer.record(org_id, "tag1")
        value1 = indexer.record(org_id, "value1")
        value2 = indexer.record(org_id, "value2")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.transaction_lcp_metric,
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
            field=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            statsPeriod="1h",
            interval="1h",
            groupBy="tag1",
            orderBy=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            per_page=1,
        )
        groups = response.data["groups"]
        assert len(groups) == 1

    def test_orderby_percentile_with_many_fields_one_entity_no_data(self):
        """
        Test that ensures that when metrics data is available then an empty response is returned
        gracefully
        """
        for metric in [
            TransactionMRI.MEASUREMENTS_FCP.value,
            "transaction",
        ]:
            indexer.record(self.organization.id, metric)

        response = self.get_success_response(
            self.organization.slug,
            field=[
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"p50({TransactionMetricKey.MEASUREMENTS_FCP.value})",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy=["project_id", "transaction"],
            orderBy=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
        )
        groups = response.data["groups"]
        assert len(groups) == 0

    def test_orderby_percentile_with_many_fields_one_entity(self):
        """
        Test that ensures when transactions are ordered correctly when all the fields requested
        are from the same entity
        """
        org_id = self.organization.id
        metric_id_fcp = indexer.record(org_id, TransactionMRI.MEASUREMENTS_FCP.value)
        transaction_id = indexer.record(org_id, "transaction")
        transaction_1 = indexer.record(org_id, "/foo/")
        transaction_2 = indexer.record(org_id, "/bar/")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.transaction_lcp_metric,
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
                    "org_id": org_id,
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
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"p50({TransactionMetricKey.MEASUREMENTS_FCP.value})",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy=["project_id", "transaction"],
            orderBy=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
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
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": expected_lcp_count,
                f"p50({TransactionMetricKey.MEASUREMENTS_FCP.value})": expected_fcp_count,
            }
            assert group["series"] == {
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": [expected_lcp_count],
                f"p50({TransactionMetricKey.MEASUREMENTS_FCP.value})": [expected_fcp_count],
            }

    def test_orderby_percentile_with_many_fields_multiple_entities(self):
        """
        Test that ensures when transactions are ordered correctly when all the fields requested
        are from multiple entities
        """
        org_id = self.organization.id
        transaction_id = indexer.record(org_id, "transaction")
        transaction_1 = indexer.record(org_id, "/foo/")
        transaction_2 = indexer.record(org_id, "/bar/")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.transaction_lcp_metric,
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
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": indexer.record(org_id, TransactionMRI.USER.value),
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
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"count_unique({TransactionMetricKey.USER.value})",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy=["project_id", "transaction"],
            orderBy=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
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
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": expected_lcp_count,
                f"count_unique({TransactionMetricKey.USER.value})": users,
            }
            assert group["series"] == {
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": [expected_lcp_count],
                f"count_unique({TransactionMetricKey.USER.value})": [users],
            }

    @freeze_time((timezone.now() - timedelta(days=2)).replace(hour=3, minute=21, second=34))
    def test_orderby_percentile_with_many_fields_multiple_entities_with_paginator(self):
        """
        Test that ensures when transactions are ordered correctly when all the fields requested
        are from multiple entities
        """
        org_id = self.organization.id
        transaction_id = indexer.record(org_id, "transaction")
        transaction_1 = indexer.record(org_id, "/foo/")
        transaction_2 = indexer.record(org_id, "/bar/")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.transaction_lcp_metric,
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
        user_metric = indexer.record(org_id, TransactionMRI.USER.value)
        user_ts = time.time()
        for ts, ranges in [
            (int(user_ts), [range(4, 5), range(6, 11)]),
            (int(user_ts // 60 - 15) * 60, [range(3), range(6)]),
        ]:
            self._send_buckets(
                [
                    {
                        "org_id": org_id,
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
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"count_unique({TransactionMetricKey.USER.value})",
            ],
            "statsPeriod": "1h",
            "interval": "10m",
            "datasource": "snuba",
            "groupBy": ["project_id", "transaction"],
            "orderBy": f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            "per_page": 1,
        }

        response = self.get_success_response(self.organization.slug, **request_args)
        groups = response.data["groups"]
        assert len(groups) == 1
        assert groups[0]["by"]["transaction"] == "/bar/"
        assert groups[0]["totals"] == {
            f"count_unique({TransactionMetricKey.USER.value})": 11,
            f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": 5.0,
        }
        assert groups[0]["series"] == {
            f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": [
                None,
                None,
                None,
                None,
                None,
                5.0,
            ],
            f"count_unique({TransactionMetricKey.USER.value})": [0, 0, 0, 6, 0, 5],
        }

        request_args["cursor"] = Cursor(0, 1)

        response = self.get_success_response(self.organization.slug, **request_args)
        groups = response.data["groups"]
        assert len(groups) == 1
        assert groups[0]["by"]["transaction"] == "/foo/"
        assert groups[0]["totals"] == {
            f"count_unique({TransactionMetricKey.USER.value})": 4,
            f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": 11.0,
        }
        assert groups[0]["series"] == {
            f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": [
                None,
                None,
                None,
                None,
                None,
                11.0,
            ],
            f"count_unique({TransactionMetricKey.USER.value})": [0, 0, 0, 3, 0, 1],
        }

    @freeze_time((datetime.now() - timedelta(hours=1)).replace(minute=30))
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
            field=[
                "sum(sentry.sessions.session)",
                "count_unique(sentry.sessions.user)",
            ],
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
        org_id = self.organization.id
        transaction_id = indexer.record(org_id, "transaction")
        transaction_1 = indexer.record(org_id, "/foo/")
        transaction_2 = indexer.record(org_id, "/bar/")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.transaction_lcp_metric,
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
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"count_unique({TransactionMetricKey.USER.value})",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy=["project_id", "transaction"],
            orderBy=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
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
                f"count_unique({TransactionMetricKey.USER.value})": 0,
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": expected_lcp_count,
            }
            assert group["series"] == {
                f"count_unique({TransactionMetricKey.USER.value})": [0],
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})": [expected_lcp_count],
            }

    def test_limit_without_orderby(self):
        """
        Test that ensures when an `orderBy` clause is not set, then we still get groups that fit
        within the limit, and that are also with complete data from across the entities
        """
        org_id = self.organization.id

        fcp_metric = indexer.record(
            self.project.organization.id, TransactionMRI.MEASUREMENTS_FCP.value
        )
        tag3 = indexer.record(org_id, "tag3")
        value1 = indexer.record(org_id, "value1")
        value2 = indexer.record(org_id, "value2")
        value3 = indexer.record(org_id, "value3")
        value4 = indexer.record(org_id, "value4")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": int(time.time()),
                    "tags": {tag3: value1},
                    "type": "c",
                    "value": 10,
                    "retention_days": 90,
                }
            ],
            entity="metrics_counters",
        )
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": fcp_metric,
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": [1],
                    "tags": {tag3: value},
                    "retention_days": 90,
                }
                for value in (
                    value2,
                    value3,
                    value4,
                )
            ],
            entity="metrics_distributions",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=[
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"p50({TransactionMetricKey.MEASUREMENTS_FCP.value})",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy="tag3",
            per_page=2,
        )

        groups = response.data["groups"]
        assert len(groups) == 2

        # we don't know which of {value2, value3, value4} is returned, just that
        # it can't be `value1`, which is only on the other metric
        returned_values = {group["by"]["tag3"] for group in groups}
        assert "value1" not in returned_values, returned_values

    def test_limit_without_orderby_excess_groups_pruned(self):
        """
        Test that ensures that when requesting series data that is not ordered, if the limit of
        each query is not met, thereby a limit is not applied to the aueries and we end up with
        more groups than the limit then the excess number of groups should be pruned
        """
        org_id = self.organization.id
        user_ts = time.time()

        tag1 = indexer.record(org_id, "tag1")
        group1 = indexer.record(org_id, "group1")
        group2 = indexer.record(org_id, "group2")
        group3 = indexer.record(org_id, "group3")
        group4 = indexer.record(org_id, "group4")
        group5 = indexer.record(org_id, "group5")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60 - 4) * 60,
                    "tags": {tag: tag_value},
                    "type": "c",
                    "value": 10,
                    "retention_days": 90,
                }
                for tag, tag_value in ((tag1, group1), (tag1, group2))
            ],
            entity="metrics_counters",
        )
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_error_metric,
                    "timestamp": user_ts,
                    "tags": {tag: value},
                    "type": "s",
                    "value": numbers,
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (tag1, group2, list(range(3))),
                    (tag1, group3, list(range(3, 6))),
                )
            ],
            entity="metrics_sets",
        )
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.transaction_lcp_metric,
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": numbers,
                    "tags": {tag: value},
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (tag1, group4, list(range(3))),
                    (tag1, group5, list(range(3, 6))),
                )
            ],
            entity="metrics_distributions",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=[
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"p50({TransactionMetricKey.MEASUREMENTS_FCP.value})",
                SessionMetricKey.ERRORED.value,
                "sum(sentry.sessions.session)",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy="tag1",
            per_page=3,
        )

        groups = response.data["groups"]
        assert len(groups) == 3

    def test_limit_without_orderby_partial_groups_pruned(self):
        """
        Test that ensures that when requesting series data that is not ordered, if the limit of
        each query is met, thereby a limit is applied to the queries and we end up with
        with groups that have complete data across all entities
        """
        org_id = self.organization.id
        user_ts = time.time()

        tag2 = indexer.record(org_id, "tag2")
        b1 = indexer.record(org_id, "B1")
        b2 = indexer.record(org_id, "B2")
        b3 = indexer.record(org_id, "B3")
        c1 = indexer.record(org_id, "C1")
        a1 = indexer.record(org_id, "A1")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60 - 4) * 60,
                    "tags": {tag: tag_value},
                    "type": "c",
                    "value": 10,
                    "retention_days": 90,
                }
                for tag, tag_value in (
                    (tag2, a1),
                    (tag2, b1),
                    (tag2, c1),
                )
            ],
            entity="metrics_counters",
        )
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_error_metric,
                    "timestamp": user_ts,
                    "tags": {tag: value},
                    "type": "s",
                    "value": numbers,
                    "retention_days": 90,
                }
                for tag, value, numbers in [
                    (tag2, b2, list(range(3))),
                    (tag2, b3, list(range(3, 6))),
                    (tag2, c1, list(range(6, 9))),
                    (tag2, b1, list(range(18, 21))),
                ]
            ],
            entity="metrics_sets",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=[
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"p50({TransactionMetricKey.MEASUREMENTS_FCP.value})",
                SessionMetricKey.ERRORED.value,
                "sum(sentry.sessions.session)",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy="tag2",
            per_page=3,
        )

        groups = response.data["groups"]
        assert len(groups) == 3
        returned_values = {group["by"]["tag2"] for group in groups}
        # We need to make sure that returned groups are a subset of the groups returned by the
        # metrics_sets to ensure we get groups with no partial results
        assert returned_values.issubset({"B1", "B2", "B3", "C1"})

    def test_groupby_project(self):
        self.store_session(self.build_session(project_id=self.project2.id))
        for _ in range(2):
            self.store_session(self.build_session(project_id=self.project.id))

        response = self.get_response(
            self.organization.slug,
            statsPeriod="1h",
            interval="1h",
            field="sum(sentry.sessions.session)",
            groupBy=["project_id"],
        )

        assert response.status_code == 200

        groups = response.data["groups"]
        assert len(groups) >= 2 and all(group["by"].keys() == {"project_id"} for group in groups)

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
        indexer.record(self.organization.id, "foo")

        response = self.get_success_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="1h",
            interval="1h",
            groupBy=["foo"],
        )

        groups = response.data["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {"foo": None}

        response = self.get_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="1h",
            interval="1h",
            groupBy=["bar"],
        )
        assert response.status_code == 400

    @mock.patch(
        "sentry.api.endpoints.organization_metrics.OrganizationMetricsDataEndpoint.default_per_page",
        1,
    )
    @freeze_time((timezone.now() - timedelta(days=2)).replace(hour=3, minute=21, second=30))
    def test_no_limit_with_series(self):
        """Pagination args do not apply to series"""
        indexer.record(self.organization.id, "session.status")
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

    def test_request_too_granular(self):
        response = self.get_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="24h",
            interval="5m",
            per_page=50,
            orderBy="-sum(sentry.sessions.session)",
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            f"Requested interval of timedelta of {timedelta(minutes=5)} with statsPeriod "
            f"timedelta of {timedelta(hours=24)} is too granular "
            f"for a per_page of 51 elements. Increase your interval, decrease your statsPeriod, "
            f"or decrease your per_page parameter."
        )

    @freeze_time((datetime.now() - timedelta(hours=1)).replace(minute=30))
    def test_include_series(self):
        indexer.record(self.organization.id, "session.status")
        self.store_session(self.build_session(project_id=self.project.id, started=time.time() - 60))
        response = self.get_success_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="1h",
            interval="1h",
            includeTotals="0",
        )
        assert response.data["groups"] == [
            {"by": {}, "series": {"sum(sentry.sessions.session)": [1.0]}}
        ]

        response = self.get_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="1h",
            interval="1h",
            includeSeries="0",
            includeTotals="0",
        )
        assert response.status_code == 400


@freeze_time((timezone.now() - timedelta(days=2)).replace(hour=3, minute=26))
class DerivedMetricsDataTest(MetricsAPIBaseTestCase):
    endpoint = "sentry-api-0-organization-metrics-data"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        org_id = self.organization.id
        self.session_duration_metric = indexer.record(org_id, SessionMRI.RAW_DURATION.value)
        self.session_metric = indexer.record(org_id, SessionMRI.SESSION.value)
        self.session_user_metric = indexer.record(org_id, SessionMRI.USER.value)
        self.session_error_metric = indexer.record(org_id, SessionMRI.ERROR.value)
        self.session_status_tag = indexer.record(org_id, "session.status")
        self.release_tag = indexer.record(self.organization.id, "release")
        self.tx_metric = indexer.record(org_id, TransactionMRI.DURATION.value)
        self.tx_status = indexer.record(org_id, TransactionTagsKey.TRANSACTION_STATUS.value)
        self.transaction_lcp_metric = indexer.record(
            self.organization.id, TransactionMRI.MEASUREMENTS_LCP.value
        )
        self.tx_satisfaction = indexer.record(
            self.organization.id, TransactionTagsKey.TRANSACTION_SATISFACTION.value
        )
        self.tx_user_metric = indexer.record(self.organization.id, TransactionMRI.USER.value)

    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    @patch("sentry.snuba.metrics.fields.base.get_public_name_from_mri")
    @patch("sentry.snuba.metrics.query_builder.get_mri")
    @patch("sentry.snuba.metrics.query.get_mri")
    def test_derived_metric_incorrectly_defined_as_singular_entity(
        self, mocked_get_mri, mocked_get_mri_query, mocked_reverse_mri
    ):
        mocked_get_mri.return_value = "crash_free_fake"
        mocked_get_mri_query.return_value = "crash_free_fake"
        mocked_reverse_mri.return_value = "crash_free_fake"
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

    def test_derived_metric_does_not_exist(self):
        """
        Test that ensures appropriate exception is raised when a request is made for a field with no
        operation and a field that is not a valid derived metric
        """
        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            field=["crash_free_fake"],
            statsPeriod="6m",
            interval="1m",
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            "Failed to parse 'crash_free_fake'. Must be something like 'sum(my_metric)', "
            "or a supported aggregate derived metric like `session.crash_free_rate`"
        )

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
            field=["session.crash_free_rate", "session.all", "session.crashed"],
            statsPeriod="6m",
            interval="1m",
        )
        group = response.data["groups"][0]
        assert group["totals"]["session.crash_free_rate"] == 0.5
        assert group["totals"]["session.all"] == 8
        assert group["totals"]["session.crashed"] == 4
        assert group["series"]["session.crash_free_rate"] == [None, None, 0.5, 0.5, 0.5, 0.5]

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
        assert group["totals"]["session.crash_free_rate"] == 1
        assert group["series"]["session.crash_free_rate"] == [None, None, 1, 1, 1, 1]

        group = response.data["groups"][1]
        assert group["by"]["release"] == "foobar@1.0"
        assert group["totals"]["session.crash_free_rate"] == 0.5
        assert group["series"]["session.crash_free_rate"] == [None, None, 0.5, 0.5, 0.5, 0.5]

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
        response = self.get_success_response(
            self.organization.slug,
            project=[self.project.id],
            field=[
                SessionMetricKey.CRASH_FREE_RATE.value,
                "sum(sentry.sessions.session)",
            ],
            statsPeriod="6m",
            interval="6m",
            groupBy=["release"],
            orderBy="-session.crash_free_rate",
        )
        assert response.data["groups"] == []

    def test_incorrect_crash_free_rate(self):
        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            field=[f"sum({SessionMetricKey.CRASH_FREE_RATE.value})"],
            statsPeriod="6m",
            interval="1m",
        )
        assert (response.json()["detail"]) == (
            "Failed to parse sum(session.crash_free_rate). No operations can be applied on this "
            "field as it is already a derived metric with an aggregation applied to it."
        )

    def test_errored_sessions(self):
        user_ts = time.time()
        org_id = self.organization.id
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60 - 4) * 60,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "errored_preaggr"),
                    },
                    "type": "c",
                    "value": 10,
                    "retention_days": 90,
                },
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60 - 4) * 60,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "crashed"),
                    },
                    "type": "c",
                    "value": 2,
                    "retention_days": 90,
                },
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60 - 4) * 60,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "abnormal"),
                    },
                    "type": "c",
                    "value": 4,
                    "retention_days": 90,
                },
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "init"),
                    },
                    "type": "c",
                    "value": 15,
                    "retention_days": 90,
                },
            ],
            entity="metrics_counters",
        )
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_error_metric,
                    "timestamp": user_ts,
                    "tags": {tag: value},
                    "type": "s",
                    "value": numbers,
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (self.release_tag, indexer.record(org_id, "foo"), list(range(3))),
                )
            ],
            entity="metrics_sets",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=[SessionMetricKey.ERRORED.value],
            statsPeriod="6m",
            interval="1m",
        )
        group = response.data["groups"][0]
        assert group["totals"]["session.errored"] == 7
        assert group["series"]["session.errored"] == [0, 4, 0, 0, 0, 3]

        response = self.get_success_response(
            self.organization.slug,
            field=["session.errored"],
            statsPeriod="6m",
            interval="1m",
        )
        group = response.data["groups"][0]
        assert group == {
            "by": {},
            "totals": {"session.errored": 7},
            "series": {"session.errored": [0, 4, 0, 0, 0, 3]},
        }

    def test_orderby_composite_entity_derived_metric(self):
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(time.time() // 60) * 60,
                status="ok",
                release="foobar@2.0",
                errors=2,
            )
        )
        response = self.get_response(
            self.organization.slug,
            field=["session.errored"],
            statsPeriod="6m",
            interval="1m",
            groupBy=["release"],
            orderBy=["session.errored"],
        )
        assert response.status_code == 400
        assert response.data["detail"] == (
            "It is not possible to orderBy field session.errored as it does not "
            "have a direct mapping to a query alias"
        )

    def test_abnormal_sessions(self):
        user_ts = time.time()
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60 - 4) * 60,
                    "tags": {
                        self.session_status_tag: indexer.record(self.organization.id, "abnormal"),
                        self.release_tag: indexer.record(self.organization.id, "foo"),
                    },
                    "type": "c",
                    "value": 4,
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60 - 2) * 60,
                    "tags": {
                        self.session_status_tag: indexer.record(self.organization.id, "abnormal"),
                        self.release_tag: indexer.record(self.organization.id, "bar"),
                    },
                    "type": "c",
                    "value": 3,
                    "retention_days": 90,
                },
            ],
            entity="metrics_counters",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.abnormal"],
            statsPeriod="6m",
            interval="1m",
            groupBy=["release"],
            orderBy=["-session.abnormal"],
        )
        foo_group, bar_group = response.data["groups"][0], response.data["groups"][1]
        assert foo_group["by"]["release"] == "foo"
        assert foo_group["totals"] == {"session.abnormal": 4}
        assert foo_group["series"] == {"session.abnormal": [0, 4, 0, 0, 0, 0]}
        assert bar_group["by"]["release"] == "bar"
        assert bar_group["totals"] == {"session.abnormal": 3}
        assert bar_group["series"] == {"session.abnormal": [0, 0, 0, 3, 0, 0]}

    def test_crashed_user_sessions(self):
        org_id = self.organization.id
        user_ts = time.time()
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "crashed"),
                        self.release_tag: indexer.record(org_id, "foo"),
                    },
                    "type": "s",
                    "value": [1, 2, 4],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "crashed"),
                        self.release_tag: indexer.record(org_id, "bar"),
                    },
                    "type": "s",
                    "value": [1, 2, 4, 8, 9, 5],
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.crashed_user"],
            statsPeriod="6m",
            interval="1m",
            groupBy=["release"],
            orderBy=["-session.crashed_user"],
        )
        foo_group, bar_group = response.data["groups"][1], response.data["groups"][0]
        assert foo_group["by"]["release"] == "foo"
        assert foo_group["totals"] == {"session.crashed_user": 3}
        assert foo_group["series"] == {"session.crashed_user": [0, 0, 0, 0, 0, 3]}
        assert bar_group["by"]["release"] == "bar"
        assert bar_group["totals"] == {"session.crashed_user": 6}
        assert bar_group["series"] == {"session.crashed_user": [0, 0, 0, 0, 0, 6]}

    def test_all_user_sessions(self):
        user_ts = time.time()
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {},
                    "type": "s",
                    "value": [1, 2, 4],
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.all_user"],
            statsPeriod="6m",
            interval="1m",
        )
        group = response.data["groups"][0]
        assert group["totals"] == {"session.all_user": 3}
        assert group["series"] == {"session.all_user": [0, 0, 0, 0, 0, 3]}

    def test_abnormal_user_sessions(self):
        user_ts = time.time()
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(self.organization.id, "abnormal")
                    },
                    "type": "s",
                    "value": [1, 2, 4],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {},
                    "type": "s",
                    "value": [1, 2, 4, 7, 9],
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.abnormal_user"],
            statsPeriod="6m",
            interval="1m",
        )
        group = response.data["groups"][0]
        assert group["totals"] == {"session.abnormal_user": 3}
        assert group["series"] == {"session.abnormal_user": [0, 0, 0, 0, 0, 3]}

    def test_crash_free_user_percentage_with_orderby(self):
        user_ts = time.time()
        org_id = self.organization.id
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.release_tag: indexer.record(org_id, "foobar@1.0"),
                    },
                    "type": "s",
                    "value": [1, 2, 4, 8],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(self.organization.id, "crashed"),
                        self.release_tag: indexer.record(org_id, "foobar@1.0"),
                    },
                    "type": "s",
                    "value": [1, 2],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.release_tag: indexer.record(org_id, "foobar@2.0"),
                    },
                    "type": "s",
                    "value": [3, 5],
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.crash_free_user_rate"],
            statsPeriod="6m",
            interval="6m",
            groupBy="release",
            orderBy="-session.crash_free_user_rate",
        )
        group = response.data["groups"][0]
        assert group["by"]["release"] == "foobar@2.0"
        assert group["totals"]["session.crash_free_user_rate"] == 1
        assert group["series"]["session.crash_free_user_rate"] == [1]

        group = response.data["groups"][1]
        assert group["by"]["release"] == "foobar@1.0"
        assert group["totals"]["session.crash_free_user_rate"] == 0.5
        assert group["series"]["session.crash_free_user_rate"] == [0.5]

    def test_crash_free_user_rate_orderby_crash_free_rate(self):
        user_ts = time.time()
        org_id = self.organization.id
        # Users crash free rate
        # foobar@1.0 -> 0.5
        # foobar@2.0 -> 1
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.release_tag: indexer.record(org_id, "foobar@1.0"),
                    },
                    "type": "s",
                    "value": [1, 2, 4, 8],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(self.organization.id, "crashed"),
                        self.release_tag: indexer.record(org_id, "foobar@1.0"),
                    },
                    "type": "s",
                    "value": [1, 2],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.release_tag: indexer.record(org_id, "foobar@2.0"),
                    },
                    "type": "s",
                    "value": [3, 5],
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )
        # Crash free rate
        # foobar@1.0 -> 0.75
        # foobar@2.0 -> 0.25
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60 - 4) * 60,
                    "tags": {
                        self.session_status_tag: indexer.record(self.organization.id, "init"),
                        self.release_tag: indexer.record(self.organization.id, "foobar@1.0"),
                    },
                    "type": "c",
                    "value": 4,
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60 - 2) * 60,
                    "tags": {
                        self.session_status_tag: indexer.record(self.organization.id, "crashed"),
                        self.release_tag: indexer.record(self.organization.id, "foobar@1.0"),
                    },
                    "type": "c",
                    "value": 1,
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60 - 4) * 60,
                    "tags": {
                        self.session_status_tag: indexer.record(self.organization.id, "init"),
                        self.release_tag: indexer.record(self.organization.id, "foobar@2.0"),
                    },
                    "type": "c",
                    "value": 4,
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60 - 2) * 60,
                    "tags": {
                        self.session_status_tag: indexer.record(self.organization.id, "crashed"),
                        self.release_tag: indexer.record(self.organization.id, "foobar@2.0"),
                    },
                    "type": "c",
                    "value": 3,
                    "retention_days": 90,
                },
            ],
            entity="metrics_counters",
        )

        response = self.get_success_response(
            self.organization.slug,
            field=[
                "session.crash_free_user_rate",
                "session.crash_free_rate",
                "session.crash_user_rate",
                "session.crash_rate",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy="release",
            orderBy="-session.crash_free_rate",
        )
        group = response.data["groups"][0]
        assert group["by"]["release"] == "foobar@1.0"
        assert group["totals"]["session.crash_free_rate"] == 0.75
        assert group["totals"]["session.crash_free_user_rate"] == 0.5
        assert group["totals"]["session.crash_rate"] == 0.25
        assert group["totals"]["session.crash_user_rate"] == 0.5

        group = response.data["groups"][1]
        assert group["by"]["release"] == "foobar@2.0"
        assert group["totals"]["session.crash_free_rate"] == 0.25
        assert group["totals"]["session.crash_free_user_rate"] == 1.0
        assert group["totals"]["session.crash_rate"] == 0.75
        assert group["totals"]["session.crash_user_rate"] == 0.0

    def test_healthy_sessions(self):
        user_ts = time.time()
        org_id = self.organization.id
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60) * 60,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "errored_preaggr"),
                        self.release_tag: indexer.record(org_id, "foo"),
                    },
                    "type": "c",
                    "value": 4,
                    "retention_days": 90,
                },
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "init"),
                        self.release_tag: indexer.record(org_id, "foo"),
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
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_error_metric,
                    "timestamp": user_ts,
                    "tags": {tag: value},
                    "type": "s",
                    "value": numbers,
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (self.release_tag, indexer.record(org_id, "foo"), list(range(3))),
                )
            ],
            entity="metrics_sets",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.healthy", "session.errored", "session.all"],
            statsPeriod="6m",
            interval="6m",
        )
        group = response.data["groups"][0]
        assert group["totals"]["session.healthy"] == 3
        assert group["series"]["session.healthy"] == [3]

    def test_healthy_sessions_preaggr(self):
        """Healthy sessions works also when there are no individual errors"""
        user_ts = time.time()
        org_id = self.organization.id
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": (user_ts // 60) * 60,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "errored_preaggr"),
                        self.release_tag: indexer.record(org_id, "foo"),
                    },
                    "type": "c",
                    "value": 4,
                    "retention_days": 90,
                },
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "init"),
                        self.release_tag: indexer.record(org_id, "foo"),
                    },
                    "type": "c",
                    "value": 10,
                    "retention_days": 90,
                },
            ],
            entity="metrics_counters",
        )
        # Can get session healthy even before all components exist
        # (projects that send errored_preaggr usually do not send individual errors)
        response = self.get_success_response(
            self.organization.slug,
            field=["session.healthy"],
            statsPeriod="6m",
            interval="6m",
        )
        group = response.data["groups"][0]
        assert group["totals"]["session.healthy"] == 6
        assert group["series"]["session.healthy"] == [6]

    def test_errored_user_sessions(self):
        org_id = self.organization.id
        user_ts = time.time()
        # Crashed 3
        # Abnormal 6
        # Errored all 9
        # Errored = 3
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "crashed"),
                    },
                    "type": "s",
                    "value": [1, 2, 4],
                    "retention_days": 90,
                },
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "errored"),
                    },
                    "type": "s",
                    "value": [1, 2, 4],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "abnormal"),
                    },
                    "type": "s",
                    "value": [99, 3, 6, 8, 9, 5],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "errored"),
                    },
                    "type": "s",
                    "value": [99, 3, 6, 8, 9, 5],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "errored"),
                    },
                    "type": "s",
                    "value": [22, 33, 44],
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.errored_user"],
            statsPeriod="6m",
            interval="6m",
        )
        group = response.data["groups"][0]
        assert group["totals"]["session.errored_user"] == 3
        assert group["series"]["session.errored_user"] == [3]

    def test_errored_user_sessions_clamped_to_zero(self):
        org_id = self.organization.id
        user_ts = time.time()
        # Crashed 3
        # Errored all 0
        # Errored = -3
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "crashed"),
                    },
                    "type": "s",
                    "value": [1, 2, 4],
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.errored_user"],
            statsPeriod="6m",
            interval="6m",
        )
        group = response.data["groups"][0]
        assert group["totals"]["session.errored_user"] == 0
        assert group["series"]["session.errored_user"] == [0]

    def test_healthy_user_sessions(self):
        org_id = self.organization.id
        user_ts = time.time()
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {},
                    "type": "s",
                    "value": [1, 2, 4, 5, 7],  # 3 and 6 did not recorded at init
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "ok"),
                    },
                    "type": "s",
                    "value": [3],  # 3 was not in init, but still counts
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "errored"),
                    },
                    "type": "s",
                    "value": [1, 2, 6],  # 6 was not in init, but still counts
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.healthy_user"],
            statsPeriod="6m",
            interval="6m",
        )
        group = response.data["groups"][0]
        assert group["totals"]["session.healthy_user"] == 4
        assert group["series"]["session.healthy_user"] == [4]

    def test_healthy_user_sessions_clamped_to_zero(self):
        org_id = self.organization.id
        user_ts = time.time()
        # init = 0
        # errored_all = 1
        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.session_status_tag: indexer.record(org_id, "errored"),
                    },
                    "type": "s",
                    "value": [1],
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["session.healthy_user"],
            statsPeriod="6m",
            interval="6m",
        )
        group = response.data["groups"][0]
        assert group["totals"]["session.healthy_user"] == 0
        assert group["series"]["session.healthy_user"] == [0]

    def test_private_transactions_derived_metric(self):
        for field in ["transaction.all", "transaction.failure_count"]:
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                field=[field],
                statsPeriod="1m",
                interval="1m",
            )

            assert response.data["detail"] == (
                f"Failed to parse '{field}'. Must be something like 'sum(my_metric)', "
                "or a supported aggregate derived metric like `session.crash_free_rate`"
            )

    def test_failure_rate_transaction(self):
        user_ts = time.time()
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.tx_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.tx_status: indexer.record(
                            self.organization.id, TransactionStatusTagValue.OK.value
                        ),
                    },
                    "type": "d",
                    "value": [3.4],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.tx_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.tx_status: indexer.record(
                            self.organization.id, TransactionStatusTagValue.CANCELLED.value
                        ),
                    },
                    "type": "d",
                    "value": [0.3],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.tx_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.tx_status: indexer.record(
                            self.organization.id, TransactionStatusTagValue.UNKNOWN.value
                        ),
                    },
                    "type": "d",
                    "value": [2.3],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.tx_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.tx_status: indexer.record(
                            self.organization.id, TransactionStatusTagValue.ABORTED.value
                        ),
                    },
                    "type": "d",
                    "value": [0.5],
                    "retention_days": 90,
                },
            ],
            entity="metrics_distributions",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["transaction.failure_rate"],
            statsPeriod="1m",
            interval="1m",
        )

        assert len(response.data["groups"]) == 1
        group = response.data["groups"][0]
        assert group["by"] == {}
        assert group["totals"] == {"transaction.failure_rate": 0.25}
        assert group["series"] == {"transaction.failure_rate": [0.25]}

    def test_failure_rate_without_transactions(self):
        """
        Ensures the absence of transactions isn't an issue to calculate the rate.

        The `nan` a division by 0 may produce must not be in the response, yet
        they are an issue in javascript:
        ```
        $ node
        Welcome to Node.js v16.13.1.
        Type ".help" for more information.
        > JSON.parse('NaN')
        Uncaught SyntaxError: Unexpected token N in JSON at position 0
        > JSON.parse('nan')
        Uncaught SyntaxError: Unexpected token a in JSON at position 1
        ```
        """
        # Not sending buckets means no project is created automatically. We need
        # a project without transaction data, so create one:
        self.project

        response = self.get_success_response(
            self.organization.slug,
            field=["transaction.failure_rate"],
            statsPeriod="1m",
            interval="1m",
        )

        assert response.data["groups"] == [
            {
                "by": {},
                "series": {"transaction.failure_rate": [None]},
                "totals": {"transaction.failure_rate": None},
            },
        ]

    def test_request_private_derived_metric(self):
        for private_name in [
            "session.crashed_and_abnormal_user",
            "session.errored_preaggregated",
            "session.errored_set",
            "session.errored_user_all",
        ]:
            response = self.get_response(
                self.organization.slug,
                project=[self.project.id],
                field=[private_name],
                statsPeriod="6m",
                interval="6m",
            )
            assert response.data["detail"] == (
                f"Failed to parse '{private_name}'. Must be something like 'sum(my_metric)', "
                "or a supported aggregate derived metric like `session.crash_free_rate`"
            )

    def test_apdex_transactions(self):
        # See https://docs.sentry.io/product/performance/metrics/#apdex
        user_ts = time.time()
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.tx_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.tx_satisfaction: indexer.record(
                            self.organization.id, TransactionSatisfactionTagValue.SATISFIED.value
                        ),
                    },
                    "type": "d",
                    "value": [3.4],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.tx_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.tx_satisfaction: indexer.record(
                            self.organization.id, TransactionSatisfactionTagValue.TOLERATED.value
                        ),
                    },
                    "type": "d",
                    "value": [0.3],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.tx_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.tx_satisfaction: indexer.record(
                            self.organization.id, TransactionSatisfactionTagValue.TOLERATED.value
                        ),
                    },
                    "type": "d",
                    "value": [2.3],
                    "retention_days": 90,
                },
            ],
            entity="metrics_distributions",
        )

        response = self.get_success_response(
            self.organization.slug,
            field=["transaction.apdex"],
            statsPeriod="1m",
            interval="1m",
        )

        assert len(response.data["groups"]) == 1
        assert response.data["groups"][0]["totals"] == {"transaction.apdex": 0.6666666666666666}

    def test_miserable_users(self):
        user_ts = time.time()
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.tx_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.tx_satisfaction: indexer.record(
                            self.organization.id, TransactionSatisfactionTagValue.FRUSTRATED.value
                        ),
                    },
                    "type": "s",
                    "value": [1, 2],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.tx_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.tx_satisfaction: indexer.record(
                            self.organization.id, TransactionSatisfactionTagValue.SATISFIED.value
                        ),
                    },
                    "type": "s",
                    "value": [1, 3],  # user 1 had mixed transactions, user 3 only satisfied
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )

        response = self.get_success_response(
            self.organization.slug,
            field=["transaction.miserable_user"],
            statsPeriod="1m",
            interval="1m",
        )

        assert len(response.data["groups"]) == 1
        assert response.data["groups"][0]["totals"] == {"transaction.miserable_user": 2}

    def test_user_misery(self):
        user_ts = time.time()
        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.tx_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.tx_satisfaction: indexer.record(
                            self.organization.id, TransactionSatisfactionTagValue.FRUSTRATED.value
                        ),
                    },
                    "type": "s",
                    "value": [3, 4],
                    "retention_days": 90,
                },
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": self.tx_user_metric,
                    "timestamp": user_ts,
                    "tags": {
                        self.tx_satisfaction: indexer.record(
                            self.organization.id, TransactionSatisfactionTagValue.SATISFIED.value
                        ),
                    },
                    "type": "s",
                    "value": [5, 6],
                    "retention_days": 90,
                },
            ],
            entity="metrics_sets",
        )

        response = self.get_success_response(
            self.organization.slug,
            field=["transaction.user_misery"],
            statsPeriod="1m",
            interval="1m",
        )
        assert len(response.data["groups"]) == 1
        assert response.data["groups"][0]["totals"] == {
            "transaction.user_misery": 0.06478439425051336
        }

    def test_session_duration_derived_alias(self):
        org_id = self.organization.id
        user_ts = time.time()

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_duration_metric,
                    "timestamp": user_ts,
                    "type": "d",
                    "value": [2, 6, 8],
                    "tags": {self.session_status_tag: indexer.record(org_id, "exited")},
                    "retention_days": 90,
                },
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_duration_metric,
                    "timestamp": user_ts,
                    "type": "d",
                    "value": [11, 13, 15],
                    "tags": {self.session_status_tag: indexer.record(org_id, "crashed")},
                    "retention_days": 90,
                },
            ],
            entity="metrics_distributions",
        )
        response = self.get_success_response(
            self.organization.slug,
            field=["p50(session.duration)"],
            statsPeriod="6m",
            interval="6m",
        )
        group = response.data["groups"][0]
        assert group == {
            "by": {},
            "totals": {"p50(session.duration)": 6.0},
            "series": {"p50(session.duration)": [6.0]},
        }

    def test_histogram(self):
        # Record some strings
        org_id = self.organization.id
        tag1 = indexer.record(org_id, "tag1")
        value1 = indexer.record(org_id, "value1")
        value2 = indexer.record(org_id, "value2")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.transaction_lcp_metric,
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

        # Note: everything is a string here on purpose to ensure we parse ints properly
        response = self.get_success_response(
            self.organization.slug,
            field=f"histogram({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            statsPeriod="1h",
            interval="1h",
            includeSeries="0",
            histogramBuckets="2",
            histogramFrom="2",
        )

        hist = [(2.0, 4.0, 2), (4.0, 6.0, 3)]

        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {f"histogram({TransactionMetricKey.MEASUREMENTS_LCP.value})": hist},
            }
        ]

    def test_histogram_zooming(self):
        # Record some strings
        org_id = self.organization.id
        tag1 = indexer.record(org_id, "tag1")
        value1 = indexer.record(org_id, "value1")
        value2 = indexer.record(org_id, "value2")

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.transaction_lcp_metric,
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": numbers,
                    "tags": {tag: value},
                    "retention_days": 90,
                }
                for tag, value, numbers in (
                    (tag1, value1, [1, 2, 3]),
                    (tag1, value2, [10, 100, 1000]),
                )
            ],
            entity="metrics_distributions",
        )

        # Note: everything is a string here on purpose to ensure we parse ints properly
        response = self.get_success_response(
            self.organization.slug,
            field=f"histogram({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            statsPeriod="1h",
            interval="1h",
            includeSeries="0",
            histogramBuckets="2",
            histogramTo="9",
        )

        # if zoom_histogram were not called, the variable-width
        # HdrHistogram buckets returned from clickhouse would be so
        # inaccurate that we would accidentally return something
        # else: (5.0, 9.0, 1)
        hist = [(1.0, 5.0, 3), (5.0, 9.0, 0)]

        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {f"histogram({TransactionMetricKey.MEASUREMENTS_LCP.value})": hist},
            }
        ]

    def test_histogram_session_duration(self):
        # Record some strings
        org_id = self.organization.id

        self._send_buckets(
            [
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_duration_metric,
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": [4, 5, 6],
                    "tags": {self.session_status_tag: indexer.record(org_id, "exited")},
                    "retention_days": 90,
                },
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_duration_metric,
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": [1, 2, 3],
                    "tags": {self.session_status_tag: indexer.record(org_id, "exited")},
                    "retention_days": 90,
                },
                {
                    "org_id": org_id,
                    "project_id": self.project.id,
                    "metric_id": self.session_duration_metric,
                    "timestamp": int(time.time()),
                    "type": "d",
                    "value": [7, 8, 9],
                    "tags": {self.session_status_tag: indexer.record(org_id, "crashed")},
                    "retention_days": 90,
                },
            ],
            entity="metrics_distributions",
        )

        # Note: everything is a string here on purpose to ensure we parse ints properly
        response = self.get_success_response(
            self.organization.slug,
            field="histogram(sentry.sessions.session.duration)",
            statsPeriod="1h",
            interval="1h",
            includeSeries="0",
            histogramBuckets="2",
            histogramFrom="2",
        )
        hist = [(2.0, 5.5, 4), (5.5, 9.0, 4)]
        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {"histogram(sentry.sessions.session.duration)": hist},
            }
        ]

        # Using derived alias `session.duration` which has a filter on `exited` session.status
        response = self.get_success_response(
            self.organization.slug,
            field=f"histogram({SessionMetricKey.DURATION.value})",
            statsPeriod="1h",
            interval="1h",
            includeSeries="0",
            histogramBuckets="2",
            histogramFrom="2",
        )
        hist = [(2.0, 4.0, 2), (4.0, 6.0, 3)]
        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {f"histogram({SessionMetricKey.DURATION.value})": hist},
            }
        ]
