from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event


class ProjectPlatformInferTest(TestCase):
    def test_platform_inferred_on_event(self):
        project = self.create_project()

        save_new_event({"message": "test", "platform": "javascript"}, project)

        project.refresh_from_db()
        assert project.platform == "javascript"
        assert project.get_option("sentry:project_platform_inferred") == "javascript"

    def test_platform_inferred_other_when_mismatch(self):
        project = self.create_project()

        save_new_event({"message": "test", "platform": "javascript"}, project)
        save_new_event({"message": "test", "platform": "python"}, project)

        project.refresh_from_db()
        assert project.platform == "other"
        assert project.get_option("sentry:project_platform_inferred") == "other"

    def test_platform_does_not_override_existing_platform(self):
        project = self.create_project(platform="python")

        save_new_event({"message": "test", "platform": "javascript"}, project)

        project.refresh_from_db()
        assert project.platform == "python"
        assert project.get_option("sentry:project_platform_inferred") is None

    def test_platform_stops_inferring_when_manually_set(self):
        project = self.create_project()

        save_new_event({"message": "test", "platform": "javascript"}, project)
        project.refresh_from_db()

        assert project.platform == "javascript"
        assert project.get_option("sentry:project_platform_inferred") == "javascript"

        project.update(platform="python")
        project.refresh_from_db()

        assert project.platform == "python"
        assert project.get_option("sentry:project_platform_inferred") == "javascript"

        save_new_event({"message": "test", "platform": "native"}, project)

        project.refresh_from_db()
        assert project.platform == "python"
        assert project.get_option("sentry:project_platform_inferred") is None
