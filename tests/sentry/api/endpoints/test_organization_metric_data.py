from datetime import timedelta
from functools import partial
from typing import Optional
from unittest import mock
from unittest.mock import patch

import pytest
from django.utils import timezone
from freezegun import freeze_time

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics.naming_layer.mri import ParsedMRI, SessionMRI, TransactionMRI
from sentry.snuba.metrics.naming_layer.public import (
    SessionMetricKey,
    TransactionMetricKey,
    TransactionSatisfactionTagValue,
    TransactionStatusTagValue,
    TransactionTagsKey,
)
from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.cursors import Cursor
from tests.sentry.api.endpoints.test_organization_metrics import MOCKED_DERIVED_METRICS


def indexer_record(use_case_id: UseCaseKey, org_id: int, string: str) -> int:
    return indexer.record(use_case_id=use_case_id, org_id=org_id, string=string)


perf_indexer_record = partial(indexer_record, UseCaseKey.PERFORMANCE)
rh_indexer_record = partial(indexer_record, UseCaseKey.RELEASE_HEALTH)

pytestmark = [pytest.mark.sentry_metrics]


@region_silo_test
@freeze_time("2022-09-29 10:00:00")
class OrganizationMetricDataTest(MetricsAPIBaseTestCase):
    endpoint = "sentry-api-0-organization-metrics-data"

    def setUp(self):
        super().setUp()
        self.project2 = self.create_project()
        self.login_as(user=self.user)

        self.transaction_lcp_metric = perf_indexer_record(
            self.project.organization.id, TransactionMRI.MEASUREMENTS_LCP.value
        )
        org_id = self.organization.id
        self.session_metric = rh_indexer_record(org_id, SessionMRI.SESSION.value)
        self.session_duration = rh_indexer_record(org_id, SessionMRI.DURATION.value)
        self.session_error_metric = rh_indexer_record(org_id, SessionMRI.ERROR.value)

    @property
    def now(self):
        return timezone.now()

    def test_missing_field(self):
        response = self.get_response(self.project.organization.slug)
        assert response.status_code == 400
        assert response.json()["detail"] == 'Request is missing a "field"'

    def test_incorrect_use_case_id_value(self):
        response = self.get_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            groupBy="environment",
            useCase="unknown",
        )
        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "Invalid useCase parameter. Please use one of: release-health, performance"
        )

    def test_invalid_field(self):
        for field in ["", "(*&%", "foo(session", "foo(session)"]:
            response = self.get_response(self.project.organization.slug, field=field)
            assert response.status_code == 400

    def test_groupby_single(self):
        rh_indexer_record(self.project.organization_id, "environment")
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
                        started=(
                            self.now.replace(second=0) - timedelta(minutes=minute)
                        ).timestamp(),
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
            "Tag name session.status cannot be used in groupBy query"
        )

    def test_filter_session_status(self):
        for status in ["ok", "crashed"]:
            for minute in range(4):
                self.store_session(
                    self.build_session(
                        project_id=self.project.id,
                        started=(
                            self.now.replace(second=0) - timedelta(minutes=minute)
                        ).timestamp(),
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
            rh_indexer_record(self.project.organization_id, tag)
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
            rh_indexer_record(self.project.organization_id, tag)
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
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
                    status="ok",
                )
            )
        for minute in range(3):
            self.store_session(
                self.build_session(
                    project_id=p.id,
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
                    status="ok",
                )
            )
        for minute in range(5):
            self.store_session(
                self.build_session(
                    project_id=p2.id,
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
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

    def test_filter_by_project_slug_negation(self):
        p = self.create_project(name="sentry2")
        p2 = self.create_project(name="sentry3")

        for minute in range(2):
            self.store_session(
                self.build_session(
                    project_id=self.project.id,
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
                    status="ok",
                )
            )
        for minute in range(3):
            self.store_session(
                self.build_session(
                    project_id=p.id,
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
                    status="ok",
                )
            )
        for minute in range(5):
            self.store_session(
                self.build_session(
                    project_id=p2.id,
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
                    status="ok",
                )
            )

        response = self.get_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            project=[p.id, p2.id, self.project.id],
            query="!project:[sentry2,sentry3]",
            interval="24h",
            statsPeriod="24h",
        )
        assert response.status_code == 200
        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {"sum(sentry.sessions.session)": 2},
                "series": {"sum(sentry.sessions.session)": [2]},
            }
        ]

    def test_filter_by_single_project_slug(self):
        p = self.create_project(name="sentry2")

        for minute in range(2):
            self.store_session(
                self.build_session(
                    project_id=self.project.id,
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
                    status="ok",
                )
            )
        for minute in range(3):
            self.store_session(
                self.build_session(
                    project_id=p.id,
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
                    status="ok",
                )
            )

        response = self.get_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            project=[p.id, self.project.id],
            query="project:sentry2",
            interval="24h",
            statsPeriod="24h",
        )
        assert response.status_code == 200
        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {"sum(sentry.sessions.session)": 3},
                "series": {"sum(sentry.sessions.session)": [3]},
            }
        ]

    def test_filter_by_single_project_slug_negation(self):
        p = self.create_project(name="sentry2")

        for minute in range(2):
            self.store_session(
                self.build_session(
                    project_id=self.project.id,
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
                    status="ok",
                )
            )
        for minute in range(3):
            self.store_session(
                self.build_session(
                    project_id=p.id,
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
                    status="ok",
                )
            )

        response = self.get_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            project=[p.id, self.project.id],
            query="!project:sentry2",
            interval="24h",
            statsPeriod="24h",
        )
        assert response.status_code == 200
        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {"sum(sentry.sessions.session)": 2},
                "series": {"sum(sentry.sessions.session)": [2]},
            }
        ]

    def test_group_by_project(self):
        prj_foo = self.create_project(name="foo")
        prj_boo = self.create_project(name="boo")

        for minute in range(2):
            self.store_session(
                self.build_session(
                    project_id=self.project.id,
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
                    status="ok",
                )
            )
        for minute in range(3):
            self.store_session(
                self.build_session(
                    project_id=prj_foo.id,
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
                    status="ok",
                )
            )
        for minute in range(5):
            self.store_session(
                self.build_session(
                    project_id=prj_boo.id,
                    started=(self.now.replace(second=0) - timedelta(minutes=minute)).timestamp(),
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
                "by": {"project": prj_foo.id},
                "series": {"sum(sentry.sessions.session)": [3.0]},
                "totals": {"sum(sentry.sessions.session)": 3.0},
            },
            self.project.id: {
                "by": {"project": self.project.id},
                "series": {"sum(sentry.sessions.session)": [2.0]},
                "totals": {"sum(sentry.sessions.session)": 2.0},
            },
            prj_boo.id: {
                "by": {"project": prj_boo.id},
                "series": {"sum(sentry.sessions.session)": [5.0]},
                "totals": {"sum(sentry.sessions.session)": 5.0},
            },
        }
        for grp in response.data["groups"]:
            prj_id = grp["by"]["project"]
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
            useCase="performance",
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
            useCase="performance",
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
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                # We decided to explicitly show - 1 seconds because this is a "trick" that we used for
                # standardizing tests against flakiness. More explanations found in BaseMetricsLayerTestCase.
                started=(self.now.replace(second=0) - timedelta(seconds=1)).timestamp(),
            )
        )
        self.store_session(
            self.build_session(
                project_id=self.project2.id,
                started=(self.now.replace(second=0) - timedelta(seconds=1)).timestamp(),
            )
        )

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

    def test_max_and_min_on_distributions(self):
        for v_transaction, count in (("/foo", 1), ("/bar", 3), ("/baz", 2)):
            self.store_performance_metric(
                name=TransactionMRI.MEASUREMENTS_LCP.value,
                tags={"transaction": v_transaction},
                value=123.4 * count,
            )

        response = self.get_success_response(
            self.organization.slug,
            field=[
                f"max({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"min({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            ],
            query="",
            statsPeriod="1h",
            interval="1h",
            per_page=3,
            useCase="performance",
            includeSeries="0",
        )
        groups = response.data["groups"]

        assert len(groups) == 1
        assert groups == [
            {
                "by": {},
                "totals": {
                    "max(transaction.measurements.lcp)": 3 * 123.4,
                    "min(transaction.measurements.lcp)": 1 * 123.4,
                },
            }
        ]

    def test_orderby(self):
        for v_transaction, count in (("/foo", 1), ("/bar", 3), ("/baz", 2)):
            for v_rating in ("good", "meh", "poor"):
                # count decides the cardinality of this distribution bucket
                for value in [123.4] * count:
                    self.store_performance_metric(
                        name=TransactionMRI.MEASUREMENTS_LCP.value,
                        tags={"transaction": v_transaction, "measurement_rating": v_rating},
                        value=value,
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
            useCase="performance",
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

    def test_multi_field_orderby(self):
        for v_transaction, count in (("/foo", 1), ("/bar", 3), ("/baz", 2)):
            for v_rating in ("good", "meh", "poor"):
                # count decides the cardinality of this distribution bucket
                for value in [123.4] * count:
                    self.store_performance_metric(
                        name=TransactionMRI.MEASUREMENTS_LCP.value,
                        tags={"transaction": v_transaction, "measurement_rating": v_rating},
                        value=value,
                    )

        response = self.get_success_response(
            self.organization.slug,
            field=[
                f"count({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"count({TransactionMetricKey.MEASUREMENTS_FCP.value})",
            ],
            query="measurement_rating:poor",
            statsPeriod="1h",
            interval="1h",
            groupBy="transaction",
            orderBy=[
                f"-count({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"-count({TransactionMetricKey.MEASUREMENTS_FCP.value})",
            ],
            per_page=2,
            useCase="performance",
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
                f"count({TransactionMetricKey.MEASUREMENTS_LCP.value})": [expected_count],
                f"count({TransactionMetricKey.MEASUREMENTS_FCP.value})": [0],
            }
            assert group["totals"] == {
                f"count({TransactionMetricKey.MEASUREMENTS_LCP.value})": expected_count,
                f"count({TransactionMetricKey.MEASUREMENTS_FCP.value})": 0,
            }

    def test_orderby_percentile(self):
        for tag, value, numbers in (
            ("tag1", "value1", [4, 5, 6]),
            ("tag1", "value2", [1, 2, 3]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={tag: value},
                    value=subvalue,
                )

        response = self.get_success_response(
            self.organization.slug,
            field=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            statsPeriod="1h",
            interval="1h",
            groupBy="tag1",
            orderBy=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            useCase="performance",
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
        for tag, value, numbers in (
            ("tag1", "value1", [4, 5, 6]),
            ("tag1", "value2", [1, 2, 3]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={tag: value},
                    value=subvalue,
                )

        response = self.get_success_response(
            self.organization.slug,
            field=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            statsPeriod="1h",
            interval="1h",
            groupBy="tag1",
            orderBy=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            per_page=1,
            useCase="performance",
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
            useCase="performance",
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
        for tag, value, numbers in (
            ("tag1", "value1", [4, 5, 6]),
            ("tag1", "value2", [1, 2, 3]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={tag: value},
                    value=subvalue,
                )

        response = self.get_success_response(
            self.organization.slug,
            field=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            statsPeriod="1h",
            interval="1h",
            groupBy="tag1",
            orderBy=f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
            per_page=1,
            useCase="performance",
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
            perf_indexer_record(self.organization.id, metric)
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
            useCase="performance",
        )
        groups = response.data["groups"]
        assert len(groups) == 0

    def test_orderby_percentile_with_many_fields_one_entity(self):
        """
        Test that ensures when transactions are ordered correctly when all the fields requested
        are from the same entity
        """
        for tag, value, numbers in (
            ("transaction", "/foo/", [10, 11, 12]),
            ("transaction", "/bar/", [4, 5, 6]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={tag: value},
                    value=subvalue,
                )

        for tag, value, numbers in (
            ("transaction", "/foo/", [1, 2, 3]),
            ("transaction", "/bar/", [13, 14, 15]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_FCP.value,
                    tags={tag: value},
                    value=subvalue,
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
            useCase="performance",
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

    def test_multi_field_orderby_percentile_with_many_fields_one_entity(self):
        """
        Test that ensures when transactions are ordered correctly when all the fields requested
        are from the same entity
        """
        for tag, value, numbers in (
            ("transaction", "/foo/", [10, 11, 12]),
            ("transaction", "/bar/", [4, 5, 6]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={tag: value},
                    value=subvalue,
                )

        for tag, value, numbers in (
            ("transaction", "/foo/", [1, 2, 3]),
            ("transaction", "/bar/", [13, 14, 15]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_FCP.value,
                    tags={tag: value},
                    value=subvalue,
                )

        kwargs = dict(
            field=[
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"p50({TransactionMetricKey.MEASUREMENTS_FCP.value})",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy=["project_id", "transaction"],
            useCase="performance",
        )

        # Test order by DESC
        response = self.get_success_response(
            self.organization.slug,
            **kwargs,
            orderBy=[
                f"-p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"-p50({TransactionMetricKey.MEASUREMENTS_FCP.value})",
            ],
        )
        groups = response.data["groups"]
        assert len(groups) == 2

        expected = [
            ("/foo/", 11.0, 2.0),
            ("/bar/", 5.0, 14.0),
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

        # Test order by ASC
        response = self.get_success_response(
            self.organization.slug,
            **kwargs,
            orderBy=[
                f"p50({TransactionMetricKey.MEASUREMENTS_LCP.value})",
                f"p50({TransactionMetricKey.MEASUREMENTS_FCP.value})",
            ],
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
        for tag, value, numbers in (
            ("transaction", "/foo/", [10, 11, 12]),
            ("transaction", "/bar/", [4, 5, 6]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={tag: value},
                    value=subvalue,
                )

        for tag, value, numbers in (
            ("transaction", "/foo/", list(range(1))),
            ("transaction", "/bar/", list(range(5))),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.USER.value,
                    tags={tag: value},
                    value=subvalue,
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
            useCase="performance",
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

    @freeze_time("2022-09-29 03:21:34")
    def test_orderby_percentile_with_many_fields_multiple_entities_with_paginator(self):
        """
        Test that ensures when transactions are ordered correctly when all the fields requested
        are from multiple entities
        """
        for tag, value, numbers in (
            ("transaction", "/foo/", [10, 11, 12]),
            ("transaction", "/bar/", [4, 5, 6]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={tag: value},
                    value=subvalue,
                )

        for minutes, ranges in [
            (1, [range(4, 5), range(6, 11)]),
            (15, [range(3), range(6)]),
        ]:
            for tag, value, numbers in (
                ("transaction", "/foo/", list(ranges[0])),
                ("transaction", "/bar/", list(ranges[1])),
            ):
                for subvalue in numbers:
                    self.store_performance_metric(
                        name=TransactionMRI.USER.value,
                        tags={tag: value},
                        value=subvalue,
                        minutes_before_now=minutes,
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
            "useCase": "performance",
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

    def test_series_are_limited_to_total_order_in_case_with_one_field_orderby(self):
        # Create time series [1, 2, 3, 4] for every release:
        for minute in range(4):
            for _ in range(minute + 1):
                # One for each release
                for release in ("foo", "bar", "baz"):
                    self.store_session(
                        self.build_session(
                            project_id=self.project.id,
                            started=(
                                self.now - timedelta(minutes=3 - minute, seconds=1)
                            ).timestamp(),
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
                            started=(
                                self.now - timedelta(minutes=3 - minute, seconds=1)
                            ).timestamp(),
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
        for tag, value, numbers in (
            ("transaction", "/foo/", [10, 11, 12]),
            ("transaction", "/bar/", [4, 5, 6]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={tag: value},
                    value=subvalue,
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
            useCase="performance",
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
        self.store_release_health_metric(
            name=SessionMRI.SESSION.value,
            tags={"tag3": "value1"},
            value=10,
        )

        for value in (
            "value2",
            "value3",
            "value4",
        ):
            self.store_performance_metric(
                name=TransactionMRI.MEASUREMENTS_FCP.value,
                tags={"tag3": value},
                value=1,
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
            useCase="performance",
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
        for tag, tag_value in (("tag1", "group1"), ("tag1", "group2")):
            self.store_release_health_metric(
                name=SessionMRI.SESSION.value,
                tags={tag: tag_value},
                value=10,
                minutes_before_now=4,
            )

        for tag, tag_value, numbers in (
            ("tag1", "group2", list(range(3))),
            ("tag1", "group3", list(range(3, 6))),
        ):
            for value in numbers:
                self.store_release_health_metric(
                    name=SessionMRI.ERROR.value,
                    tags={tag: tag_value},
                    value=value,
                )

        for tag, tag_value, numbers in (
            ("tag1", "group4", list(range(3))),
            ("tag1", "group5", list(range(3, 6))),
        ):
            for value in numbers:
                self.store_release_health_metric(
                    name=SessionMRI.DURATION.value,
                    tags={tag: tag_value},
                    value=value,
                )

        response = self.get_success_response(
            self.organization.slug,
            field=[
                f"p50({SessionMetricKey.DURATION.value})",
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
        for tag, tag_value in (
            ("tag2", "A1"),
            ("tag2", "B1"),
            ("tag2", "C1"),
        ):
            self.store_release_health_metric(
                name=SessionMRI.SESSION.value,
                tags={tag: tag_value},
                value=10,
                minutes_before_now=4,
            )

        for tag, tag_value, numbers in (
            ("tag2", "B2", list(range(3))),
            ("tag2", "B3", list(range(3, 6))),
            ("tag2", "C1", list(range(6, 9))),
            ("tag2", "B1", list(range(18, 21))),
        ):
            for value in numbers:
                self.store_release_health_metric(
                    name=SessionMRI.ERROR.value,
                    tags={tag: tag_value},
                    value=value,
                )

        response = self.get_success_response(
            self.organization.slug,
            field=[
                f"p50({SessionMetricKey.DURATION.value})",
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

    # TODO: check whether we leave - 1 seconds or whether we will abstract build_session like store_*_metric.
    def test_groupby_project(self):
        self.store_session(
            self.build_session(
                project_id=self.project2.id,
                started=(self.now.replace(second=0) - timedelta(seconds=1)).timestamp(),
            )
        )
        for _ in range(2):
            self.store_session(
                self.build_session(
                    project_id=self.project.id,
                    started=(self.now.replace(second=0) - timedelta(seconds=1)).timestamp(),
                )
            )

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
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(self.now.replace(second=0) - timedelta(seconds=1)).timestamp(),
            )
        )

        # "foo" is known by indexer, "bar" is not
        rh_indexer_record(self.organization.id, "foo")

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
    def test_no_limit_with_series(self):
        """Pagination args do not apply to series"""
        rh_indexer_record(self.organization.id, "session.status")
        for minute in range(4):
            self.store_session(
                self.build_session(
                    project_id=self.project.id,
                    started=(
                        self.now.replace(second=0) - timedelta(minutes=minute, seconds=1)
                    ).timestamp(),
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

    def test_include_series(self):
        rh_indexer_record(self.organization.id, "session.status")
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(self.now - timedelta(minutes=1)).timestamp(),
            )
        )
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


@freeze_time("2022-09-29 10:00:00")
class DerivedMetricsDataTest(MetricsAPIBaseTestCase):
    endpoint = "sentry-api-0-organization-metrics-data"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        org_id = self.organization.id
        self.session_duration_metric = rh_indexer_record(org_id, SessionMRI.RAW_DURATION.value)
        self.session_metric = rh_indexer_record(org_id, SessionMRI.SESSION.value)
        self.session_user_metric = rh_indexer_record(org_id, SessionMRI.USER.value)
        self.session_error_metric = rh_indexer_record(org_id, SessionMRI.ERROR.value)
        self.session_status_tag = rh_indexer_record(org_id, "session.status")
        self.release_tag = rh_indexer_record(self.organization.id, "release")
        self.tx_metric = perf_indexer_record(org_id, TransactionMRI.DURATION.value)
        self.tx_status = perf_indexer_record(org_id, TransactionTagsKey.TRANSACTION_STATUS.value)
        self.transaction_lcp_metric = perf_indexer_record(
            self.organization.id, TransactionMRI.MEASUREMENTS_LCP.value
        )
        self.tx_satisfaction = perf_indexer_record(
            self.organization.id, TransactionTagsKey.TRANSACTION_SATISFACTION.value
        )
        self.tx_user_metric = perf_indexer_record(self.organization.id, TransactionMRI.USER.value)

    @property
    def now(self):
        return timezone.now()

    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    @patch("sentry.snuba.metrics.query.parse_mri")
    @patch("sentry.snuba.metrics.fields.base.get_public_name_from_mri")
    @patch("sentry.snuba.metrics.query_builder.get_mri")
    @patch("sentry.snuba.metrics.query.get_public_name_from_mri")
    def test_derived_metric_incorrectly_defined_as_singular_entity(
        self,
        mocked_get_public_name_from_mri,
        mocked_get_mri_query,
        mocked_reverse_mri,
        mocked_parse_mri,
    ):
        mocked_get_public_name_from_mri.return_value = "crash_free_fake"
        mocked_get_mri_query.return_value = "crash_free_fake"
        mocked_reverse_mri.return_value = "crash_free_fake"
        mocked_parse_mri.return_value = ParsedMRI("e", "sessions", "crash_free_fake", "none")
        for status in ["ok", "crashed"]:
            for minute in range(4):
                self.store_session(
                    self.build_session(
                        project_id=self.project.id,
                        started=(
                            self.now.replace(second=0) - timedelta(minutes=minute)
                        ).timestamp(),
                        status=status,
                    )
                )
        response = self.get_response(
            self.organization.slug,
            field=["crash_free_fake"],
            statsPeriod="6m",
            interval="1m",
            useCase="release-health",
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
                        started=(
                            self.now.replace(second=0) - timedelta(minutes=minute, seconds=1)
                        ).timestamp(),
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
                        started=(
                            self.now.replace(second=0) - timedelta(minutes=minute, seconds=1)
                        ).timestamp(),
                        status=status,
                        release="foobar@1.0",
                    )
                )
        for minute in range(4):
            self.store_session(
                self.build_session(
                    project_id=self.project.id,
                    started=(
                        self.now.replace(second=0) - timedelta(minutes=minute, seconds=1)
                    ).timestamp(),
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
        for tag_value, value in (
            ("errored_preaggr", 10),
            ("crashed", 2),
            ("abnormal", 4),
            ("init", 15),
        ):
            self.store_release_health_metric(
                name=SessionMRI.SESSION.value,
                tags={"session.status": tag_value},
                value=value,
                minutes_before_now=4,
            )
        for value in range(3):
            self.store_release_health_metric(
                name=SessionMRI.ERROR.value,
                tags={"release": "foo"},
                value=value,
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

    def test_orderby_composite_entity_derived_metric(self):
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=self.now.replace(second=0).timestamp(),
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
            "Selected 'orderBy' columns must belongs to the same entity"
        )

    def test_abnormal_sessions(self):
        for tag_value, value, minutes in (
            ("foo", 4, 4),
            ("bar", 3, 2),
        ):
            self.store_release_health_metric(
                name=SessionMRI.SESSION.value,
                tags={"session.status": "abnormal", "release": tag_value},
                value=value,
                minutes_before_now=minutes,
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
        for tag_value, values in (
            ("foo", [1, 2, 4]),
            ("bar", [1, 2, 4, 8, 9, 5]),
        ):
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.USER.value,
                    tags={"session.status": "crashed", "release": tag_value},
                    value=value,
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
        for value in [1, 2, 4]:
            self.store_release_health_metric(
                name=SessionMRI.USER.value,
                tags={},
                value=value,
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
        for tags, values in (
            ({"session.status": "abnormal"}, [1, 2, 4]),
            ({}, [1, 2, 4, 7, 9]),
        ):
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.USER.value,
                    tags=tags,
                    value=value,
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
        for tags, values in (
            ({"release": "foobar@1.0"}, [1, 2, 4, 8]),
            ({"session.status": "crashed", "release": "foobar@1.0"}, [1, 2]),
            ({"release": "foobar@2.0"}, [3, 5]),
        ):
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.USER.value,
                    tags=tags,
                    value=value,
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
        # Users crash free rate
        # foobar@1.0 -> 0.5
        # foobar@2.0 -> 1
        for tags, values in (
            ({"release": "foobar@1.0"}, [1, 2, 4, 8]),
            ({"session.status": "crashed", "release": "foobar@1.0"}, [1, 2]),
            ({"release": "foobar@2.0"}, [3, 5]),
        ):
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.USER.value,
                    tags=tags,
                    value=value,
                )

        # Crash free rate
        # foobar@1.0 -> 0.75
        # foobar@2.0 -> 0.25

        for tag_value, release_tag_value, value, second in (
            ("init", "foobar@1.0", 4, 4),
            ("crashed", "foobar@1.0", 1, 2),
            ("init", "foobar@2.0", 4, 4),
            ("crashed", "foobar@2.0", 3, 2),
        ):
            self.store_release_health_metric(
                name=SessionMRI.SESSION.value,
                tags={"session.status": tag_value, "release": release_tag_value},
                value=value,
                seconds_before_now=second,
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
        for tags, value in (
            ({"session.status": "errored_preaggr", "release": "foo"}, 4),
            ({"session.status": "init", "release": "foo"}, 10),
        ):
            self.store_release_health_metric(
                name=SessionMRI.SESSION.value,
                tags=tags,
                value=value,
            )

        for value in range(3):
            self.store_release_health_metric(
                name=SessionMRI.ERROR.value,
                tags={"release": "foo"},
                value=value,
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
        for tag_value, value in (
            ("errored_preaggr", 4),
            ("init", 10),
        ):
            self.store_release_health_metric(
                name=SessionMRI.SESSION.value,
                tags={"session.status": tag_value, "release": "foo"},
                value=value,
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
        # Crashed 3
        # Abnormal 6
        # Errored all 9
        # Errored = 3

        for tag_value, values in (
            ("crashed", [1, 2, 4]),
            ("errored", [1, 2, 4]),
            ("abnormal", [99, 3, 6, 8, 9, 5]),
            ("errored", [99, 3, 6, 8, 9, 5]),
            ("errored", [22, 33, 44]),
        ):
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.USER.value,
                    tags={"session.status": tag_value},
                    value=value,
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
        # Crashed 3
        # Errored all 0
        # Errored = -3
        for value in [1, 2, 4]:
            self.store_release_health_metric(
                name=SessionMRI.USER.value,
                tags={"session.status": "crashed"},
                value=value,
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
        for tags, values in (
            ({}, [1, 2, 4, 5, 7]),  # 3 and 6 did not recorded at init
            ({"session.status": "ok"}, [3]),  # 3 was not in init, but still counts
            ({"session.status": "errored"}, [1, 2, 6]),  # 6 was not in init, but still counts
        ):
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.USER.value,
                    tags=tags,
                    value=value,
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
        # init = 0
        # errored_all = 1
        self.store_release_health_metric(
            name=SessionMRI.USER.value,
            tags={"session.status": "errored"},
            value=1,
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
        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            field=["transaction.all"],
            statsPeriod="1m",
            interval="1m",
        )

        assert response.data["detail"] == (
            "Failed to parse 'transaction.all'. Must be something like 'sum(my_metric)', "
            "or a supported aggregate derived metric like `session.crash_free_rate`"
        )

    def test_failure_rate_transaction(self):
        for value, tag_value in (
            (3.4, TransactionStatusTagValue.OK.value),
            (0.3, TransactionStatusTagValue.CANCELLED.value),
            (2.3, TransactionStatusTagValue.UNKNOWN.value),
            (0.5, TransactionStatusTagValue.ABORTED.value),
        ):
            self.store_performance_metric(
                name=TransactionMRI.DURATION.value,
                tags={TransactionTagsKey.TRANSACTION_STATUS.value: tag_value},
                value=value,
            )

        response = self.get_success_response(
            self.organization.slug,
            field=["transaction.failure_rate"],
            statsPeriod="1m",
            interval="1m",
            useCase="performance",
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
            useCase="performance",
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
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={
                TransactionTagsKey.TRANSACTION_SATISFACTION.value: TransactionSatisfactionTagValue.SATISFIED.value
            },
            value=3.4,
        )

        for subvalue in [0.3, 2.3]:
            self.store_performance_metric(
                name=TransactionMRI.DURATION.value,
                tags={
                    TransactionTagsKey.TRANSACTION_SATISFACTION.value: TransactionSatisfactionTagValue.TOLERATED.value
                },
                value=subvalue,
            )

        response = self.get_success_response(
            self.organization.slug,
            field=["transaction.apdex"],
            statsPeriod="1m",
            interval="1m",
            useCase="performance",
        )

        assert len(response.data["groups"]) == 1
        assert response.data["groups"][0]["totals"] == {"transaction.apdex": 0.6666666666666666}

    def test_miserable_users(self):
        for subvalue in [1, 2]:
            self.store_performance_metric(
                name=TransactionMRI.USER.value,
                tags={
                    TransactionTagsKey.TRANSACTION_SATISFACTION.value: TransactionSatisfactionTagValue.FRUSTRATED.value
                },
                value=subvalue,
            )

        for subvalue in [1, 3]:
            self.store_performance_metric(
                name=TransactionMRI.USER.value,
                tags={
                    TransactionTagsKey.TRANSACTION_SATISFACTION.value: TransactionSatisfactionTagValue.SATISFIED.value
                },
                value=subvalue,
            )

        response = self.get_success_response(
            self.organization.slug,
            field=["transaction.miserable_user"],
            statsPeriod="1m",
            interval="1m",
            useCase="performance",
        )

        assert len(response.data["groups"]) == 1
        assert response.data["groups"][0]["totals"] == {"transaction.miserable_user": 2}

    def test_user_misery(self):
        for subvalue in [3, 4]:
            self.store_performance_metric(
                name=TransactionMRI.USER.value,
                tags={
                    TransactionTagsKey.TRANSACTION_SATISFACTION.value: TransactionSatisfactionTagValue.FRUSTRATED.value
                },
                value=subvalue,
            )

        for subvalue in [5, 6]:
            self.store_performance_metric(
                name=TransactionMRI.USER.value,
                tags={
                    TransactionTagsKey.TRANSACTION_SATISFACTION.value: TransactionSatisfactionTagValue.SATISFIED.value
                },
                value=subvalue,
            )

        response = self.get_success_response(
            self.organization.slug,
            field=["transaction.user_misery"],
            statsPeriod="1m",
            interval="1m",
            useCase="performance",
        )
        assert len(response.data["groups"]) == 1
        assert response.data["groups"][0]["totals"] == {
            "transaction.user_misery": 0.06478439425051336
        }

    def test_session_duration_derived_alias(self):
        for tag_value, numbers in (
            ("exited", [2, 6, 8]),
            ("crashed", [11, 13, 15]),
        ):
            for value in numbers:
                self.store_release_health_metric(
                    name=SessionMRI.RAW_DURATION.value,
                    tags={"session.status": tag_value},
                    value=value,
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
