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


def test_quota_config_repr() -> None:
    quota = QuotaConfig(id="o", limit=4711, window=42, reason_code="not_so_fast")

    assert repr(quota) == str(quota.to_json())


def test_quota_config_equality_is_value_based() -> None:
    a = QuotaConfig(id="o", limit=4711, window=42, reason_code="not_so_fast")
    b = QuotaConfig(id="o", limit=4711, window=42, reason_code="not_so_fast")
    c = QuotaConfig(id="o", limit=4712, window=42, reason_code="not_so_fast")

    assert a is not b
    assert a == b
    assert a != c


def test_quota_config_equality_ignores_category_order() -> None:
    a = QuotaConfig(
        limit=0,
        categories=[DataCategory.ERROR, DataCategory.TRANSACTION],
        reason_code="go_away",
    )
    b = QuotaConfig(
        limit=0,
        categories=[DataCategory.TRANSACTION, DataCategory.ERROR],
        reason_code="go_away",
    )

    assert a == b
    assert hash(a) == hash(b)


def test_quota_config_is_hashable_by_value() -> None:
    a = QuotaConfig(id="o", limit=4711, window=42, reason_code="not_so_fast")
    b = QuotaConfig(id="o", limit=4711, window=42, reason_code="not_so_fast")

    assert len({a, b}) == 1


def test_quota_config_not_equal_to_other_types() -> None:
    quota = QuotaConfig(limit=0, reason_code="go_away")

    assert quota != object()
    assert (quota == "not a quota") is False


def test_quota_config_total_ordering() -> None:
    a = QuotaConfig(id="a", limit=1, window=60, reason_code="go_away")
    b = QuotaConfig(id="b", limit=1, window=60, reason_code="go_away")

    assert a < b
    assert b > a
    assert a <= b
    assert sorted([b, a]) == [a, b]


def test_quota_config_sort_is_deterministic_regardless_of_input_order() -> None:
    forward = [QuotaConfig(id=i, limit=1, window=60, reason_code="go_away") for i in "abc"]
    backward = [QuotaConfig(id=i, limit=1, window=60, reason_code="go_away") for i in "cba"]

    # Same quotas assembled in different orders sort to the same canonical list,
    # so callers can compare quota lists with ``sorted(a) == sorted(b)``.
    assert sorted(forward) == sorted(backward)
    assert forward != backward


def test_seat_assignable_must_have_reason() -> None:
    with pytest.raises(ValueError):
        SeatAssignmentResult(assignable=False)
    SeatAssignmentResult(assignable=False, reason="because I said so")
    SeatAssignmentResult(assignable=True)
