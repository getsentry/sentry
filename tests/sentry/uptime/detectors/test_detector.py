from sentry.models.organization import Organization
from sentry.testutils.cases import UptimeTestCase
from sentry.testutils.helpers import with_feature
from sentry.uptime.detectors.detector import detect_base_url_for_project
from sentry.uptime.detectors.ranking import _get_cluster, get_organization_bucket_key


class DetectBaseUrlForProjectTest(UptimeTestCase):
    def assert_organization_key(self, organization: Organization, exists: bool) -> None:
        key = get_organization_bucket_key(organization)
        cluster = _get_cluster()
        assert exists == cluster.sismember(key, str(organization.id))

    @with_feature("organizations:uptime-automatic-hostname-detection")
    def test(self):
        detect_base_url_for_project(self.project, "https://sentry.io")
        self.assert_organization_key(self.organization, True)

    def test_no_feature(self):
        detect_base_url_for_project(self.project, "https://sentry.io")
        self.assert_organization_key(self.organization, False)

    @with_feature("organizations:uptime-automatic-hostname-detection")
    def test_disabled_for_project(self):
        self.project.update_option("sentry:uptime_autodetection", False)
        detect_base_url_for_project(self.project, "https://sentry.io")
        self.assert_organization_key(self.organization, False)

    @with_feature("organizations:uptime-automatic-hostname-detection")
    def test_disabled_for_organization(self):
        self.organization.update_option("sentry:uptime_autodetection", False)
        detect_base_url_for_project(self.project, "https://sentry.io")
        self.assert_organization_key(self.organization, False)
