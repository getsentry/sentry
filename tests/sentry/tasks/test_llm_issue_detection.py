from unittest.mock import patch

from sentry.tasks.llm_issue_detection import run_llm_issue_detection
from sentry.testutils.cases import TestCase


class LLMIssueDetectionTest(TestCase):
    @patch("sentry.tasks.llm_issue_detection.process_project")
    def test_run_detection_processes_enabled_projects(self, mock_process):
        """Test run_detection processes enabled projects."""
        project = self.create_project()

        with self.options(
            {
                "issue-detection.llm-detection.enabled": True,
                "issue-detection.llm-detection.projects-allowlist": [project.id],
            }
        ):
            run_llm_issue_detection()

        assert mock_process.called
        call_args = mock_process.call_args[0]
        assert call_args[0].id == project.id
