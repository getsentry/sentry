from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.uptime.detectors.detector import detect_base_url_for_project
from sentry.uptime.detectors.ranking import _get_cluster, get_project_bucket_key


class DetectBaseUrlForProjectTest(TestCase):
    def assert_project_key(self, project: Project, exists: bool) -> None:
        key = get_project_bucket_key(project)
        cluster = _get_cluster()
        assert exists == cluster.hexists(key, str(project.id))

    @with_feature("organizations:uptime-automatic-hostname-detection")
    def test(self):
        detect_base_url_for_project(self.project, "https://sentry.io")
        self.assert_project_key(self.project, True)

    def test_no_feature(self):
        detect_base_url_for_project(self.project, "https://sentry.io")
        self.assert_project_key(self.project, False)

    @with_feature("organizations:uptime-automatic-hostname-detection")
    def test_disabled_for_project(self):
        self.project.update_option("sentry:uptime_autodetection", False)
        detect_base_url_for_project(self.project, "https://sentry.io")
        self.assert_project_key(self.project, False)
