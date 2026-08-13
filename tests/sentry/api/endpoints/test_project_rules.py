from django.test import override_settings

from sentry.api.endpoints.project_rules import get_max_alerts
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class GetMaxAlertsTest(APITestCase):
    @override_settings(MAX_SLOW_CONDITION_ISSUE_ALERTS=1)
    def test_get_max_alerts_slow(self) -> None:
        result = get_max_alerts(self.project, "slow")
        assert result == 1

    @with_feature("organizations:more-slow-alerts")
    @override_settings(MAX_SLOW_CONDITION_ISSUE_ALERTS=1)
    @override_settings(MAX_MORE_SLOW_CONDITION_ISSUE_ALERTS=2)
    def test_get_max_alerts_more_slow(self) -> None:
        result = get_max_alerts(self.project, "slow")
        assert result == 2

    @override_settings(MAX_FAST_CONDITION_ISSUE_ALERTS=1)
    def test_get_max_alerts_fast(self) -> None:
        result = get_max_alerts(self.project, "fast")
        assert result == 1

    @with_feature("organizations:more-fast-alerts")
    @override_settings(MAX_FAST_CONDITION_ISSUE_ALERTS=1)
    @override_settings(MAX_MORE_FAST_CONDITION_ISSUE_ALERTS=2)
    def test_get_max_alerts_more_fast_with_group_processing(self) -> None:
        result = get_max_alerts(self.project, "fast")
        assert result == 2

    @override_settings(MAX_FAST_CONDITION_ISSUE_ALERTS=1)
    @override_settings(MAX_MORE_FAST_CONDITION_ISSUE_ALERTS=2)
    def test_get_max_alerts_fast_with_group_processing(self) -> None:
        result = get_max_alerts(self.project, "fast")
        assert result == 1

    @override_settings(MAX_SLOW_CONDITION_ISSUE_ALERTS=1)
    @override_settings(MAX_MORE_SLOW_CONDITION_ISSUE_ALERTS=2)
    def test_get_max_alerts_slow_with_group_processing(self) -> None:
        result = get_max_alerts(self.project, "slow")
        assert result == 1
