from tests.sentry.monitors.endpoints.test_base_monitor_details import (
    BaseDeleteMonitorTest,
    BaseMonitorDetailsTest,
    BaseUpdateMonitorTest,
)


class OrganizationMonitorDetailsTest(BaseMonitorDetailsTest):
    endpoint = "sentry-api-0-organization-monitor-details"
    __test__ = True


class UpdateMonitorTest(BaseUpdateMonitorTest):
    endpoint = "sentry-api-0-organization-monitor-details"
    __test__ = True


class DeleteMonitorTest(BaseDeleteMonitorTest):
    endpoint = "sentry-api-0-organization-monitor-details"
    __test__ = True


# TEMPORARY: intentional failure to test CI reporting (remove after verifying)
def test_intentional_failure_for_ci_reporting():
    assert False, "Intentional failure to test backend CI failure reporting"
