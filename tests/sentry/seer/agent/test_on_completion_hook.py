from unittest.mock import patch

import pytest

from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.agent.on_completion_hook import (
    AgentOnCompletionHook,
    OnCompletionHookDefinition,
    call_on_completion_hook,
    extract_hook_definition,
)
from sentry.seer.models.run import SeerRunPullRequest
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

HOOK_PATH = "tests.sentry.seer.agent.test_on_completion_hook.SampleCompletionHook"


def _state_with_pr(run_id: int, repo_name: str, pr_number: int) -> SeerRunState:
    return SeerRunState(
        run_id=run_id,
        blocks=[],
        status="completed",
        updated_at="2026-02-10T00:00:00Z",
        repo_pr_states={
            repo_name: RepoPRState(
                repo_name=repo_name, pr_number=pr_number, pr_creation_status="completed"
            )
        },
    )


# Test hook class (defined at module level as required)
class SampleCompletionHook(AgentOnCompletionHook):
    @classmethod
    def execute(cls, organization: Organization, run_id: int) -> None:
        # Side effect: write to organization options so we can verify execution
        organization.update_option("test_hook_run_id", run_id)


class OnCompletionHookTest(TestCase):
    def test_extract_hook_definition(self) -> None:
        """Test extracting hook definition from a hook class."""
        hook_def = extract_hook_definition(SampleCompletionHook)

        assert isinstance(hook_def, OnCompletionHookDefinition)
        assert hook_def.module_path.endswith("test_on_completion_hook.SampleCompletionHook")

    def test_extract_hook_definition_nested_class_raises(self) -> None:
        """Test that nested classes are rejected."""

        class OuterClass:
            class NestedHook(AgentOnCompletionHook):
                @classmethod
                def execute(cls, organization: Organization, run_id: int) -> None:
                    pass

        with pytest.raises(ValueError) as cm:
            extract_hook_definition(OuterClass.NestedHook)
        assert "module-level class" in str(cm.value)

    @patch("sentry.seer.agent.on_completion_hook.fetch_run_status")
    def test_call_on_completion_hook_success(self, mock_fetch) -> None:
        """Test calling a completion hook successfully."""
        mock_fetch.return_value = SeerRunState(
            run_id=12345, blocks=[], status="completed", updated_at="2026-02-10T00:00:00Z"
        )

        call_on_completion_hook(
            module_path=HOOK_PATH,
            organization_id=self.organization.id,
            run_id=12345,
            allowed_prefixes=("sentry.", "tests.sentry."),
        )

        # Verify side effect: hook wrote run_id to organization options
        assert self.organization.get_option("test_hook_run_id") == 12345

    @patch("sentry.seer.agent.on_completion_hook.fetch_run_status")
    def test_links_pull_requests_for_any_hook(self, mock_fetch) -> None:
        """The dispatcher links a run's PRs regardless of which hook class runs."""
        repo = self.create_repo(
            self.project, name="getsentry/sentry", provider="integrations:github"
        )
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=777)
        mock_fetch.return_value = _state_with_pr(777, "getsentry/sentry", 5)

        call_on_completion_hook(
            module_path=HOOK_PATH,
            organization_id=self.organization.id,
            run_id=777,
            allowed_prefixes=("tests.sentry.",),
        )

        pr = PullRequest.objects.get(repository_id=repo.id, key="5")
        link = SeerRunPullRequest.objects.get(pull_request=pr)
        assert link.seer_run_state_id == 777
        assert link.seer_run_id == run.id
        # Hook still ran.
        assert self.organization.get_option("test_hook_run_id") == 777

    @patch("sentry.seer.agent.on_completion_hook.fetch_run_status")
    def test_killswitch_skips_linking_but_runs_hook(self, mock_fetch) -> None:
        self.create_repo(self.project, name="getsentry/sentry", provider="integrations:github")

        with override_options({"seer.run-pr-link.killswitch.enabled": True}):
            call_on_completion_hook(
                module_path=HOOK_PATH,
                organization_id=self.organization.id,
                run_id=777,
                allowed_prefixes=("tests.sentry.",),
            )

        assert not SeerRunPullRequest.objects.exists()
        mock_fetch.assert_not_called()
        assert self.organization.get_option("test_hook_run_id") == 777

    @patch("sentry.seer.agent.on_completion_hook.fetch_run_status", side_effect=RuntimeError("boom"))
    def test_linking_failure_does_not_block_hook(self, mock_fetch) -> None:
        call_on_completion_hook(
            module_path=HOOK_PATH,
            organization_id=self.organization.id,
            run_id=777,
            allowed_prefixes=("tests.sentry.",),
        )

        assert not SeerRunPullRequest.objects.exists()
        assert self.organization.get_option("test_hook_run_id") == 777

    def test_call_on_completion_hook_security_restriction(self) -> None:
        """Test that module path must start with allowed prefix."""
        with pytest.raises(ValueError) as cm:
            call_on_completion_hook(
                module_path="malicious.module.Hook",
                organization_id=self.organization.id,
                run_id=123,
                allowed_prefixes=("sentry.",),
            )
        assert "must start with one of" in str(cm.value)

    def test_call_on_completion_hook_invalid_module(self) -> None:
        """Test calling a non-existent hook module."""
        with pytest.raises(ValueError) as cm:
            call_on_completion_hook(
                module_path="sentry.nonexistent.module.Hook",
                organization_id=self.organization.id,
                run_id=123,
            )
        assert "Could not import" in str(cm.value)

    def test_call_on_completion_hook_not_a_hook_class(self) -> None:
        """Test calling something that isn't an AgentOnCompletionHook."""
        # BaseModel is importable but not an AgentOnCompletionHook
        with pytest.raises(ValueError) as cm:
            call_on_completion_hook(
                module_path="pydantic.BaseModel",
                organization_id=self.organization.id,
                run_id=123,
                allowed_prefixes=("pydantic.",),
            )
        assert "must be a class that inherits from AgentOnCompletionHook" in str(cm.value)
