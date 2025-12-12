from sentry.seer.autofix.autofix_agent import AutofixStep, build_step_prompt
from sentry.testutils.cases import TestCase


class TestBuildStepPrompt(TestCase):
    def setUp(self):
        super().setUp()
        self.group = self.create_group(
            project=self.project,
            message="Test error message",
        )
        self.group.culprit = "app.views.handler"
        self.group.save()

    def test_root_cause_prompt_contains_issue_details(self):
        prompt = build_step_prompt(AutofixStep.ROOT_CAUSE, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "ROOT CAUSE" in prompt
        assert "root_cause artifact" in prompt

    def test_solution_prompt_contains_issue_details(self):
        prompt = build_step_prompt(AutofixStep.SOLUTION, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "solution" in prompt.lower()
        assert "Do NOT implement" in prompt

    def test_code_changes_prompt_contains_issue_details(self):
        prompt = build_step_prompt(AutofixStep.CODE_CHANGES, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "Implement the fix" in prompt

    def test_impact_assessment_prompt_contains_issue_details(self):
        prompt = build_step_prompt(AutofixStep.IMPACT_ASSESSMENT, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "impact" in prompt.lower()
        assert "impact_assessment artifact" in prompt

    def test_triage_prompt_contains_issue_details(self):
        prompt = build_step_prompt(AutofixStep.TRIAGE, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "triage" in prompt.lower()
        assert "suspect_commit" in prompt

    def test_prompt_with_missing_culprit_uses_default(self):
        self.group.culprit = None
        self.group.save()

        prompt = build_step_prompt(AutofixStep.ROOT_CAUSE, self.group)

        assert "unknown" in prompt

    def test_all_prompts_are_dedented(self):
        for step in AutofixStep:
            prompt = build_step_prompt(step, self.group)
            # Dedented prompts should not start with whitespace
            assert not prompt.startswith(" "), f"{step} prompt starts with whitespace"
            assert not prompt.startswith("\t"), f"{step} prompt starts with tab"
