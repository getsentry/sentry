from typing import int
from sentry.models.organization import Organization
from sentry.testutils.cases import UptimeTestCase
from sentry.testutils.helpers.options import override_options
from sentry.uptime.autodetect.detector import autodetect_base_url_for_project
from sentry.uptime.autodetect.ranking import get_organization_bucket_key
from sentry.uptime.utils import get_cluster


class DetectBaseUrlForProjectTest(UptimeTestCase):
    def assert_organization_key(self, organization: Organization, exists: bool) -> None:
        key = get_organization_bucket_key(organization)
        cluster = get_cluster()
        assert exists == cluster.sismember(key, str(organization.id))

    def test(self) -> None:
        autodetect_base_url_for_project(self.project, "https://sentry.io")
        self.assert_organization_key(self.organization, True)

    @override_options({"uptime.automatic-hostname-detection": False})
    def test_no_option(self) -> None:
        autodetect_base_url_for_project(self.project, "https://sentry.io")
        self.assert_organization_key(self.organization, False)

    def test_disabled_for_project(self) -> None:
        self.project.update_option("sentry:uptime_autodetection", False)
        autodetect_base_url_for_project(self.project, "https://sentry.io")
        self.assert_organization_key(self.organization, False)

    def test_disabled_for_organization(self) -> None:
        self.organization.update_option("sentry:uptime_autodetection", False)
        autodetect_base_url_for_project(self.project, "https://sentry.io")
        self.assert_organization_key(self.organization, False)
