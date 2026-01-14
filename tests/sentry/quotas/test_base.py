import pytest

from sentry.constants import DataCategory, ObjectStatus
from sentry.models.projectkey import ProjectKey
from sentry.monitors.constants import PermitCheckInStatus
from sentry.monitors.models import Monitor
from sentry.quotas.base import Quota, QuotaConfig, QuotaScope, SeatAssignmentResult
from sentry.testutils.cases import TestCase
from sentry.utils.outcomes import Outcome


class QuotaTest(TestCase):
    def setUp(self) -> None:
        self.backend = Quota()

    def test_get_key_quota(self) -> None:
        key = ProjectKey.objects.create(
            project=self.project, rate_limit_window=5, rate_limit_count=60
        )
        assert self.backend.get_key_quota(key) == (60, 5)

    def test_get_key_quota_empty(self) -> None:
        key = ProjectKey.objects.create(
            project=self.project, rate_limit_window=None, rate_limit_count=None
        )
        assert self.backend.get_key_quota(key) == (None, 0)

    def test_get_key_quota_multiple_keys(self) -> None:
        # This checks for a regression where we'd cache key quotas per project
        # rather than per key.
        key = ProjectKey.objects.create(
            project=self.project, rate_limit_window=None, rate_limit_count=None
        )
        rate_limited_key = ProjectKey.objects.create(
            project=self.project, rate_limit_window=200, rate_limit_count=86400
        )
        assert self.backend.get_key_quota(key) == (None, 0)
        assert self.backend.get_key_quota(rate_limited_key) == (86400, 200)

    def test_get_blended_sample_rate(self) -> None:
        org = self.create_organization()
        assert self.backend.get_blended_sample_rate(organization_id=org.id) is None

    def test_assign_monitor_seat(self) -> None:
        monitor = Monitor.objects.create(
            slug="test-monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="test monitor",
            status=ObjectStatus.ACTIVE,
        )
        assert self.backend.assign_seat(seat_object=monitor) == Outcome.ACCEPTED

    def test_check_accept_monitor_checkin(self) -> None:
        monitor = Monitor.objects.create(
            slug="test-monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="test monitor",
            status=ObjectStatus.ACTIVE,
        )
        assert (
            self.backend.check_accept_monitor_checkin(
                monitor_slug=monitor.slug, project_id=monitor.project_id
            )
            == PermitCheckInStatus.ACCEPT
        )


@pytest.mark.parametrize(
    "obj,json",
    [
        (
            QuotaConfig(id="o", limit=4711, window=42, reason_code="not_so_fast"),
            {
                "id": "o",
                "scope": "organization",
                "limit": 4711,
                "window": 42,
                "reasonCode": "not_so_fast",
            },
        ),
        (
            QuotaConfig(
                id="p",
                scope=QuotaScope.PROJECT,
                scope_id=1,
                limit=None,
                window=1,
                reason_code="go_away",
            ),
            {"id": "p", "scope": "project", "scopeId": "1", "window": 1, "reasonCode": "go_away"},
        ),
        (
            QuotaConfig(limit=0, reason_code="go_away"),
            {"limit": 0, "scope": "organization", "reasonCode": "go_away"},
        ),
        (
            QuotaConfig(limit=0, categories=[DataCategory.TRANSACTION], reason_code="go_away"),
            {
                "limit": 0,
                "scope": "organization",
                "categories": ["transaction"],
                "reasonCode": "go_away",
            },
        ),
    ],
)
def test_quotas_to_json(obj, json) -> None:
    assert obj.to_json() == json


def test_seat_assignable_must_have_reason() -> None:
    with pytest.raises(ValueError):
        SeatAssignmentResult(assignable=False)
    SeatAssignmentResult(assignable=False, reason="because I said so")
    SeatAssignmentResult(assignable=True)
