from sentry.seer.autofix.open_prs import get_open_prs_setting
from sentry.testutils.cases import TestCase


class GetOpenPrsSettingTest(TestCase):
    def test_unset_follows_the_automation_steps_dropdown(self) -> None:
        cases = [
            ("open_pr", "medium", True),
            ("open_pr", "off", False),
            ("code_changes", "medium", False),
            ("root_cause", "medium", False),
        ]
        for stopping_point, tuning, expected in cases:
            with self.subTest(stopping_point=stopping_point, tuning=tuning):
                self.project.update_option(
                    "sentry:seer_automated_run_stopping_point", stopping_point
                )
                self.project.update_option("sentry:autofix_automation_tuning", tuning)

                assert get_open_prs_setting(self.project) is expected

    def test_stored_value_overrides_the_dropdown(self) -> None:
        self.project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")
        self.project.update_option("sentry:autofix_automation_tuning", "medium")
        self.project.update_option("sentry:seer_open_prs", False)
        assert get_open_prs_setting(self.project) is False

        self.project.update_option("sentry:seer_automated_run_stopping_point", "code_changes")
        self.project.update_option("sentry:seer_open_prs", True)
        assert get_open_prs_setting(self.project) is True
