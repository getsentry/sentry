from typing import int
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event


class ProjectPlatformInferTest(TestCase):
    def test_platform_inferred_on_event(self) -> None:
        project = self.create_project()

        save_new_event({"message": "test", "platform": "javascript"}, project)

        project.refresh_from_db()
        assert project.platform == "javascript"

    def test_platform_does_not_override_existing_platform(self) -> None:
        project = self.create_project(platform="python")

        save_new_event({"message": "test", "platform": "javascript"}, project)

        project.refresh_from_db()
        assert project.platform == "python"
