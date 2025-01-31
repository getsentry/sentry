import pytest
from django.db import router, transaction
from django.db.utils import IntegrityError

from sentry.models.organization import OrganizationStatus
from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.models import (
    ProjectUptimeSubscription,
    UptimeSubscription,
    disable_uptime_monitors_for_org,
    get_active_auto_monitor_count_for_org,
)


class GetActiveMonitorCountForOrgTest(UptimeTestCase):
    def test(self):
        assert get_active_auto_monitor_count_for_org(self.organization) == 0
        self.create_project_uptime_subscription()
        assert get_active_auto_monitor_count_for_org(self.organization) == 1

        other_sub = self.create_uptime_subscription(url="https://santry.io")
        self.create_project_uptime_subscription(uptime_subscription=other_sub)
        assert get_active_auto_monitor_count_for_org(self.organization) == 2

        other_org = self.create_organization()
        other_proj = self.create_project(organization=other_org)
        self.create_project_uptime_subscription(uptime_subscription=other_sub, project=other_proj)
        assert get_active_auto_monitor_count_for_org(self.organization) == 2
        assert get_active_auto_monitor_count_for_org(other_org) == 1


class UniqueMonitorTest(UptimeTestCase):
    def test(self):
        self.create_uptime_subscription(
            url="https://santry.io",
            interval_seconds=60,
            method="GET",
        )
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(UptimeSubscription)),
        ):
            self.create_uptime_subscription(
                url="https://santry.io",
                interval_seconds=60,
                method="GET",
            )

        self.create_uptime_subscription(
            url="https://santry.io",
            interval_seconds=60,
            method="POST",
        )
        self.create_uptime_subscription(
            url="https://santry.io",
            interval_seconds=60,
            headers={"hi": "santry", "auth": "sentaur"},
        )

        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(UptimeSubscription)),
        ):
            self.create_uptime_subscription(
                url="https://santry.io",
                interval_seconds=60,
                headers={"auth": "sentaur", "hi": "santry"},
            )

        self.create_uptime_subscription(
            url="https://santry.io",
            interval_seconds=60,
            headers={"hi": "santry", "auth": "sentaur"},
            body="hello",
        )
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(UptimeSubscription)),
        ):
            self.create_uptime_subscription(
                url="https://santry.io",
                interval_seconds=60,
                headers={"hi": "santry", "auth": "sentaur"},
                body="hello",
            )


class DisableMonitorTest(UptimeTestCase):

    def get_active_monitor_count(self):
        return ProjectUptimeSubscription.objects.filter(
            project__organization=self.organization,
            status=OrganizationStatus.ACTIVE,
        ).count()

    def test(self):
        assert self.get_active_monitor_count() == 0
        # No-op
        disable_uptime_monitors_for_org(self.organization)

        self.create_project_uptime_subscription()
        assert self.get_active_monitor_count() == 1

        disable_uptime_monitors_for_org(self.organization)
        assert self.get_active_monitor_count() == 0

        for _ in range(5):
            self.create_project_uptime_subscription()
        assert self.get_active_monitor_count() == 5

        disable_uptime_monitors_for_org(self.organization)
        assert self.get_active_monitor_count() == 0
