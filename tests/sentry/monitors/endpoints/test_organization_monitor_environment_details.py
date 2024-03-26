from tests.sentry.monitors.endpoints.test_base_monitor_environment_details import (
    BaseDeleteMonitorTest,
    BaseUpdateMonitorEnvironmentTest,
)


class UpdateMonitorEnvironmentTest(BaseUpdateMonitorEnvironmentTest):
    endpoint = "sentry-api-0-organization-monitor-environment-details"
    __test__ = True


class DeleteMonitorTest(BaseDeleteMonitorTest):
    endpoint = "sentry-api-0-organization-monitor-environment-details"
    __test__ = True
