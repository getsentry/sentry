from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import pytest
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.billing.v1.data_category_pb2 import DataCategory as ProtoDataCategory
from sentry_protos.billing.v1.services.usage.v1.endpoint_usage_pb2 import GetUsageRequest

from sentry.billing.platform.services.usage._outcomes_query import query_outcomes_usage
from sentry.billing.platform.services.usage.service import UsageService
from sentry.constants import DataCategory
from sentry.testutils.cases import OutcomesSnubaTest, TestCase
from sentry.utils.outcomes import Outcome

_now = datetime.now(UTC).replace(hour=12, minute=27, second=28, microsecond=0)


def _make_timestamp(dt: datetime) -> Timestamp:
    ts = Timestamp()
    ts.FromDatetime(dt)
    return ts


def _make_request(
    org_id: int,
    start: datetime,
    end: datetime,
    categories: Sequence[int] | None = None,
) -> GetUsageRequest:
    return GetUsageRequest(
        organization_id=org_id,
        start=_make_timestamp(start),
        end=_make_timestamp(end),
        categories=categories or [],  # type: ignore[arg-type]
    )


@pytest.mark.snuba
class TestOutcomesIntegration(OutcomesSnubaTest, TestCase):
    def test_accepted_errors(self):
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 10,
            },
            num_times=3,
        )

        request = _make_request(
            org_id=self.organization.id,
            start=_now - timedelta(days=1),
            end=_now + timedelta(days=1),
        )
        response = query_outcomes_usage(request)

        assert len(response.days) == 1
        day = response.days[0]
        assert len(day.usage) == 1

        usage = day.usage[0]
        assert usage.category == DataCategory.ERROR
        assert usage.data.accepted == 30
        assert usage.data.total == 30
        assert usage.data.dropped == 0
        assert usage.data.filtered == 0
        assert usage.data.over_quota == 0
        assert usage.data.spike_protection == 0
        assert usage.data.dynamic_sampling == 0

    def test_rate_limited_over_quota(self):
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.RATE_LIMITED,
                "reason": "usage_exceeded",
                "category": DataCategory.ERROR,
                "quantity": 50,
            },
        )

        request = _make_request(
            org_id=self.organization.id,
            start=_now - timedelta(days=1),
            end=_now + timedelta(days=1),
        )
        response = query_outcomes_usage(request)

        assert len(response.days) == 1
        usage = response.days[0].usage[0]
        assert usage.category == DataCategory.ERROR
        assert usage.data.total == 50
        assert usage.data.accepted == 0
        assert usage.data.dropped == 50
        assert usage.data.over_quota == 50
        assert usage.data.spike_protection == 0

    def test_rate_limited_spike_protection(self):
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.RATE_LIMITED,
                "reason": "smart_rate_limit",
                "category": DataCategory.TRANSACTION,
                "quantity": 25,
            },
        )

        request = _make_request(
            org_id=self.organization.id,
            start=_now - timedelta(days=1),
            end=_now + timedelta(days=1),
        )
        response = query_outcomes_usage(request)

        assert len(response.days) == 1
        usage = response.days[0].usage[0]
        assert usage.category == DataCategory.TRANSACTION
        assert usage.data.total == 25
        assert usage.data.dropped == 25
        assert usage.data.spike_protection == 25
        assert usage.data.over_quota == 0

    def test_filtered_dynamic_sampling(self):
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.FILTERED,
                "reason": "Sampled:80",
                "category": DataCategory.TRANSACTION,
                "quantity": 100,
            },
        )

        request = _make_request(
            org_id=self.organization.id,
            start=_now - timedelta(days=1),
            end=_now + timedelta(days=1),
        )
        response = query_outcomes_usage(request)

        assert len(response.days) == 1
        usage = response.days[0].usage[0]
        assert usage.category == DataCategory.TRANSACTION
        assert usage.data.total == 100
        assert usage.data.filtered == 100
        assert usage.data.dynamic_sampling == 100
        assert usage.data.accepted == 0
        assert usage.data.dropped == 0

    def test_multiple_days_and_categories(self):
        today = _now - timedelta(hours=1)
        yesterday = _now - timedelta(days=1, hours=1)

        # Errors today
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": today,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 10,
            },
        )
        # Transactions today
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": today,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.TRANSACTION,
                "quantity": 20,
            },
        )
        # Errors yesterday
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": yesterday,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 5,
            },
        )

        request = _make_request(
            org_id=self.organization.id,
            start=_now - timedelta(days=2),
            end=_now + timedelta(days=1),
        )
        response = query_outcomes_usage(request)

        assert len(response.days) == 2

        # Days should be sorted ascending
        day0_date = response.days[0].date
        day1_date = response.days[1].date
        assert (day0_date.year, day0_date.month, day0_date.day) < (
            day1_date.year,
            day1_date.month,
            day1_date.day,
        )

        # Yesterday: only errors
        yesterday_usage = {int(u.category): u.data for u in response.days[0].usage}
        assert DataCategory.ERROR in yesterday_usage
        assert yesterday_usage[DataCategory.ERROR].accepted == 5

        # Today: errors and transactions
        today_usage = {int(u.category): u.data for u in response.days[1].usage}
        assert DataCategory.ERROR in today_usage
        assert DataCategory.TRANSACTION in today_usage
        assert today_usage[DataCategory.ERROR].accepted == 10
        assert today_usage[DataCategory.TRANSACTION].accepted == 20

    def test_empty_org(self):
        other_org = self.create_organization()

        request = _make_request(
            org_id=other_org.id,
            start=_now - timedelta(days=1),
            end=_now + timedelta(days=1),
        )
        response = query_outcomes_usage(request)

        assert len(response.days) == 0

    def test_end_date_inclusive(self):
        """Data on the last included day (end date) must be returned.

        The proto end field is inclusive — midnight of the last day to include.
        Without the +1 day conversion in the CH backend, this day would be
        excluded because Snuba uses half-open intervals.
        """
        # Store data at 6am on _now's date
        data_time = _now.replace(hour=6, minute=0, second=0, microsecond=0)
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": data_time,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 77,
            },
        )

        # Pass end = midnight of the SAME day as the data.
        # This is how getsentry callers construct the request (inclusive end).
        day_midnight = data_time.replace(hour=0, minute=0, second=0, microsecond=0)
        request = _make_request(
            org_id=self.organization.id,
            start=day_midnight - timedelta(days=1),
            end=day_midnight,  # inclusive: midnight of the data day
        )
        response = query_outcomes_usage(request)

        # The data on this day MUST be included
        assert len(response.days) == 1
        assert response.days[0].usage[0].data.accepted == 77

    def test_category_filter(self):
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 10,
            },
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.TRANSACTION,
                "quantity": 20,
            },
        )

        # Filter to only errors
        request = _make_request(
            org_id=self.organization.id,
            start=_now - timedelta(days=1),
            end=_now + timedelta(days=1),
            categories=[DataCategory.ERROR],
        )
        response = query_outcomes_usage(request)

        assert len(response.days) == 1
        assert len(response.days[0].usage) == 1
        assert response.days[0].usage[0].category == DataCategory.ERROR
        assert response.days[0].usage[0].data.accepted == 10

    def test_category_filter_proto_to_relay_conversion(self):
        """Proto ATTACHMENT=3 must map to Relay ATTACHMENT=4 when filtering CH.

        Proto and Relay use different int values for some categories.
        The request carries proto ints, but CH stores Relay ints.
        """
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ATTACHMENT,  # Relay int = 4
                "quantity": 512,
            },
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,  # Relay int = 1
                "quantity": 10,
            },
        )

        # Filter using proto ATTACHMENT enum value (3), not Relay (4)
        request = _make_request(
            org_id=self.organization.id,
            start=_now - timedelta(days=1),
            end=_now + timedelta(days=1),
            categories=[ProtoDataCategory.DATA_CATEGORY_ATTACHMENT],
        )
        response = query_outcomes_usage(request)

        # Should find the ATTACHMENT data (Relay category 4), not errors
        assert len(response.days) == 1
        assert len(response.days[0].usage) == 1
        assert response.days[0].usage[0].category == DataCategory.ATTACHMENT
        assert response.days[0].usage[0].data.accepted == 512

    def test_overlapping_semantics(self):
        """Verify dropped >= over_quota + spike_protection with real data."""
        # over_quota
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.RATE_LIMITED,
                "reason": "usage_exceeded",
                "category": DataCategory.ERROR,
                "quantity": 30,
            },
        )
        # spike_protection
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.RATE_LIMITED,
                "reason": "smart_rate_limit",
                "category": DataCategory.ERROR,
                "quantity": 20,
            },
        )
        # other rate-limited reason (neither over_quota nor spike)
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.RATE_LIMITED,
                "reason": "some_other_reason",
                "category": DataCategory.ERROR,
                "quantity": 10,
            },
        )

        request = _make_request(
            org_id=self.organization.id,
            start=_now - timedelta(days=1),
            end=_now + timedelta(days=1),
        )
        response = query_outcomes_usage(request)

        assert len(response.days) == 1
        data = response.days[0].usage[0].data

        assert data.dropped == 60  # 30 + 20 + 10
        assert data.over_quota == 30
        assert data.spike_protection == 20
        assert data.dropped >= data.over_quota + data.spike_protection

    def test_full_usage_service_e2e(self):
        """End-to-end test via UsageService().get_usage()."""
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 42,
            },
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "timestamp": _now - timedelta(hours=1),
                "outcome": Outcome.RATE_LIMITED,
                "reason": "usage_exceeded",
                "category": DataCategory.ERROR,
                "quantity": 8,
            },
        )

        request = _make_request(
            org_id=self.organization.id,
            start=_now - timedelta(days=1),
            end=_now + timedelta(days=1),
        )
        response = UsageService().get_usage(request)

        assert len(response.days) == 1
        data = response.days[0].usage[0].data
        assert data.total == 50
        assert data.accepted == 42
        assert data.dropped == 8
        assert data.over_quota == 8
