from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.eventprocessing import save_new_event


class ProjectPlatformInferTest(TestCase):
    @override_options({"sentry:infer_project_platform": 1.0})
    def test_platform_inferred_on_event(self):
        project = self.create_project()

        save_new_event({"message": "test", "platform": "javascript"}, project)

        project.refresh_from_db()
        assert project.platform == "javascript"

    @override_options({"sentry:infer_project_platform": 1.0})
    def test_platform_does_not_override_existing_platform(self):
        project = self.create_project(platform="python")

        save_new_event({"message": "test", "platform": "javascript"}, project)

        project.refresh_from_db()
        assert project.platform == "python"
