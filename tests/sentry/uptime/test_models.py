from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.models import (
    get_active_auto_monitor_count_for_org,
    get_top_hosting_provider_names,
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


class GetTopHostingProviderNamesTest(UptimeTestCase):
    def test(self):
        self.create_uptime_subscription(host_provider_name="prov1")
        self.create_uptime_subscription(host_provider_name="prov1")
        self.create_uptime_subscription(host_provider_name="prov2")
        self.create_uptime_subscription(host_provider_name="prov2")
        self.create_uptime_subscription(host_provider_name="prov3")
        assert get_top_hosting_provider_names(2) == {"prov1", "prov2"}
        self.create_uptime_subscription(host_provider_name="prov3")
        self.create_uptime_subscription(host_provider_name="prov3")
        self.create_uptime_subscription(host_provider_name="prov4")
        # Cached, so should remain the same
        assert get_top_hosting_provider_names(2) == {"prov1", "prov2"}
        # Using a different arg should bust the cache
        assert get_top_hosting_provider_names(1) == {"prov3"}
        assert get_top_hosting_provider_names(3) == {"prov1", "prov2", "prov3"}
