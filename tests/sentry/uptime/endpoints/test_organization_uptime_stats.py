import uuid
from datetime import datetime, timedelta, timezone
from unittest import skip

from sentry.testutils.cases import UptimeCheckSnubaTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.uptime.endpoints.organization_uptime_stats import add_extra_buckets_for_epoch_cutoff
from sentry.utils import json
from tests.sentry.uptime.endpoints.test_organization_uptime_alert_index import (
    OrganizationUptimeAlertIndexBaseEndpointTest,
)

MOCK_DATETIME = datetime.now(tz=timezone.utc) - timedelta(days=1)


@freeze_time(MOCK_DATETIME)
class OrganizationUptimeCheckIndexEndpointTest(
    OrganizationUptimeAlertIndexBaseEndpointTest, UptimeCheckSnubaTestCase
):
    endpoint = "sentry-api-0-organization-uptime-stats"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.subscription_id = uuid.uuid4().hex
        self.subscription = self.create_uptime_subscription(
            url="https://santry.io", subscription_id=self.subscription_id
        )
        self.project_uptime_subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.subscription
        )

        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="success")
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="failure")
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="success")
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="failure")
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="success")
        self.store_snuba_uptime_check(subscription_id=self.subscription_id, check_status="failure")

    def test_simple(self):
        """Test that the endpoint returns data for a simple uptime check."""

        response = self.get_success_response(
            self.organization.slug,
            project=[self.project.id],
            projectUptimeSubscriptionId=[str(self.project_uptime_subscription.id)],
            since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1d",
        )
        assert response.data is not None
        data = json.loads(json.dumps(response.data))
        assert len(data[str(self.project_uptime_subscription.id)]) == 7
        assert data[str(self.project_uptime_subscription.id)][-1][1] == {
            "failure": 3,
            "success": 3,
            "missed_window": 0,
        }
        assert data[str(self.project_uptime_subscription.id)][0][1] == {
            "failure": 0,
            "success": 0,
            "missed_window": 0,
        }

    @override_options(
        {"uptime.date_cutoff_epoch_seconds": (MOCK_DATETIME - timedelta(days=1)).timestamp()}
    )
    def test_simple_with_date_cutoff(self):
        """Test that the endpoint returns data for a simple uptime check."""

        response = self.get_success_response(
            self.organization.slug,
            project=[self.project.id],
            projectUptimeSubscriptionId=[str(self.project_uptime_subscription.id)],
            since=(datetime.now(timezone.utc) - timedelta(days=90)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1d",
        )
        assert response.data is not None
        data = json.loads(json.dumps(response.data))
        assert len(data[str(self.project_uptime_subscription.id)]) == 90

    @override_options(
        {"uptime.date_cutoff_epoch_seconds": (MOCK_DATETIME - timedelta(days=1)).timestamp()}
    )
    def test_simple_with_date_cutoff_rounded_resolution(self):
        """Test that the endpoint returns data for a simple uptime check."""

        response = self.get_success_response(
            self.organization.slug,
            project=[self.project.id],
            projectUptimeSubscriptionId=[str(self.project_uptime_subscription.id)],
            since=(datetime.now(timezone.utc) - timedelta(days=89, hours=1)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1d",
        )
        assert response.data is not None
        data = json.loads(json.dumps(response.data))
        assert len(data[str(self.project_uptime_subscription.id)]) == 89

    @override_options(
        {"uptime.date_cutoff_epoch_seconds": (MOCK_DATETIME - timedelta(days=1)).timestamp()}
    )
    def test_simple_with_date_cutoff_rounded_resolution_past_cutoff(self):
        """Test that the endpoint returns data for a simple uptime check."""
        subscription_id = uuid.uuid4().hex
        subscription = self.create_uptime_subscription(
            url="https://santry.io/test", subscription_id=subscription_id
        )
        project_uptime_subscription = self.create_project_uptime_subscription(
            uptime_subscription=subscription
        )

        self.store_snuba_uptime_check(
            subscription_id=subscription_id,
            check_status="success",
            scheduled_check_time=(MOCK_DATETIME - timedelta(days=5)),
        )
        self.store_snuba_uptime_check(
            subscription_id=subscription_id,
            check_status="failure",
            scheduled_check_time=MOCK_DATETIME - timedelta(days=5),
        )
        self.store_snuba_uptime_check(
            subscription_id=subscription_id,
            check_status="failure",
            scheduled_check_time=MOCK_DATETIME - timedelta(hours=2),
        )

        response = self.get_success_response(
            self.organization.slug,
            project=[self.project.id],
            projectUptimeSubscriptionId=[str(project_uptime_subscription.id)],
            since=(datetime.now(timezone.utc) - timedelta(days=89, hours=1)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1d",
        )
        assert response.data is not None
        data = json.loads(json.dumps(response.data))
        # check that we return all the intervals,
        # but the last one is the failure
        assert len(data[str(project_uptime_subscription.id)]) == 89
        assert data[str(project_uptime_subscription.id)][-1][1] == {
            "failure": 1,
            "success": 0,
            "missed_window": 0,
        }
        # make sure the rest of the intervals are empty
        for i in range(88):
            assert data[str(project_uptime_subscription.id)][i][1] == {
                "failure": 0,
                "success": 0,
                "missed_window": 0,
            }

    def test_invalid_uptime_subscription_id(self):
        """Test that the endpoint returns data for a simple uptime check."""
        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            projectUptimeSubscriptionId=[str(uuid.uuid4())],
            since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1d",
        )
        assert response.status_code == 400

    def test_no_uptime_subscription_id(self):
        """Test that the endpoint returns data for a simple uptime check."""
        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            projectUptimeSubscriptionId=[],
            since=(datetime.now(timezone.utc) - timedelta(days=7)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1d",
        )
        assert response.status_code == 400

    @skip("vgrozdanic: This test is flaky and should be skipped")
    def test_too_many_periods(self):
        """Test that the endpoint returns data for a simple uptime check."""

        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            projectUptimeSubscriptionId=[str(self.project_uptime_subscription.id)],
            since=(datetime.now(timezone.utc) - timedelta(days=90)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1h",
        )
        assert response.status_code == 400

    def test_too_many_uptime_subscription_ids(self):
        """Test that the endpoint returns data for a simple uptime check."""

        response = self.get_response(
            self.organization.slug,
            project=[self.project.id],
            projectUptimeSubscriptionId=[str(uuid.uuid4()) for _ in range(101)],
            since=(datetime.now(timezone.utc) - timedelta(days=90)).timestamp(),
            until=datetime.now(timezone.utc).timestamp(),
            resolution="1h",
        )
        assert response.status_code == 400


# TODO(jferg): remove after 90 days
def test_add_extra_buckets_for_epoch_cutoff():
    """Test adding extra buckets when there's an epoch cutoff"""
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    end = datetime(2025, 1, 2, tzinfo=timezone.utc)
    epoch_cutoff = datetime(2025, 1, 1, 12, tzinfo=timezone.utc)
    rollup = 3600  # 1 hour

    # Generate 12 hours of data points starting at epoch cutoff
    data_points = []
    for i in range(12):
        timestamp = int(epoch_cutoff.timestamp()) + (i * 3600)
        data_points.append(
            (timestamp, {"failure": i % 3, "success": (3 - i % 3), "missed_window": 0})
        )

    subscription_id = 1234
    formatted_response = {subscription_id: data_points}

    result = add_extra_buckets_for_epoch_cutoff(
        formatted_response, epoch_cutoff, rollup, start, end
    )

    # Should have 24 buckets total (24 hours worth)
    assert len(result[subscription_id]) == 24

    # First bucket should be at start time
    assert result[subscription_id][0][0] == int(start.timestamp())

    # Last bucket should be the original last bucket
    assert result[subscription_id][-1] == formatted_response[subscription_id][-1]

    # Added buckets should have zero counts
    for bucket in result[subscription_id][:12]:
        assert bucket[1] == {"failure": 0, "success": 0, "missed_window": 0}

    # Test when epoch cutoff is before start - should return original
    result = add_extra_buckets_for_epoch_cutoff(
        formatted_response, datetime(2024, 1, 1, tzinfo=timezone.utc), rollup, start, end
    )
    assert result == formatted_response

    # Test with no epoch cutoff - should return original
    result = add_extra_buckets_for_epoch_cutoff(formatted_response, None, rollup, start, end)
    assert result == formatted_response
