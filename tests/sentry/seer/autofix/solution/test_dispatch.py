from unittest.mock import patch

from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix.solution.dispatch import trigger_autofix_solution_feature
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestTriggerAutofixSolutionFeature(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def test_dispatches_continuation_and_inherits_pipeline_extras(self) -> None:
        previous_run = self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=123,
            type="feature_run",
        )
        self.create_seer_agent_run(
            previous_run,
            source="autofix",
            group=self.group,
            project=self.project,
            extras={
                "referrer": "unknown",
                "stopping_point": "code_changes",
                "status": "completed",
                "result": {"headline": "Prior RCA"},
            },
        )
        feature_run = self.create_seer_run(organization=self.organization, type="feature_run")
        expected_context = {"org_slug": self.organization.slug, "all_org_projects": []}

        with (
            patch("sentry.seer.autofix.solution.dispatch.SeerAgentClient") as mock_client_cls,
            patch(
                "sentry.seer.autofix.solution.dispatch.collect_user_org_context",
                return_value=expected_context,
            ),
        ):
            mock_client_cls.return_value.start_feature_run.return_value = feature_run

            result = trigger_autofix_solution_feature(
                self.group,
                run_id=123,
                referrer=AutofixReferrer.ON_COMPLETION_HOOK,
                user_context="Prefer the smallest safe change",
                insert_index=4,
            )

        assert result is feature_run
        run_kwargs = mock_client_cls.return_value.start_feature_run.call_args.kwargs
        assert run_kwargs["feature_id"] == "autofix"
        assert run_kwargs["title"].startswith("Autofix Solution")
        assert run_kwargs["payload"] == {
            "group_id": self.group.id,
            "short_id": self.group.qualified_short_id or str(self.group.id),
            "title": self.group.title,
            "culprit": "unknown",
            "on_completion_hook": {
                "module_path": AutofixOnCompletionHook.get_module_path(),
                "call_on_failure": True,
            },
            "step": "solution",
            "args": {
                "run_id": 123,
                "insert_index": 4,
                "intelligence_level": "medium",
                "reasoning_effort": None,
                "user_context": "Prefer the smallest safe change",
            },
        }
        assert run_kwargs["extras"] == {
            "referrer": AutofixReferrer.ON_COMPLETION_HOOK.value,
            "previous_run_id": 123,
            "stopping_point": "code_changes",
        }
        assert run_kwargs["user_org_context"] == expected_context
