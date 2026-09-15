import pytest
from django.test import override_settings
from django.urls import resolve

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


@pytest.mark.parametrize(
    "path",
    [
        "/api/0/organizations/org-slug/alert-rules/",
        "/api/0/organizations/org-slug/alert-rules/available-actions/",
        "/api/0/organizations/org-slug/alert-rules/1/",
        "/api/0/organizations/org-slug/combined-rules/",
        "/api/0/organizations/org-slug/ondemand-rules-stats/",
        "/api/0/organizations/org-slug/incidents/",
        "/api/0/organizations/org-slug/incidents/1/",
        "/api/0/projects/org-slug/project-slug/alert-rules/",
        "/api/0/projects/org-slug/project-slug/alert-rules/1/",
        "/api/0/projects/org-slug/project-slug/alert-rules/1/snooze/",
        "/api/0/projects/org-slug/project-slug/alert-rule-task/task-id/",
        "/api/0/projects/org-slug/project-slug/rules/",
        "/api/0/projects/org-slug/project-slug/rules/configuration/",
        "/api/0/projects/org-slug/project-slug/rules/1/",
        "/api/0/projects/org-slug/project-slug/rules/1/snooze/",
        "/api/0/projects/org-slug/project-slug/rules/preview/",
        "/api/0/projects/org-slug/project-slug/rule-actions/",
        "/api/0/projects/org-slug/project-slug/rule-task/task-id/",
    ],
)
def test_deprecated_alert_endpoint_removed(path: str) -> None:
    assert resolve(path).url_name == "sentry-api-catchall"
