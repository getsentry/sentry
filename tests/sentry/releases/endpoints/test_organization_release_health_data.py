from __future__ import annotations

from datetime import datetime, timedelta
from functools import partial
from typing import Any
from unittest import mock
from unittest.mock import patch

import pytest

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer.mri import ParsedMRI, SessionMRI
from sentry.snuba.metrics.naming_layer.public import (
    SessionMetricKey,
)
from sentry.snuba.metrics.query import MetricField
from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import json
from tests.sentry.api.endpoints.test_organization_metrics import MOCKED_DERIVED_METRICS


def indexer_record(use_case_id: UseCaseID, org_id: int, string: str) -> int:
    ret = indexer.record(use_case_id, org_id, string)
    assert ret is not None
    return ret


rh_indexer_record = partial(indexer_record, UseCaseID.SESSIONS)

pytestmark = [pytest.mark.sentry_metrics]


@freeze_time(MetricsAPIBaseTestCase.MOCK_DATETIME)
class OrganizationReleaseHealthDataTest(MetricsAPIBaseTestCase):
    endpoint = "sentry-api-0-organization-metrics-data"

    def setUp(self) -> None:
        super().setUp()
        self.project2 = self.create_project()
        self.login_as(user=self.user)
        self.login_as(user=self.create_user(is_staff=True), staff=True)

        org_id = self.organization.id
        self.session_metric = rh_indexer_record(org_id, SessionMRI.RAW_SESSION.value)
        self.session_duration = rh_indexer_record(org_id, SessionMRI.DURATION.value)
        self.session_error_metric = rh_indexer_record(org_id, SessionMRI.RAW_ERROR.value)

    @property
    def now(self) -> datetime:
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_missing_field(self) -> None:
        response = self.get_error_response(self.project.organization.slug, status_code=400)
        assert response.data["detail"] == 'Request is missing a "field"'

    def test_incorrect_use_case_id_value(self) -> None:
        response = self.get_error_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            groupBy="environment",
            useCase="unknown",
            status_code=400,
        )
        assert response.data["detail"] == "The supplied use case doesn't exist or it's private"

    def test_invalid_field(self) -> None:
        for field in ["", "(*&%", "foo(session", "foo(session)"]:
            self.get_error_response(self.project.organization.slug, field=field, status_code=400)

    def test_groupby_single(self) -> None:
        rh_indexer_record(self.project.organization_id, "environment")
        self.get_success_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            groupBy="environment",
        )

    def test_groupby_session_status(self) -> None:
        for status in ["ok", "crashed"]:
            for minute in range(4):
                self.build_and_store_session(
                    project_id=self.project.id,
                    minutes_before_now=minute,
                    status=status,
                )

        response = self.get_error_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            groupBy="session.status",
            statsPeriod="1h",
            interval="1h",
            status_code=400,
        )
        assert response.data["detail"] == (
            "Tag name session.status cannot be used in groupBy query"
        )

    def test_filter_session_status(self) -> None:
        for status in ["ok", "crashed"]:
            for minute in range(4):
                self.build_and_store_session(
                    project_id=self.project.id,
                    minutes_before_now=minute,
                    status=status,
                )

        response = self.get_error_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            query="session.status:crashed",
            statsPeriod="1h",
            interval="1h",
            status_code=400,
        )
        assert response.data["detail"] == ("Tag name session.status is not a valid query filter")

    def test_invalid_filter(self) -> None:
        query = "release:foo or "
        self.get_error_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            groupBy="environment",
            query=query,
            status_code=400,
        )
        assert query

    def test_valid_filter(self) -> None:
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

    def test_validate_include_meta_not_enabled_by_default(self) -> None:
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

    def test_orderby_unknown(self) -> None:
        self.get_error_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            orderBy="foo",
            status_code=400,
        )

    def test_orderby_tag(self) -> None:
        """Order by tag is not supported (yet)"""
        self.get_error_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)", "environment"],
            groupBy="environment",
            orderBy="environment",
            status_code=400,
        )

    def test_date_range_too_long(self) -> None:
        response = self.get_error_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            interval="10s",
            statsPeriod="90d",
            per_page=1,
            status_code=400,
        )
        assert response.data["detail"] == (
            "Your interval and date range would create too many results. Use a larger interval, "
            "or a smaller date range."
        )

    def test_interval_must_be_multiple_of_smallest_interval(self) -> None:
        response = self.get_error_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            interval="15s",
            statsPeriod="1d",
            per_page=1,
            status_code=400,
        )
        assert response.data["detail"] == (
            "The interval has to be a multiple of the minimum interval of ten seconds."
        )

    def test_interval_should_divide_day_with_no_remainder(self) -> None:
        response = self.get_error_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            interval="3610s",
            statsPeriod="2d",
            per_page=1,
            status_code=400,
        )
        assert response.data["detail"] == (
            "The interval should divide one day without a remainder."
        )

    def test_filter_by_project_slug(self) -> None:
        p = self.create_project(name="sentry2")
        p2 = self.create_project(name="sentry3")

        for minute in range(2):
            self.build_and_store_session(
                project_id=self.project.id,
                minutes_before_now=minute,
                status="ok",
            )

        for minute in range(3):
            self.build_and_store_session(
                project_id=p.id,
                minutes_before_now=minute,
                status="ok",
            )

        for minute in range(5):
            self.build_and_store_session(
                project_id=p2.id,
                minutes_before_now=minute,
                status="ok",
            )

        response = self.get_success_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            project=[p.id, p2.id, self.project.id],
            query="project:[sentry2,sentry3]",
            interval="24h",
            statsPeriod="24h",
        )

        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {"sum(sentry.sessions.session)": 8},
                "series": {"sum(sentry.sessions.session)": [0, 8]},
            }
        ]

    def test_filter_by_project_slug_negation(self) -> None:
        p = self.create_project(name="sentry2")
        p2 = self.create_project(name="sentry3")

        for minute in range(2):
            self.build_and_store_session(
                project_id=self.project.id,
                minutes_before_now=minute,
                status="ok",
            )

        for minute in range(3):
            self.build_and_store_session(
                project_id=p.id,
                minutes_before_now=minute,
                status="ok",
            )

        for minute in range(5):
            self.build_and_store_session(
                project_id=p2.id,
                minutes_before_now=minute,
                status="ok",
            )

        response = self.get_success_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            project=[p.id, p2.id, self.project.id],
            query="!project:[sentry2,sentry3]",
            interval="24h",
            statsPeriod="24h",
        )

        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {"sum(sentry.sessions.session)": 2},
                "series": {"sum(sentry.sessions.session)": [0, 2]},
            }
        ]

    def test_staff_filter_by_single_project_slug(self) -> None:
        staff_user = self.create_user(is_staff=True)
        self.login_as(staff_user, staff=True)

        p = self.create_project(name="sentry2")

        for minute in range(2):
            self.build_and_store_session(
                project_id=self.project.id,
                minutes_before_now=minute,
                status="ok",
            )

        for minute in range(3):
            self.build_and_store_session(
                project_id=p.id,
                minutes_before_now=minute,
                status="ok",
            )

        response = self.get_success_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            project=[p.id, self.project.id],
            query="project:sentry2",
            interval="24h",
            statsPeriod="24h",
        )

        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {"sum(sentry.sessions.session)": 3},
                "series": {"sum(sentry.sessions.session)": [0, 3]},
            }
        ]

    def test_filter_by_single_project_slug(self) -> None:
        p = self.create_project(name="sentry2")

        for minute in range(2):
            self.build_and_store_session(
                project_id=self.project.id,
                minutes_before_now=minute,
                status="ok",
            )

        for minute in range(3):
            self.build_and_store_session(
                project_id=p.id,
                minutes_before_now=minute,
                status="ok",
            )

        response = self.get_success_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            project=[p.id, self.project.id],
            query="project:sentry2",
            interval="24h",
            statsPeriod="24h",
        )

        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {"sum(sentry.sessions.session)": 3},
                "series": {"sum(sentry.sessions.session)": [0, 3]},
            }
        ]

    def test_filter_by_single_project_slug_negation(self) -> None:
        p = self.create_project(name="sentry2")

        for minute in range(2):
            self.build_and_store_session(
                project_id=self.project.id,
                minutes_before_now=minute,
                status="ok",
            )

        for minute in range(3):
            self.build_and_store_session(
                project_id=p.id,
                minutes_before_now=minute,
                status="ok",
            )

        response = self.get_success_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            project=[p.id, self.project.id],
            query="!project:sentry2",
            interval="24h",
            statsPeriod="24h",
        )

        assert response.data["groups"] == [
            {
                "by": {},
                "totals": {"sum(sentry.sessions.session)": 2},
                "series": {"sum(sentry.sessions.session)": [0, 2]},
            }
        ]

    def test_group_by_project(self) -> None:
        prj_foo = self.create_project(name="foo")
        prj_boo = self.create_project(name="boo")

        for minute in range(2):
            self.build_and_store_session(
                project_id=self.project.id,
                minutes_before_now=minute,
                status="ok",
            )

        for minute in range(3):
            self.build_and_store_session(
                project_id=prj_foo.id,
                minutes_before_now=minute,
                status="ok",
            )

        for minute in range(5):
            self.build_and_store_session(
                project_id=prj_boo.id,
                minutes_before_now=minute,
                status="ok",
            )

        response = self.get_success_response(
            self.project.organization.slug,
            field=["sum(sentry.sessions.session)"],
            project=[prj_foo.id, prj_boo.id, self.project.id],
            interval="24h",
            statsPeriod="24h",
            groupBy="project",
        )

        expected_output = {
            prj_foo.id: {
                "by": {"project": prj_foo.id},
                "series": {"sum(sentry.sessions.session)": [0, 3.0]},
                "totals": {"sum(sentry.sessions.session)": 3.0},
            },
            self.project.id: {
                "by": {"project": self.project.id},
                "series": {"sum(sentry.sessions.session)": [0, 2.0]},
                "totals": {"sum(sentry.sessions.session)": 2.0},
            },
            prj_boo.id: {
                "by": {"project": prj_boo.id},
                "series": {"sum(sentry.sessions.session)": [0, 5.0]},
                "totals": {"sum(sentry.sessions.session)": 5.0},
            },
        }
        for grp in response.data["groups"]:
            prj_id = grp["by"]["project"]
            assert grp == expected_output[prj_id]

    def test_query_with_wildcard(self) -> None:
        rh_indexer_record(self.organization.id, "session.crash_free_user_rate")
        self.build_and_store_session(
            project_id=self.project.id,
        )
        response = self.get_error_response(
            self.organization.slug,
            field="session.crash_free_user_rate",
            groupBy="release",
            environment="Release",
            query='!release:"0.99.0 (*)"',
            statsPeriod="14d",
            interval="1h",
            includeTotals="1",
            includeSeries="0",
            status_code=400,
        )

        assert (
            response.data["detail"]
            == "Failed to parse conditions: Release Health Queries don't support wildcards"
        )

    def test_statsperiod_invalid(self) -> None:
        self.get_error_response(
            self.project.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="",
            status_code=400,
        )

    def test_separate_projects(self) -> None:
        # Insert session metrics:
        self.build_and_store_session(
            project_id=self.project.id,
        )
        self.build_and_store_session(
            project_id=self.project2.id,
        )

        def count_sessions(project_id: int | None) -> int:
            kwargs: dict[str, Any] = dict(
                field="sum(sentry.sessions.session)",
                statsPeriod="1h",
                interval="1h",
            )
            if project_id is not None:
                kwargs["project"] = project_id

            response = self.get_success_response(self.organization.slug, **kwargs)
            groups = response.data["groups"]
            assert len(groups) == 1

            return int(groups[0]["totals"]["sum(sentry.sessions.session)"])

        # Request for entire org gives a counter of two:
        assert count_sessions(project_id=None) == 2

        # Request for single project gives a counter of one:
        assert count_sessions(project_id=self.project2.id) == 1

    @pytest.mark.skip("Generic metrics sets, gauges, and distributions are no longer queryable")
    def test_series_are_limited_to_total_order_in_case_with_one_field_orderby(self) -> None:
        # Create time series [1, 2, 3, 4] for every release:
        for minute in range(4):
            for _ in range(minute + 1):
                # One for each release
                for release in ("foo", "bar", "baz"):
                    self.build_and_store_session(
                        project_id=self.project.id,
                        minutes_before_now=3 - minute,
                        release=release,
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

    @pytest.mark.skip("Generic metrics sets, gauges, and distributions are no longer queryable")
    def test_one_field_orderby_with_no_groupby_returns_one_row(self) -> None:
        # Create time series [1, 2, 3, 4] for every release:
        for minute in range(4):
            for _ in range(minute + 1):
                # One for each release
                for release in ("foo", "bar", "baz"):
                    self.build_and_store_session(
                        project_id=self.project.id,
                        minutes_before_now=3 - minute,
                        release=release,
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

    def test_limit_without_orderby_excess_groups_pruned(self) -> None:
        """
        Test that ensures that when requesting series data that is not ordered, if the limit of
        each query is not met, thereby a limit is not applied to the aueries and we end up with
        more groups than the limit then the excess number of groups should be pruned
        """
        for tag, tag_value in (("tag1", "group1"), ("tag1", "group2")):
            self.store_release_health_metric(
                name=SessionMRI.RAW_SESSION.value,
                tags={tag: tag_value},
                value=10,
            )

        for tag, tag_value, numbers in (
            ("tag1", "group2", list(range(3))),
            ("tag1", "group3", list(range(3, 6))),
        ):
            for value in numbers:
                self.store_release_health_metric(
                    name=SessionMRI.RAW_ERROR.value,
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

    def test_limit_without_orderby_partial_groups_pruned(self) -> None:
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
                name=SessionMRI.RAW_SESSION.value,
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
                    name=SessionMRI.RAW_ERROR.value,
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
    def test_groupby_project(self) -> None:
        self.build_and_store_session(project_id=self.project2.id)

        for _ in range(2):
            self.build_and_store_session(project_id=self.project.id)

        response = self.get_success_response(
            self.organization.slug,
            statsPeriod="1h",
            interval="1h",
            field="sum(sentry.sessions.session)",
            groupBy=["project_id"],
        )

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

    def test_unknown_groupby(self) -> None:
        """Use a tag name in groupby that does not exist in the indexer"""
        # Insert session metrics:
        self.build_and_store_session(
            project_id=self.project.id,
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

        self.get_error_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="1h",
            interval="1h",
            groupBy=["bar"],
            status_code=400,
        )

    @mock.patch(
        "sentry.releases.endpoints.organization_release_health_data.OrganizationReleaseHealthDataEndpoint.default_per_page",
        1,
    )
    def test_no_limit_with_series(self) -> None:
        """Pagination args do not apply to series"""
        rh_indexer_record(self.organization.id, "session.status")
        for minute in range(4):
            self.build_and_store_session(
                project_id=self.project.id,
                minutes_before_now=minute,
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

    def test_unknown_filter(self) -> None:
        """Use a tag key/value in filter that does not exist in the indexer"""
        # Insert session metrics:
        self.build_and_store_session(project_id=self.project.id)

        self.get_error_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="1h",
            interval="1h",
            query="foo:123",  # Unknown tag key
            status_code=400,
        )

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

    def test_request_too_granular(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="24h",
            interval="5m",
            per_page=50,
            orderBy="-sum(sentry.sessions.session)",
            status_code=400,
        )
        assert response.data["detail"] == (
            f"Requested intervals (288) of timedelta of {timedelta(minutes=5)} with statsPeriod "
            f"timedelta of {timedelta(hours=24)} is too granular "
            f"for a per_page of 51 elements. Increase your interval, decrease your statsPeriod, "
            f"or decrease your per_page parameter."
        )

    def test_include_series(self) -> None:
        rh_indexer_record(self.organization.id, "session.status")
        self.build_and_store_session(
            project_id=self.project.id,
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

        self.get_error_response(
            self.organization.slug,
            field="sum(sentry.sessions.session)",
            statsPeriod="1h",
            interval="1h",
            includeSeries="0",
            includeTotals="0",
            status_code=400,
        )


@freeze_time(MetricsAPIBaseTestCase.MOCK_DATETIME)
class DerivedMetricsDataTest(MetricsAPIBaseTestCase):
    endpoint = "sentry-api-0-organization-metrics-data"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.login_as(user=self.create_user(is_staff=True), staff=True)
        org_id = self.organization.id
        self.session_duration_metric = rh_indexer_record(org_id, SessionMRI.RAW_DURATION.value)
        self.session_metric = rh_indexer_record(org_id, SessionMRI.RAW_SESSION.value)
        self.session_user_metric = rh_indexer_record(org_id, SessionMRI.RAW_USER.value)
        self.session_error_metric = rh_indexer_record(org_id, SessionMRI.RAW_ERROR.value)
        self.session_status_tag = rh_indexer_record(org_id, "session.status")
        self.release_tag = rh_indexer_record(self.organization.id, "release")

    @property
    def now(self) -> datetime:
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    @patch("sentry.snuba.metrics.fields.base.DERIVED_METRICS", MOCKED_DERIVED_METRICS)
    @patch("sentry.snuba.metrics.query.parse_mri")
    @patch("sentry.snuba.metrics.fields.base.get_public_name_from_mri")
    @patch("sentry.snuba.metrics.query_builder.get_mri")
    @patch("sentry.snuba.metrics.query.get_public_name_from_mri")
    @patch("sentry.releases.endpoints.organization_release_health_data.parse_field")
    def test_derived_metric_incorrectly_defined_as_singular_entity(
        self,
        mocked_parse_field: mock.MagicMock,
        mocked_get_public_name_from_mri: mock.MagicMock,
        mocked_get_mri_query: mock.MagicMock,
        mocked_reverse_mri: mock.MagicMock,
        mocked_parse_mri: mock.MagicMock,
    ) -> None:
        mocked_get_public_name_from_mri.return_value = "crash_free_fake"
        mocked_get_mri_query.return_value = "crash_free_fake"
        mocked_reverse_mri.return_value = "crash_free_fake"
        mocked_parse_mri.return_value = ParsedMRI("e", "sessions", "crash_free_fake", "none")
        mocked_parse_field.return_value = MetricField(None, "e:sessions/crashed_free_fake@none")

        for status in ["ok", "crashed"]:
            for minute in range(4):
                self.build_and_store_session(
                    project_id=self.project.id,
                    minutes_before_now=minute,
                    status=status,
                )

        response = self.get_error_response(
            self.organization.slug,
            field=["crash_free_fake"],
            statsPeriod="6m",
            interval="1m",
            useCase="sessions",
            status_code=400,
        )
        assert response.data["detail"] == (
            "Derived Metric crash_free_fake cannot be calculated from a single entity"
        )

    def test_derived_metric_does_not_exist(self) -> None:
        """
        Test that ensures appropriate exception is raised when a request is made for a field with no
        operation and a field that is not a valid derived metric
        """
        response = self.get_error_response(
            self.organization.slug,
            project=[self.project.id],
            field=["crash_free_fake"],
            statsPeriod="6m",
            interval="1m",
            status_code=400,
        )
        assert response.data["detail"] == (
            "Failed to parse 'crash_free_fake'. The metric name must belong to a public metric."
        )

    def test_staff_crash_free_percentage(self) -> None:
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

        for status in ["ok", "crashed"]:
            for minute in range(4):
                self.build_and_store_session(
                    project_id=self.project.id,
                    minutes_before_now=minute,
                    status=status,
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

    def test_crash_free_percentage(self) -> None:
        for status in ["ok", "crashed"]:
            for minute in range(4):
                self.build_and_store_session(
                    project_id=self.project.id,
                    minutes_before_now=minute,
                    status=status,
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

    def test_crash_free_percentage_with_orderby(self) -> None:
        for status in ["ok", "crashed"]:
            for minute in range(4):
                self.build_and_store_session(
                    project_id=self.project.id,
                    minutes_before_now=minute,
                    status=status,
                    release="foobar@1.0",
                )

        for minute in range(4):
            self.build_and_store_session(
                project_id=self.project.id,
                minutes_before_now=minute,
                status="ok",
                release="foobar@2.0",
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

    def test_crash_free_rate_when_no_session_metrics_data_exist(self) -> None:
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

    def test_crash_free_rate_when_no_session_metrics_data_with_orderby_and_groupby(self) -> None:
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

    def test_incorrect_crash_free_rate(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            project=[self.project.id],
            field=[f"sum({SessionMetricKey.CRASH_FREE_RATE.value})"],
            statsPeriod="6m",
            interval="1m",
            status_code=400,
        )
        assert (response.data["detail"]) == (
            "Failed to parse sum(session.crash_free_rate). No operations can be applied on this "
            "field as it is already a derived metric with an aggregation applied to it."
        )

    def test_errored_sessions(self) -> None:
        for tag_value, value in (
            ("errored_preaggr", 10),
            ("crashed", 2),
            ("abnormal", 4),
            ("init", 15),
        ):
            self.store_release_health_metric(
                name=SessionMRI.RAW_SESSION.value,
                tags={"session.status": tag_value},
                value=value,
                minutes_before_now=4,
            )
        for value in range(3):
            self.store_release_health_metric(
                name=SessionMRI.RAW_ERROR.value,
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

    def test_orderby_composite_entity_derived_metric(self) -> None:
        self.build_and_store_session(
            project_id=self.project.id,
            status="ok",
            release="foobar@2.0",
            errors=2,
        )

        response = self.get_error_response(
            self.organization.slug,
            field=["session.errored"],
            statsPeriod="6m",
            interval="1m",
            groupBy=["release"],
            orderBy=["session.errored"],
            status_code=400,
        )
        assert response.data["detail"] == (
            "Selected 'orderBy' columns must belongs to the same entity"
        )

    def test_abnormal_sessions(self) -> None:
        for tag_value, value, minutes in (
            ("foo", 4, 4),
            ("bar", 3, 2),
        ):
            self.store_release_health_metric(
                name=SessionMRI.RAW_SESSION.value,
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

    def test_crashed_user_sessions(self) -> None:
        for tag_value, values in (
            ("foo", [1, 2, 4]),
            ("bar", [1, 2, 4, 8, 9, 5]),
        ):
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.RAW_USER.value,
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

    def test_all_user_sessions(self) -> None:
        for value in [1, 2, 4]:
            self.store_release_health_metric(
                name=SessionMRI.RAW_USER.value,
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

    def test_abnormal_user_sessions(self) -> None:
        cases: tuple[tuple[dict[str, str], list[int]], ...] = (
            ({"session.status": "abnormal"}, [1, 2, 4]),
            ({}, [1, 2, 4, 7, 9]),
        )
        for tags, values in cases:
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.RAW_USER.value,
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

    def test_crash_free_user_percentage_with_orderby(self) -> None:
        for tags, values in (
            ({"release": "foobar@1.0"}, [1, 2, 4, 8]),
            ({"session.status": "crashed", "release": "foobar@1.0"}, [1, 2]),
            ({"release": "foobar@2.0"}, [3, 5]),
        ):
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.RAW_USER.value,
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

    def test_crash_free_user_rate_orderby_crash_free_rate(self) -> None:
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
                    name=SessionMRI.RAW_USER.value,
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
                name=SessionMRI.RAW_SESSION.value,
                tags={"session.status": tag_value, "release": release_tag_value},
                value=value,
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

    def test_healthy_sessions(self) -> None:
        for tags, value in (
            ({"session.status": "errored_preaggr", "release": "foo"}, 4),
            ({"session.status": "init", "release": "foo"}, 10),
        ):
            self.store_release_health_metric(
                name=SessionMRI.RAW_SESSION.value,
                tags=tags,
                value=value,
            )

        for value in range(3):
            self.store_release_health_metric(
                name=SessionMRI.RAW_ERROR.value,
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

    def test_healthy_sessions_preaggr(self) -> None:
        """Healthy sessions works also when there are no individual errors"""
        for tag_value, value in (
            ("errored_preaggr", 4),
            ("init", 10),
        ):
            self.store_release_health_metric(
                name=SessionMRI.RAW_SESSION.value,
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

    def test_errored_user_sessions(self) -> None:
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
                    name=SessionMRI.RAW_USER.value,
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

    def test_errored_user_sessions_clamped_to_zero(self) -> None:
        # Crashed 3
        # Errored all 0
        # Errored = -3
        for value in [1, 2, 4]:
            self.store_release_health_metric(
                name=SessionMRI.RAW_USER.value,
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

    def test_healthy_user_sessions(self) -> None:
        cases: tuple[tuple[dict[str, str], list[int]], ...] = (
            ({}, [1, 2, 4, 5, 7]),  # 3 and 6 did not recorded at init
            ({"session.status": "ok"}, [3]),  # 3 was not in init, but still counts
            ({"session.status": "errored"}, [1, 2, 6]),  # 6 was not in init, but still counts
        )
        for tags, values in cases:
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.RAW_USER.value,
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

    def test_healthy_user_sessions_clamped_to_zero(self) -> None:
        # init = 0
        # errored_all = 1
        self.store_release_health_metric(
            name=SessionMRI.RAW_USER.value,
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

    def test_request_private_derived_metric(self) -> None:
        for private_name in [
            "session.crashed_and_abnormal_user",
            "session.errored_set",
            "session.errored_user_all",
        ]:
            response = self.get_error_response(
                self.organization.slug,
                project=[self.project.id],
                field=[private_name],
                statsPeriod="6m",
                interval="6m",
                status_code=400,
            )
            assert response.data["detail"] == (
                f"Failed to parse '{private_name}'. The metric name must belong to a public metric."
            )

    def test_session_duration_derived_alias(self) -> None:
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

    def test_do_not_return_negative_crash_free_rate_value_to_the_customer(self) -> None:
        """
        Bug: https://github.com/getsentry/sentry/issues/73172
        Assert that negative value is never returned to the user, even
        in case when there is a problem with the data, instead of negative value we return 0.
        This problem happens during ingestion when 'e:session/crashed' metric is
        ingested, but 'e:session/all' for some reason is not. That would cause
        crash_free_rate value to be negative since it is calculated as:

        crash_free_rate = 1 - (count('e:session/crashed') / count('e:session/all'))
        """
        # ingesting 'e:session/all' and 'e:session/crashed'
        self.build_and_store_session(
            project_id=self.project.id,
            minutes_before_now=1,
            status="crashed",
        )

        # manually ingesting only 'e:session/crashed' metric
        # to make sure that there are more 'e:session/crashed' metrics ingested
        # than 'e:session/all'
        for i in range(2):
            session = self.build_session(
                started=self.adjust_timestamp(
                    self.now
                    - timedelta(
                        minutes=i,
                    )
                ).timestamp()
            )
            # ingesting only 'e:session/crashed'
            self.store_metric(
                self.organization.id,
                self.project.id,
                SessionMRI.RAW_SESSION.value,
                {"session.status": "crashed"},
                int(session["started"]),
                +1,
            )

        response = self.get_success_response(
            self.organization.slug,
            field=["session.crash_free_rate", "session.all", "session.crashed"],
            statsPeriod="6m",
            interval="1m",
        )

        group = response.data["groups"][0]
        assert group["totals"]["session.all"] == 1.0
        assert group["totals"]["session.crashed"] == 3.0
        assert group["totals"]["session.crash_free_rate"] == 0.0
        for value in group["series"]["session.crash_free_rate"]:
            assert value is None or value >= 0

    def test_do_not_return_crash_rate_value_greater_than_one(self) -> None:
        """
        Assert that value for crash_rate won't be greater than 1.
        This can happen due to possible corruption of data.  This problem
        happens during ingestion when 'e:session/crashed' metric is
        ingested, but 'e:session/all' for some reason is not.
        """

        # ingesting 'e:session/all' and 'e:session/crashed'
        self.build_and_store_session(
            project_id=self.project.id,
            minutes_before_now=1,
            status="crashed",
        )

        # manually ingesting only 'e:session/crashed' metric
        # to make sure that there are more 'e:session/crashed' metrics ingested
        # than 'e:session/all'
        for i in range(2):
            session = self.build_session(
                started=self.adjust_timestamp(
                    self.now
                    - timedelta(
                        minutes=i,
                    )
                ).timestamp()
            )
            # ingesting only 'e:session/crashed'
            self.store_metric(
                self.organization.id,
                self.project.id,
                SessionMRI.RAW_SESSION.value,
                {"session.status": "crashed"},
                int(session["started"]),
                +1,
            )

        response = self.get_success_response(
            self.organization.slug,
            field=["session.crash_rate", "session.all", "session.crashed"],
            statsPeriod="6m",
            interval="1m",
        )
        group = response.data["groups"][0]
        assert group["totals"]["session.all"] == 1.0
        assert group["totals"]["session.crashed"] == 3.0
        assert group["totals"]["session.crash_rate"] == 1.0  # value is capped at 1.0
        for value in group["series"]["session.crash_rate"]:
            assert value is None or value <= 1

    def test_metric_without_operation_is_not_allowed(self) -> None:
        """
        Do not allow to query for a metric without operation.
        For example:
            - querying for `sentry.sessions.session` is not valid because operation is missing
            - querying for `sum(sentry.sessions.session)` is valid because operation `sum` exists
        """
        self.build_and_store_session(
            project_id=self.project.id,
            minutes_before_now=1,
            status="crashed",
        )

        response = self.get_error_response(
            self.organization.slug,
            field=["sentry.sessions.session"],
            includeSeries=0,
            statsPeriod="6m",
            interval="1m",
            status_code=400,
        )
        result = json.loads(response.content)
        assert "detail" in result
        assert result["detail"] == "You can not use generic metric public field without operation"

        response = self.get_success_response(
            self.organization.slug,
            field=["sum(sentry.sessions.session)"],
            includeSeries=0,
            statsPeriod="6m",
            interval="1m",
        )
        assert response.status_code == 200

    def test_abnormal_rate_sessions_and_users(self) -> None:
        for tags, values in (
            ({"release": "foobar@1.0"}, [1, 2, 4, 8]),
            ({"session.status": "abnormal", "release": "foobar@1.0"}, [1, 2]),
            ({"release": "foobar@2.0"}, [3, 5]),
        ):
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.RAW_USER.value,
                    tags=tags,
                    value=value,
                )

        for tag_value, release_tag_value, value, second in (
            ("init", "foobar@1.0", 4, 4),
            ("abnormal", "foobar@1.0", 1, 2),
            ("init", "foobar@2.0", 4, 4),
            ("abnormal", "foobar@2.0", 3, 2),
        ):
            self.store_release_health_metric(
                name=SessionMRI.RAW_SESSION.value,
                tags={"session.status": tag_value, "release": release_tag_value},
                value=value,
            )

        response = self.get_success_response(
            self.organization.slug,
            field=[
                "session.abnormal_rate",
                "session.abnormal_user_rate",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy="release",
            orderBy="-session.abnormal_user_rate",
        )
        group = response.data["groups"][0]
        assert group["by"]["release"] == "foobar@1.0"
        assert group["totals"]["session.abnormal_rate"] == 0.25
        assert group["totals"]["session.abnormal_user_rate"] == 0.5

        group = response.data["groups"][1]
        assert group["by"]["release"] == "foobar@2.0"
        assert group["totals"]["session.abnormal_rate"] == 0.75
        assert group["totals"]["session.abnormal_user_rate"] == 0.0

    def test_errored_rate_sessions_and_users(self) -> None:
        for tags, values in (
            ({"release": "foobar@1.0"}, [1, 2, 4, 8]),
            ({"session.status": "errored", "release": "foobar@1.0"}, [1, 2]),
            ({"release": "foobar@2.0"}, [3, 5]),
        ):
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.RAW_USER.value,
                    tags=tags,
                    value=value,
                )

        for tag_value, release_tag_value, value in (
            ("init", "foobar@1.0", 4),
            ("errored_preaggr", "foobar@1.0", 1),
            ("init", "foobar@2.0", 4),
            ("errored_preaggr", "foobar@2.0", 3),
        ):
            self.store_release_health_metric(
                name=SessionMRI.RAW_SESSION.value,
                tags={"session.status": tag_value, "release": release_tag_value},
                value=value,
            )

        response = self.get_success_response(
            self.organization.slug,
            field=[
                "session.errored_rate",
                "session.errored_user_rate",
                "sum(sentry.sessions.session)",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy="release",
            orderBy="sum(sentry.sessions.session)",
        )
        group = response.data["groups"][0]
        assert group["by"]["release"] == "foobar@1.0"
        assert group["totals"]["session.errored_rate"] == 0.25
        assert group["totals"]["session.errored_user_rate"] == 0.5

        group = response.data["groups"][1]
        assert group["by"]["release"] == "foobar@2.0"
        assert group["totals"]["session.errored_rate"] == 0.75
        assert group["totals"]["session.errored_user_rate"] == 0.0

    def test_unhandled_rate_sessions_and_users(self) -> None:
        for tags, values in (
            ({"release": "foobar@1.0"}, [1, 2, 4, 8]),
            ({"session.status": "unhandled", "release": "foobar@1.0"}, [1, 2]),
            ({"release": "foobar@2.0"}, [3, 5]),
        ):
            for value in values:
                self.store_release_health_metric(
                    name=SessionMRI.RAW_USER.value,
                    tags=tags,
                    value=value,
                )

        for tag_value, release_tag_value, value in (
            ("init", "foobar@1.0", 4),
            ("unhandled", "foobar@1.0", 1),
            ("init", "foobar@2.0", 4),
            ("unhandled", "foobar@2.0", 3),
        ):
            self.store_release_health_metric(
                name=SessionMRI.RAW_SESSION.value,
                tags={"session.status": tag_value, "release": release_tag_value},
                value=value,
            )

        response = self.get_success_response(
            self.organization.slug,
            field=[
                "session.unhandled_rate",
                "session.unhandled_user_rate",
                "sum(sentry.sessions.session)",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy="release",
            orderBy="sum(sentry.sessions.session)",
        )
        group = response.data["groups"][0]
        assert group["by"]["release"] == "foobar@1.0"
        assert group["totals"]["session.unhandled_rate"] == 0.25
        assert group["totals"]["session.unhandled_user_rate"] == 0.5

        group = response.data["groups"][1]
        assert group["by"]["release"] == "foobar@2.0"
        assert group["totals"]["session.unhandled_rate"] == 0.75
        assert group["totals"]["session.unhandled_user_rate"] == 0.0

    def test_unhealthy_rate_sessions(self) -> None:
        for tag_value, release_tag_value, value in (
            ("init", "foobar@1.0", 4),
            ("errored_preaggr", "foobar@1.0", 1),
            ("init", "foobar@2.0", 4),
        ):
            self.store_release_health_metric(
                name=SessionMRI.RAW_SESSION.value,
                tags={"session.status": tag_value, "release": release_tag_value},
                value=value,
            )
        # Unhealthy rate relies on RAW_ERROR metric
        for tag_value, release_tag_value, value in (
            ("abnormal", "foobar@2.0", 1),
            ("unhandled", "foobar@2.0", 2),
            ("crashed", "foobar@2.0", 3),
        ):
            self.store_release_health_metric(
                name=SessionMRI.RAW_ERROR.value,
                tags={"release": release_tag_value},
                value=value,
            )

        response = self.get_success_response(
            self.organization.slug,
            field=[
                "session.unhealthy_rate",
                "sum(sentry.sessions.session)",
            ],
            statsPeriod="1h",
            interval="1h",
            groupBy="release",
            orderBy="-sum(sentry.sessions.session)",
        )
        group = response.data["groups"][0]
        assert group["by"]["release"] == "foobar@1.0"
        assert group["totals"]["session.unhealthy_rate"] == 0.25

        group = response.data["groups"][1]
        assert group["by"]["release"] == "foobar@2.0"
        assert group["totals"]["session.unhealthy_rate"] == 0.75
