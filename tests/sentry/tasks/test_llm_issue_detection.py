from unittest.mock import patch

from sentry.tasks.llm_issue_detection import run_llm_issue_detection
from sentry.testutils.cases import TestCase


class LLMIssueDetectionTest(TestCase):
    @patch("sentry.tasks.llm_issue_detection.detect_llm_issues_for_project.delay")
    def test_run_detection_dispatches_sub_tasks(self, mock_delay):
        """Test run_detection spawns sub-tasks for each project."""
        project = self.create_project()

        with self.options(
            {
                "issue-detection.llm-detection.enabled": True,
                "issue-detection.llm-detection.projects-allowlist": [project.id],
            }
        ):
            run_llm_issue_detection()

        assert mock_delay.called
        assert mock_delay.call_args[0][0] == project.id
