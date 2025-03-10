from unittest import mock

from sentry.monitors.models import (
    Monitor,
    MonitorEnvironment,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.monitors.rate_limit import get_project_monitor_quota
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options


@mock.patch("sentry.monitors.rate_limit.QUOTA_WINDOW", 45)
@mock.patch("sentry.monitors.rate_limit.ALLOWED_MINIMUM", 5)
class MonitorRateLimit(TestCase):
    @override_options({"crons.per_monitor_rate_limit": 2})
    def test_minimum(self):
        """
        Without any monitor environments we'll always return ALLOWED_MINIMUM.
        """
        limit, window = get_project_monitor_quota(self.project)
        assert limit == 5
        assert window == 45

    @override_options({"crons.per_monitor_rate_limit": 2})
    def test_computed_from_environments(self):
        """
        Validate that the quota is computed from the total number of monitor
        environments in a project.
        """
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "*/5 * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        mon_env_count = 10
        for i in range(mon_env_count):
            env = self.create_environment(self.project, name=f"test-{i}")
            MonitorEnvironment.objects.create(
                monitor=monitor,
                environment_id=env.id,
                status=MonitorStatus.OK,
            )

        # The rate limit is per project, create another monitor in a different
        # project to validate it is not counted
        project2 = self.create_project(organization=self.organization)
        monitor2 = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=project2.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "*/5 * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        MonitorEnvironment.objects.create(
            monitor=monitor2,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )

        limit, window = get_project_monitor_quota(self.project, cache_bust=True)
        assert limit == 25
        assert window == 45
