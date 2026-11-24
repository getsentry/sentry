from sentry.seer.autofix.open_prs import get_open_prs
from sentry.testutils.cases import TestCase


class GetOpenPrsSettingTest(TestCase):
    def test_stored_value_overrides_the_dropdown(self) -> None:
        self.project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")
        self.project.update_option("sentry:autofix_automation_tuning", "medium")
        self.project.update_option("sentry:seer_open_prs", False)
        assert get_open_prs(self.project.get_option) is False

        self.project.update_option("sentry:seer_automated_run_stopping_point", "code_changes")
        self.project.update_option("sentry:seer_open_prs", True)
        assert get_open_prs(self.project.get_option) is True
