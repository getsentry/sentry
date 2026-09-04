from typing import TypedDict
from unittest.mock import MagicMock, patch

from sentry.models.activity import Activity
from sentry.seer.agent.client_models import (
    AgentFilePatch,
    Artifact,
    FilePatch,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
)
from sentry.seer.autofix.autofix_agent import AutofixStep
from sentry.seer.autofix.commit_author import SeerCommitAuthor
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.on_completion_hook import (
    PIPELINE_ORDER,
    STOPPING_POINT_TO_STEP,
    AutofixOnCompletionHook,
    _group_and_referrer_from_run,
    _stopping_point_from_run,
)
from sentry.seer.autofix.pr_iteration.constants import REVIEW_REQUEST_FLAG
from sentry.seer.autofix.pr_iteration.feedback import Feedback, serialize_feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.base import ConsumeTriggerSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubIssueComment,
    GithubPrCommentFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
    GithubPullRequestReviewComment,
)
from sentry.seer.autofix.pr_iteration.pause import (
    PauseReason,
    get_pause_reason,
    is_pr_iteration_paused,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models import AutofixHandoffPoint, SeerAutomationHandoffConfiguration
from sentry.seer.models.run import SeerRunMilestone, SeerRunMilestoneType
from sentry.sentry_apps.utils.webhooks import SeerActionType
from sentry.tasks.seer.pr_iteration import (
    ResolveReviewThreadsResult,
    UnsupportedProviderError,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.types.activity import ActivityType
from sentry.utils import json


def run_state(
    run_id=123,
    blocks: list[MemoryBlock] | None = None,
    metadata=None,
    status="completed",
    failure_reason=None,
):
    return SeerRunState(
        run_id=run_id,
        blocks=blocks if blocks is not None else [],
        status=status,
        failure_reason=failure_reason,
        updated_at="2026-02-10T00:00:00Z",
        metadata=metadata,
    )


def root_cause_memory_block(referrer: str | None = None) -> MemoryBlock:
    metadata: dict[str, str] = {"step": "root_cause"}
    if referrer is not None:
        metadata["referrer"] = referrer
    return MemoryBlock(
        id="block-root-cause",
        message=Message(
            role="assistant",
            content="message root cause",
            metadata=metadata,
        ),
        timestamp="2026-02-10T00:00:00Z",
        artifacts=[
            Artifact(
                key="root_cause",
                data={
                    "headline": "Auth module dereferences a null user",
                    "one_line_description": "Null pointer in auth module",
                    "five_whys": ["Why 1"],
                    "fixability": {
                        "assessment": "fixable",
                        "reason": "Can be fixed in code",
                    },
                },
                reason="explorer",
            )
        ],
    )


def solution_memory_block(referrer: str | None = None) -> MemoryBlock:
    metadata: dict[str, str] = {"step": "solution"}
    if referrer is not None:
        metadata["referrer"] = referrer
    return MemoryBlock(
        id="block-solution",
        message=Message(
            role="assistant",
            content="message solution",
            metadata=metadata,
        ),
        timestamp="2026-02-10T00:00:00Z",
        artifacts=[
            Artifact(
                key="solution",
                data={},  # TODO
                reason="explorer",
            )
        ],
    )


def code_changes_memory_block(referrer: str | None = None) -> MemoryBlock:
    metadata: dict[str, str] = {"step": "code_changes"}
    if referrer is not None:
        metadata["referrer"] = referrer
    return MemoryBlock(
        id="block-code-changes",
        message=Message(
            role="assistant",
            content="message code changes",
            metadata=metadata,
        ),
        timestamp="2026-02-10T00:00:00Z",
        merged_file_patches=[
            AgentFilePatch(
                repo_name="test-repo",
                patch=FilePatch(path="test.py", type="M", added=5, removed=2),
            )
        ],
    )


def pr_iteration_memory_block(
    referrer: str | None = None,
    iteration_index: int = 1,
    commit_sha: str | None = None,
) -> MemoryBlock:
    metadata: dict[str, str] = {
        "step": "pr_iteration",
        "iteration_index": str(iteration_index),
    }
    if referrer is not None:
        metadata["referrer"] = referrer
    return MemoryBlock(
        id="block-pr-iteration",
        message=Message(
            role="assistant",
            content="message pr iteration",
            metadata=metadata,
        ),
        timestamp="2026-02-10T00:00:00Z",
        merged_file_patches=[
            AgentFilePatch(
                repo_name="test-repo",
                diff="diff --git a/test.py b/test.py",
                patch=FilePatch(path="test.py", type="M", added=2, removed=1),
            )
        ],
        pr_commit_shas={"test-repo": commit_sha} if commit_sha is not None else None,
    )


class TestAutofixOnCompletionHookHelpers(TestCase):
    """Tests for helper methods in AutofixOnCompletionHook."""

    def test_get_current_step_root_cause(self) -> None:
        """Returns ROOT_CAUSE when root_cause artifact exists."""
        state = run_state(blocks=[root_cause_memory_block()])
        step, referrer = AutofixOnCompletionHook._get_current_step(state)
        assert step == AutofixStep.ROOT_CAUSE
        assert referrer is None

    def test_get_current_step_solution(self) -> None:
        """Returns SOLUTION when solution artifact exists."""
        state = run_state(blocks=[root_cause_memory_block(), solution_memory_block()])
        step, referrer = AutofixOnCompletionHook._get_current_step(state)
        assert step == AutofixStep.SOLUTION
        assert referrer is None

    def test_get_current_step_code_changes(self) -> None:
        """Returns CODE_CHANGES when code changes exist."""
        state = run_state(
            blocks=[
                root_cause_memory_block(),
                solution_memory_block(),
                code_changes_memory_block(),
            ]
        )
        step, referrer = AutofixOnCompletionHook._get_current_step(state)
        assert step == AutofixStep.CODE_CHANGES
        assert referrer is None

    def test_get_current_step_none(self) -> None:
        """Returns None when no artifacts or code changes exist."""
        state = run_state()
        step, referrer = AutofixOnCompletionHook._get_current_step(state)
        assert step is None
        assert referrer is None

    def test_get_current_step_extracts_referrer(self):
        """Returns the referrer from message metadata."""
        state = run_state(
            blocks=[root_cause_memory_block(referrer=AutofixReferrer.ON_COMPLETION_HOOK.value)]
        )
        step, referrer = AutofixOnCompletionHook._get_current_step(state)
        assert step == AutofixStep.ROOT_CAUSE
        assert referrer == AutofixReferrer.ON_COMPLETION_HOOK

    def test_get_current_step_extracts_referrer_from_latest_block(self):
        """Returns the referrer from the most recent block with step metadata."""
        state = run_state(
            blocks=[
                root_cause_memory_block(referrer=AutofixReferrer.GROUP_AUTOFIX_ENDPOINT.value),
                solution_memory_block(referrer=AutofixReferrer.ON_COMPLETION_HOOK.value),
            ]
        )
        step, referrer = AutofixOnCompletionHook._get_current_step(state)
        assert step == AutofixStep.SOLUTION
        assert referrer == AutofixReferrer.ON_COMPLETION_HOOK

    def test_get_current_step_invalid_referrer_returns_none(self):
        """Returns None referrer when referrer value is not a valid AutofixReferrer."""
        state = run_state(blocks=[root_cause_memory_block(referrer="not_a_valid_referrer")])
        step, referrer = AutofixOnCompletionHook._get_current_step(state)
        assert step == AutofixStep.ROOT_CAUSE
        assert referrer is None

    def test_get_next_step_root_cause_to_solution(self) -> None:
        """Returns SOLUTION after ROOT_CAUSE."""
        result = AutofixOnCompletionHook._get_next_step(AutofixStep.ROOT_CAUSE)
        assert result == AutofixStep.SOLUTION

    def test_get_next_step_solution_to_code_changes(self) -> None:
        """Returns CODE_CHANGES after SOLUTION."""
        result = AutofixOnCompletionHook._get_next_step(AutofixStep.SOLUTION)
        assert result == AutofixStep.CODE_CHANGES

    def test_get_next_step_code_changes_is_last(self) -> None:
        """Returns None after CODE_CHANGES (last step)."""
        result = AutofixOnCompletionHook._get_next_step(AutofixStep.CODE_CHANGES)
        assert result is None

    def test_get_next_step_pr_iteration_is_terminal(self) -> None:
        result = AutofixOnCompletionHook._get_next_step(AutofixStep.PR_ITERATION)
        assert result is None

    def test_determine_fixability_returns_none_for_non_root_cause(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)
        state = run_state(blocks=[pr_iteration_memory_block()])

        result = AutofixOnCompletionHook.determine_fixability(
            organization=organization,
            group=group,
            run_id=1,
            state=state,
            step=AutofixStep.PR_ITERATION,
            referrer=AutofixReferrer.GROUP_AUTOFIX_ENDPOINT,
            reached_stopping_point=False,
        )

        assert result is None


class TestStoppingPointFromRun(TestCase):
    """The stopping point falls back to the Sentry-side run mirror for runs Seer
    started without pipeline metadata (the autofix_rca feature)."""

    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def _create_run(
        self,
        seer_run_state_id: int,
        extras: dict | None = None,
        source: str = "autofix_rca",
    ):
        run = self.create_seer_run(
            organization=self.organization,
            type="feature_run",
            seer_run_state_id=seer_run_state_id,
        )
        self.create_seer_agent_run(run=run, source=source, group=self.group, extras=extras or {})
        return run

    def test_returns_none_when_no_run_exists(self) -> None:
        assert _stopping_point_from_run(self.organization, 999) is None

    def test_returns_none_when_run_has_no_stopping_point(self) -> None:
        self._create_run(123)
        assert _stopping_point_from_run(self.organization, 123) is None

    def test_returns_recorded_stopping_point(self) -> None:
        self._create_run(123, extras={"stopping_point": AutofixStoppingPoint.CODE_CHANGES.value})
        assert (
            _stopping_point_from_run(self.organization, 123)
            == AutofixStoppingPoint.CODE_CHANGES.value
        )

    def test_matches_runs_created_with_the_autofix_source(self) -> None:
        self._create_run(
            123,
            extras={"stopping_point": AutofixStoppingPoint.CODE_CHANGES.value},
            source="autofix",
        )
        assert (
            _stopping_point_from_run(self.organization, 123)
            == AutofixStoppingPoint.CODE_CHANGES.value
        )

    def test_is_scoped_to_the_organization(self) -> None:
        self._create_run(123, extras={"stopping_point": AutofixStoppingPoint.CODE_CHANGES.value})
        assert _stopping_point_from_run(self.create_organization(), 123) is None

    def test_stopping_point_ignores_other_feature_runs(self) -> None:
        self._create_run(
            123,
            extras={"stopping_point": AutofixStoppingPoint.CODE_CHANGES.value},
            source="night_shift",
        )
        assert _stopping_point_from_run(self.organization, 123) is None

    def test_group_and_referrer_returns_autofix_rca_context(self) -> None:
        self._create_run(123, extras={"referrer": AutofixReferrer.WEB.value})
        assert _group_and_referrer_from_run(self.organization, 123) == (
            self.group.id,
            AutofixReferrer.WEB,
        )

    def test_group_and_referrer_matches_the_autofix_source(self) -> None:
        self._create_run(123, extras={"referrer": AutofixReferrer.WEB.value}, source="autofix")
        assert _group_and_referrer_from_run(self.organization, 123) == (
            self.group.id,
            AutofixReferrer.WEB,
        )

    def test_group_and_referrer_ignores_other_feature_runs(self) -> None:
        self._create_run(
            123,
            extras={"referrer": AutofixReferrer.NIGHT_SHIFT.value},
            source="night_shift",
        )
        assert _group_and_referrer_from_run(self.organization, 123) == (None, None)

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_agent")
    def test_state_metadata_takes_precedence_over_the_run_mirror(self, mock_trigger) -> None:
        """A legacy run carries its own stopping point; the mirror must not override
        it. Here state says stop at root cause while the mirror says continue."""
        self._create_run(123, extras={"stopping_point": AutofixStoppingPoint.CODE_CHANGES.value})
        state = run_state(
            blocks=[root_cause_memory_block()],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.ROOT_CAUSE.value,
            },
        )

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)

        mock_trigger.assert_not_called()


class TestAutofixOnCompletionHookPipeline(TestCase):
    """Tests for pipeline continuation logic."""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_agent")
    def test_maybe_continue_pipeline_no_metadata(self, mock_trigger):
        """Does not continue when metadata is missing."""
        state = run_state(blocks=[root_cause_memory_block()])
        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)
        mock_trigger.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_agent")
    def test_maybe_continue_pipeline_no_stopping_point_in_metadata(self, mock_trigger):
        """Does not continue when stopping_point is missing from metadata."""
        state = run_state(blocks=[root_cause_memory_block()], metadata={"group_id": self.group.id})
        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)
        mock_trigger.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_agent")
    def test_maybe_continue_pipeline_at_stopping_point(self, mock_trigger):
        """Does not continue when current step matches stopping point."""
        state = run_state(
            blocks=[root_cause_memory_block()],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.ROOT_CAUSE.value,
            },
        )
        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)
        mock_trigger.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_agent")
    def test_maybe_continue_pipeline_continues_to_next_step(self, mock_trigger):
        """Continues to next step when not at stopping point."""
        # No handoff configured - should continue with normal pipeline.
        state = run_state(
            blocks=[root_cause_memory_block()],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
            },
        )
        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)
        mock_trigger.assert_called_once()
        call_kwargs = mock_trigger.call_args.kwargs
        assert call_kwargs["group"].id == self.group.id
        assert call_kwargs["step"] == AutofixStep.SOLUTION
        assert call_kwargs["run_id"] == 123

    @patch("sentry.seer.autofix.on_completion_hook.trigger_push_changes")
    def test_maybe_continue_pipeline_pushes_changes_for_open_pr(self, mock_push_changes):
        """Pushes changes when stopping_point is open_pr and code_changes completed."""
        state = run_state(
            blocks=[
                root_cause_memory_block(),
                solution_memory_block(),
                code_changes_memory_block(),
            ],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.OPEN_PR.value,
            },
        )
        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)
        mock_push_changes.assert_called_once_with(
            self.group,
            123,
            referrer=AutofixReferrer.ON_COMPLETION_HOOK,
            state=state,
            verify_content=False,
        )

    @patch(
        "sentry.seer.autofix.on_completion_hook.AutofixOnCompletionHook._consume_queued_feedback"
    )
    @patch("sentry.seer.autofix.on_completion_hook.trigger_push_changes")
    def test_pr_iteration_does_not_consume_feedback_when_pushed(
        self, mock_push_changes, mock_consume
    ):
        """When PR iteration pushes new changes, queued feedback is left for the next run."""
        state = run_state(
            blocks=[pr_iteration_memory_block()],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.OPEN_PR.value,
            },
        )
        state.repo_pr_states = {"test-repo": RepoPRState(repo_name="test-repo")}
        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)
        mock_push_changes.assert_called_once()
        mock_consume.assert_not_called()

    @patch(
        "sentry.seer.autofix.on_completion_hook.AutofixOnCompletionHook._consume_queued_feedback"
    )
    @patch("sentry.seer.autofix.on_completion_hook.trigger_push_changes")
    def test_pr_iteration_push_forwards_stored_commit_author(self, mock_push_changes, mock_consume):
        """An iteration's push is attributed to the author stored on its opening block."""
        block = pr_iteration_memory_block()
        state = run_state(blocks=[block], metadata={"group_id": self.group.id})
        state.repo_pr_states = {"test-repo": RepoPRState(repo_name="test-repo")}
        author = SeerCommitAuthor(name="Mona", email="1+octocat@users.noreply.github.com")

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)
        assert mock_push_changes.call_args.kwargs["author"] is None

        assert block.message.metadata is not None
        block.message.metadata["commit_author"] = json.dumps(author)

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)
        assert mock_push_changes.call_args.kwargs["author"] == author

    @patch(
        "sentry.seer.autofix.on_completion_hook.AutofixOnCompletionHook._consume_queued_feedback"
    )
    @patch("sentry.seer.autofix.on_completion_hook.trigger_push_changes")
    def test_pr_iteration_consumes_feedback_when_nothing_pushed(
        self, mock_push_changes, mock_consume
    ):
        """When PR iteration has no new changes to push, queued feedback is consumed now."""
        state = run_state(
            blocks=[pr_iteration_memory_block(commit_sha="synced-sha")],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.OPEN_PR.value,
            },
        )
        state.repo_pr_states = {
            "test-repo": RepoPRState(repo_name="test-repo", commit_sha="synced-sha")
        }
        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)
        mock_push_changes.assert_not_called()
        mock_consume.assert_called_once()
        assert mock_consume.call_args.args[1:] == (self.organization, 123)

    @patch("sentry.seer.autofix.on_completion_hook.trigger_push_changes")
    def test_push_changes_skips_when_all_unsynced_repos_errored(self, mock_push_changes):
        """Does not re-push when every un-synced repo is already in pr_creation_status='error'."""
        state = run_state(
            blocks=[
                root_cause_memory_block(),
                solution_memory_block(),
                code_changes_memory_block(),
            ],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.OPEN_PR.value,
            },
        )
        state.repo_pr_states = {
            "test-repo": RepoPRState(
                repo_name="test-repo",
                pr_creation_status="error",
                pr_creation_error="No write access to repository test-repo",
            )
        }
        pushed = AutofixOnCompletionHook._push_changes(self.group, 123, state)
        assert pushed is False
        mock_push_changes.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_push_changes")
    def test_push_changes_pushes_when_any_unsynced_repo_not_errored(self, mock_push_changes):
        """Still pushes when a repo with diffs has no PR state yet (e.g. newly added)."""
        state = run_state(
            blocks=[
                root_cause_memory_block(),
                solution_memory_block(),
                code_changes_memory_block(),
                MemoryBlock(
                    id="block-code-changes-2",
                    message=Message(
                        role="assistant",
                        content="more code changes",
                        metadata={"step": "code_changes"},
                    ),
                    timestamp="2026-02-10T00:00:00Z",
                    merged_file_patches=[
                        AgentFilePatch(
                            repo_name="other-repo",
                            patch=FilePatch(path="x.py", type="M", added=1, removed=0),
                        )
                    ],
                ),
            ],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.OPEN_PR.value,
            },
        )
        state.repo_pr_states = {
            "test-repo": RepoPRState(
                repo_name="test-repo",
                pr_creation_status="error",
                pr_creation_error="No write access to repository test-repo",
            )
        }
        pushed = AutofixOnCompletionHook._push_changes(self.group, 123, state)
        assert pushed is True
        mock_push_changes.assert_called_once()


HOOK_PATH = "sentry.seer.autofix.on_completion_hook"


class TestPrIterationCompletionHook(TestCase):
    """Push vs webhook behavior across the two hook passes of one iteration."""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    def _pr_state(self, commit_sha: str | None, **kwargs) -> dict[str, RepoPRState]:
        return {
            "test-repo": RepoPRState(
                repo_name="test-repo",
                provider="github",
                pr_id=77,
                pr_number=7,
                pr_url="https://example.com/pull/7",
                pr_creation_status="completed",
                commit_sha=commit_sha,
                **kwargs,
            )
        }

    def _unsynced(self) -> SeerRunState:
        """The agent has finished, but its changes are not on the PR yet."""
        state = run_state(
            blocks=[pr_iteration_memory_block(commit_sha="iteration-sha")],
            metadata={"group_id": self.group.id},
        )
        state.repo_pr_states = self._pr_state("stale-sha")
        return state

    def _synced(self) -> SeerRunState:
        """The push landed: this is the pass that hands back to the queue."""
        state = run_state(
            blocks=[pr_iteration_memory_block(commit_sha="synced-sha")],
            metadata={"group_id": self.group.id},
        )
        state.repo_pr_states = self._pr_state("synced-sha")
        return state

    def _push(self, state: SeerRunState) -> bool:
        return AutofixOnCompletionHook._push_iteration_changes(
            AutofixOnCompletionHook._iteration_log_context(self.organization, self.group, state),
            self.group,
            123,
            state,
        )

    def _webhook(self, state: SeerRunState) -> None:
        AutofixOnCompletionHook._send_step_webhook(self.organization, 123, state, self.group)

    @patch(f"{HOOK_PATH}.broadcast_webhooks_for_organization.delay")
    def test_a_pass_that_is_still_owed_a_push_does_not_emit_webhook(self, mock_broadcast):
        self._webhook(self._unsynced())

        mock_broadcast.assert_not_called()

    @patch(f"{HOOK_PATH}.broadcast_webhooks_for_organization.delay")
    def test_the_pass_where_the_changes_landed_emits_iteration_completed(self, mock_broadcast):
        self._webhook(self._synced())

        assert (
            mock_broadcast.call_args.kwargs["event_name"]
            == SeerActionType.ITERATION_COMPLETED.value
        )

    @patch(f"{HOOK_PATH}.broadcast_webhooks_for_organization.delay")
    def test_a_terminally_errored_repo_still_emits_the_webhook(self, mock_broadcast):
        """We stop waiting for a sync a failed PR creation will never deliver."""
        state = self._unsynced()
        state.repo_pr_states = self._pr_state("stale-sha")
        state.repo_pr_states["test-repo"].pr_creation_status = "error"

        self._webhook(state)

        mock_broadcast.assert_called_once()

    @patch(f"{HOOK_PATH}.broadcast_webhooks_for_organization.delay")
    def test_an_iteration_without_pr_states_does_not_take_down_the_hook(self, mock_broadcast):
        """Was an assert, which took the rest of the hook -- push included -- with it."""
        state = run_state(
            blocks=[pr_iteration_memory_block()], metadata={"group_id": self.group.id}
        )

        self._webhook(state)

        mock_broadcast.assert_not_called()

    @patch(f"{HOOK_PATH}.AutofixOnCompletionHook._consume_queued_feedback")
    @patch(f"{HOOK_PATH}.trigger_push_changes")
    def test_no_pr_states_does_not_open_a_new_pr(self, mock_push, mock_consume):
        """Webhook return is not enough: execute() still reaches the pipeline."""
        state = run_state(
            blocks=[pr_iteration_memory_block()], metadata={"group_id": self.group.id}
        )

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)

        mock_push.assert_not_called()
        mock_consume.assert_called_once()

    @patch(f"{HOOK_PATH}.trigger_push_changes")
    def test_a_pass_that_pushes(self, mock_push):
        state = self._unsynced()

        pushed = self._push(state)

        assert pushed is True
        mock_push.assert_called_once()

    @patch(f"{HOOK_PATH}.trigger_push_changes")
    def test_the_hand_back_pass_does_not_push_again(self, mock_push):
        """Already synced is the previous push landing, not the agent idling."""
        state = self._synced()

        pushed = self._push(state)

        assert pushed is False
        mock_push.assert_not_called()

    @patch(f"{HOOK_PATH}.trigger_push_changes")
    def test_an_iteration_that_changed_nothing_does_not_push(self, mock_push):
        state = run_state(
            blocks=[
                MemoryBlock(
                    id="block-pr-iteration",
                    message=Message(
                        role="assistant", content="nothing to do", metadata={"step": "pr_iteration"}
                    ),
                    timestamp="2026-02-10T00:00:00Z",
                )
            ],
            metadata={"group_id": self.group.id},
        )
        state.repo_pr_states = self._pr_state("synced-sha")

        pushed = self._push(state)

        assert pushed is False
        mock_push.assert_not_called()

    @patch(f"{HOOK_PATH}.trigger_push_changes")
    def test_a_repo_whose_pr_creation_errored_stops_the_push(self, mock_push):
        """Re-pushing into it would re-fire this hook in a loop."""
        state = self._unsynced()
        state.repo_pr_states["test-repo"].pr_creation_status = "error"

        pushed = self._push(state)

        assert pushed is False
        mock_push.assert_not_called()

    @patch(f"{HOOK_PATH}.trigger_push_changes", side_effect=ValueError("boom"))
    def test_a_failed_push_is_swallowed(self, mock_push):
        state = self._unsynced()

        pushed = self._push(state)

        assert pushed is False

    @patch(
        f"{HOOK_PATH}.AutofixOnCompletionHook._consume_queued_feedback",
    )
    @patch(f"{HOOK_PATH}.trigger_push_changes", side_effect=ValueError("boom"))
    def test_a_failed_push_still_hands_back_to_the_queue(self, mock_push, mock_consume):
        """Feedback already waiting should not be stranded by a push that broke."""
        AutofixOnCompletionHook._maybe_continue_pipeline(
            self.organization, 123, self._unsynced(), self.group
        )

        mock_consume.assert_called_once()
        assert mock_consume.call_args.args[1:] == (self.organization, 123)

    @patch(f"{HOOK_PATH}.AutofixOnCompletionHook._consume_queued_feedback")
    @patch(f"{HOOK_PATH}.trigger_push_changes")
    def test_an_errored_iteration_pauses_instead_of_pushing(self, mock_push, mock_consume):
        self.create_seer_run(
            organization=self.organization, seer_run_state_id=123, user_id=self.user.id
        )
        state = self._unsynced()
        state.status = "error"

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)

        mock_push.assert_not_called()
        mock_consume.assert_not_called()
        assert is_pr_iteration_paused(run_id=123, organization_id=self.organization.id) is True
        assert (
            get_pause_reason(run_id=123, organization_id=self.organization.id)
            == PauseReason.RUN_ERRORED
        )

    @patch(f"{HOOK_PATH}.AutofixOnCompletionHook._consume_queued_feedback")
    @patch(f"{HOOK_PATH}.trigger_push_changes")
    def test_an_errored_iteration_without_a_run_row_still_stops(self, mock_push, mock_consume):
        state = self._unsynced()
        state.status = "error"

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)

        mock_push.assert_not_called()
        mock_consume.assert_not_called()

    @patch(f"{HOOK_PATH}.consume_queued_autofix_feedback.apply_async")
    def test_the_hand_back_to_the_queue_schedules_the_drain(self, mock_apply):
        state = self._synced()

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)

        task_kwargs = mock_apply.call_args.kwargs["kwargs"]
        assert task_kwargs["run_id"] == 123
        assert task_kwargs["organization_id"] == self.organization.id
        assert task_kwargs["trigger_id"]
        assert task_kwargs["trigger_source"] == ConsumeTriggerSource.FEEDBACK


class TestPipelineConstants(TestCase):
    """Tests for pipeline constants."""

    def test_pipeline_order(self) -> None:
        """Pipeline order is root_cause -> solution -> code_changes."""
        assert PIPELINE_ORDER == [
            AutofixStep.ROOT_CAUSE,
            AutofixStep.SOLUTION,
            AutofixStep.CODE_CHANGES,
        ]

    def test_stopping_point_to_step_mapping(self) -> None:
        """Stopping points map to correct steps."""
        assert STOPPING_POINT_TO_STEP[AutofixStoppingPoint.ROOT_CAUSE] == AutofixStep.ROOT_CAUSE
        assert STOPPING_POINT_TO_STEP[AutofixStoppingPoint.SOLUTION] == AutofixStep.SOLUTION
        assert STOPPING_POINT_TO_STEP[AutofixStoppingPoint.CODE_CHANGES] == AutofixStep.CODE_CHANGES
        assert AutofixStoppingPoint.OPEN_PR not in STOPPING_POINT_TO_STEP


class TestAutofixOnCompletionHookWebhooks(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_send_step_webhook_artifact_types(self, mock_broadcast):
        """Tests webhook sending for all artifact-based step types."""
        state = MagicMock()
        run_id = 123
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=run_id)

        class TestCaseDict(TypedDict):
            block: MemoryBlock
            expected_event: SeerActionType
            expected_payload_key: str

        test_cases: list[TestCaseDict] = [
            {
                "block": root_cause_memory_block(),
                "expected_event": SeerActionType.ROOT_CAUSE_COMPLETED,
                "expected_payload_key": "root_cause",
            },
            {
                "block": solution_memory_block(),
                "expected_event": SeerActionType.SOLUTION_COMPLETED,
                "expected_payload_key": "solution",
            },
        ]

        for i, test_case in enumerate(test_cases):
            mock_broadcast.reset_mock()
            state = run_state(blocks=[test_case["block"]])
            AutofixOnCompletionHook._send_step_webhook(self.organization, run_id, state, self.group)

            mock_broadcast.assert_called_once()
            call_kwargs = mock_broadcast.call_args.kwargs
            if i == 0:  # First test - verify common fields
                assert call_kwargs["resource_name"] == "seer"
                assert call_kwargs["organization_id"] == self.organization.id
                assert call_kwargs["payload"]["run_id"] == run_id
                assert call_kwargs["payload"]["sentry_run_id"] == str(seer_run.uuid)
            assert call_kwargs["event_name"] == test_case["expected_event"].value
            assert (
                call_kwargs["payload"][test_case["expected_payload_key"]]
                == test_case["block"].artifacts[0].data
            )

    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_send_step_webhook_coding(self, mock_broadcast):
        """Sends coding_completed webhook when file patches exist."""
        state = run_state(
            blocks=[
                root_cause_memory_block(),
                solution_memory_block(),
                code_changes_memory_block(),
            ]
        )
        AutofixOnCompletionHook._send_step_webhook(self.organization, 123, state, self.group)

        mock_broadcast.assert_called_once()
        call_kwargs = mock_broadcast.call_args.kwargs
        assert call_kwargs["event_name"] == SeerActionType.CODING_COMPLETED.value
        assert call_kwargs["payload"]["code_changes"]["test-repo"][0]["path"] == "test.py"
        assert call_kwargs["payload"]["code_changes"]["test-repo"][0]["added"] == 5
        assert call_kwargs["payload"]["code_changes"]["test-repo"][0]["removed"] == 2

    @patch("sentry.seer.autofix.on_completion_hook.analytics.record")
    @patch("sentry.seer.autofix.on_completion_hook.process_autofix_updates.apply_async")
    @patch("sentry.seer.autofix.on_completion_hook.SeerAutofixOperator.has_access")
    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_send_step_webhook_pr_iteration(
        self, mock_broadcast, mock_has_access, mock_process_autofix_updates, mock_analytics
    ):
        mock_has_access.return_value = True

        def assert_activity_exists(**_kwargs: object) -> None:
            assert Activity.objects.filter(
                group=self.group,
                type=ActivityType.SEER_ITERATION_COMPLETED.value,
            ).exists()

        mock_process_autofix_updates.side_effect = assert_activity_exists
        state = run_state(
            blocks=[
                root_cause_memory_block(),
                solution_memory_block(),
                code_changes_memory_block(),
                pr_iteration_memory_block(
                    referrer=AutofixReferrer.GROUP_AUTOFIX_ENDPOINT.value,
                    commit_sha="synced-sha",
                ),
            ]
        )
        state.repo_pr_states = {
            "test-repo": RepoPRState(
                repo_name="test-repo",
                provider="github",
                pr_id=77,
                pr_number=7,
                pr_url="https://example.com/pull/7",
                pr_creation_status="completed",
                commit_sha="synced-sha",
            )
        }

        AutofixOnCompletionHook._send_step_webhook(self.organization, 123, state, self.group)

        mock_broadcast.assert_called_once()
        call_kwargs = mock_broadcast.call_args.kwargs
        assert call_kwargs["event_name"] == SeerActionType.ITERATION_COMPLETED.value
        assert call_kwargs["payload"]["code_changes"]["test-repo"][0]["path"] == "test.py"
        assert call_kwargs["payload"]["pull_requests"][0]["provider"] == "github"
        assert call_kwargs["payload"]["pull_requests"][0]["pull_request"]["pr_number"] == 7
        mock_process_autofix_updates.assert_called_once()
        task_kwargs = mock_process_autofix_updates.call_args.kwargs["kwargs"]
        assert task_kwargs["activity_already_recorded"] is True
        assert "activity_datetime" not in task_kwargs
        assert (
            mock_analytics.call_args.args[0].referrer
            == AutofixReferrer.GROUP_AUTOFIX_ENDPOINT.value
        )

    @patch("sentry.seer.autofix.on_completion_hook.analytics.record")
    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_send_step_webhook_pr_iteration_does_not_emit_pr_created(
        self, mock_broadcast, mock_analytics
    ):
        state = run_state(
            blocks=[
                code_changes_memory_block(),
                pr_iteration_memory_block(commit_sha="synced-sha"),
            ]
        )
        state.repo_pr_states = {
            "test-repo": RepoPRState(
                repo_name="test-repo",
                pr_id=77,
                pr_number=7,
                pr_url="https://example.com/pull/7",
                pr_creation_status="completed",
                commit_sha="synced-sha",
            )
        }

        AutofixOnCompletionHook._send_step_webhook(self.organization, 123, state, self.group)

        assert (
            mock_broadcast.call_args.kwargs["event_name"]
            == SeerActionType.ITERATION_COMPLETED.value
        )
        event_names = [call.args[0].type for call in mock_analytics.call_args_list]
        assert "ai.autofix.pr_created.completed" not in event_names

    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_send_step_webhook_pr_iteration_skips_until_synced(self, mock_broadcast):
        """Does not emit iteration_completed until the pushed PR is synced to the iteration."""
        state = run_state(
            blocks=[
                root_cause_memory_block(),
                solution_memory_block(),
                code_changes_memory_block(),
                pr_iteration_memory_block(
                    referrer=AutofixReferrer.GROUP_AUTOFIX_ENDPOINT.value,
                    commit_sha="iteration-sha",
                ),
            ]
        )
        state.repo_pr_states = {
            "test-repo": RepoPRState(
                repo_name="test-repo",
                pr_id=77,
                pr_number=7,
                pr_url="https://example.com/pull/7",
                pr_creation_status="completed",
                commit_sha="stale-sha",
            )
        }

        AutofixOnCompletionHook._send_step_webhook(self.organization, 123, state, self.group)

        mock_broadcast.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_send_step_webhook_no_artifacts_no_webhook(self, mock_broadcast):
        """Does not send webhook when no artifacts or file patches exist."""
        block = MemoryBlock(
            id="block_empty",
            message=Message(role="tool_use", content="test"),
            timestamp="2024-01-01T00:00:00Z",
            artifacts=[],
        )
        state = run_state(blocks=[block])
        AutofixOnCompletionHook._send_step_webhook(self.organization, 123, state, self.group)

        mock_broadcast.assert_not_called()

    def _pr_created_state(self):
        state = run_state(blocks=[code_changes_memory_block()])
        state.repo_pr_states = {
            "test-repo": RepoPRState(
                repo_name="test-repo",
                provider="github",
                pr_id=77,
                pr_number=7,
                pr_url="https://example.com/pull/7",
                pr_creation_status="completed",
            )
        }
        return state

    @patch("sentry.seer.autofix.on_completion_hook.emit_pr_ready_for_review")
    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_pr_is_ready_on_open(self, mock_broadcast, mock_emit):
        state = self._pr_created_state()
        AutofixOnCompletionHook._send_step_webhook(
            organization=self.organization, run_id=123, state=state, group=self.group
        )

        mock_emit.assert_called_once()
        kwargs = mock_emit.call_args.kwargs
        assert kwargs["group"] == self.group
        assert kwargs["state"] is state

    @patch("sentry.seer.autofix.on_completion_hook.emit_pr_ready_for_review")
    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_draft_pr_is_not_ready_on_open(self, mock_broadcast, mock_emit):
        state = self._pr_created_state()
        with self.feature(REVIEW_REQUEST_FLAG):
            AutofixOnCompletionHook._send_step_webhook(self.organization, 123, state, self.group)

        mock_emit.assert_not_called()
        assert mock_broadcast.call_args.kwargs["event_name"] == SeerActionType.PR_CREATED.value


class TestAutofixOnCompletionHookHandoff(TestCase):
    """Tests for coding agent handoff logic in AutofixOnCompletionHook."""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    def _make_handoff_config(
        self,
        handoff_point: AutofixHandoffPoint = AutofixHandoffPoint.ROOT_CAUSE,
        integration_id: int = 123,
    ) -> SeerAutomationHandoffConfiguration:
        """Helper to create a handoff configuration in ProjectOptions.

        Returns the expected SeerAutomationHandoffConfiguration."""
        self.project.update_option("sentry:seer_automation_handoff_point", handoff_point.value)
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", integration_id)
        self.project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)

        return SeerAutomationHandoffConfiguration(
            handoff_point=handoff_point,
            target="cursor_background_agent",
            integration_id=integration_id,
            auto_create_pr=True,
        )

    @patch("sentry.seer.autofix.on_completion_hook.get_automation_handoff")
    def test_get_handoff_config_returns_none_when_not_root_cause_step(
        self, mock_get_handoff
    ) -> None:
        """Returns None without reading preferences when current step is not ROOT_CAUSE."""
        result = AutofixOnCompletionHook._get_handoff_config_if_applicable(
            stopping_point=AutofixStoppingPoint.CODE_CHANGES,
            current_step=AutofixStep.SOLUTION,  # Not ROOT_CAUSE
            group=self.group,
        )

        assert result is None
        mock_get_handoff.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.get_automation_handoff")
    def test_get_handoff_config_returns_none_when_stopping_at_root_cause(
        self, mock_get_handoff
    ) -> None:
        """Returns None without reading preferences when stopping point is ROOT_CAUSE."""
        result = AutofixOnCompletionHook._get_handoff_config_if_applicable(
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
            current_step=AutofixStep.ROOT_CAUSE,
            group=self.group,
        )

        assert result is None
        mock_get_handoff.assert_not_called()

    def test_get_handoff_config_returns_none_when_no_handoff_configured(self) -> None:
        """Returns None when project has no automation handoff configured."""
        result = AutofixOnCompletionHook._get_handoff_config_if_applicable(
            stopping_point=AutofixStoppingPoint.CODE_CHANGES,
            current_step=AutofixStep.ROOT_CAUSE,
            group=self.group,
        )

        assert result is None

    def test_get_handoff_config_returns_config_when_applicable(self) -> None:
        """Returns handoff config when options are set and conditions are met."""
        expected_handoff_config = self._make_handoff_config()

        result = AutofixOnCompletionHook._get_handoff_config_if_applicable(
            stopping_point=AutofixStoppingPoint.CODE_CHANGES,
            current_step=AutofixStep.ROOT_CAUSE,
            group=self.group,
        )

        assert result == expected_handoff_config

    @patch("sentry.seer.autofix.on_completion_hook.trigger_coding_agent_handoff")
    def test_maybe_continue_pipeline_triggers_handoff_when_configured(self, mock_trigger_handoff):
        """Triggers handoff instead of continuing pipeline when handoff is configured."""
        self._make_handoff_config()
        mock_trigger_handoff.return_value = {"successes": [], "failures": []}

        state = run_state(
            blocks=[
                root_cause_memory_block(
                    referrer=AutofixReferrer.ISSUE_SUMMARY_POST_PROCESS_FIXABILITY.value
                )
            ],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
            },
        )

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, self.group)

        mock_trigger_handoff.assert_called_once()
        assert (
            mock_trigger_handoff.call_args.kwargs["referrer"]
            == AutofixReferrer.ISSUE_SUMMARY_POST_PROCESS_FIXABILITY
        )

    @patch("sentry.seer.autofix.on_completion_hook.trigger_coding_agent_handoff")
    def test_trigger_coding_agent_handoff_clears_preference_on_not_found(self, mock_trigger):
        """When IntegrationNotFound is raised, automation_handoff is cleared from preferences."""
        from sentry.seer.autofix.coding_agent import IntegrationNotFound

        mock_trigger.side_effect = IntegrationNotFound()
        handoff_config = self._make_handoff_config()

        AutofixOnCompletionHook._trigger_coding_agent_handoff(
            organization=self.organization,
            run_id=123,
            group=self.group,
            handoff_config=handoff_config,
        )

        assert self.project.get_option("sentry:seer_automation_handoff_point") is None
        assert self.project.get_option("sentry:seer_automation_handoff_target") is None
        assert self.project.get_option("sentry:seer_automation_handoff_integration_id") is None

    @patch("sentry.seer.autofix.on_completion_hook.trigger_coding_agent_handoff")
    def test_trigger_coding_agent_handoff_calls_function(self, mock_trigger):
        """Test _trigger_coding_agent_handoff calls the trigger function correctly."""
        mock_trigger.return_value = {
            "successes": [{"repo": "owner/repo"}],
            "failures": [],
        }
        handoff_config = self._make_handoff_config()

        AutofixOnCompletionHook._trigger_coding_agent_handoff(
            organization=self.organization,
            run_id=123,
            group=self.group,
            handoff_config=handoff_config,
            referrer=AutofixReferrer.NIGHT_SHIFT,
        )

        mock_trigger.assert_called_once()
        call_kwargs = mock_trigger.call_args.kwargs
        assert call_kwargs["run_id"] == 123
        assert call_kwargs["integration_id"] == 123
        assert call_kwargs["referrer"] == AutofixReferrer.NIGHT_SHIFT


class AutofixOnCompletionHookTest(TestCase):
    """Test the AutofixOnCompletionHook behavior."""

    @patch("sentry.seer.autofix.on_completion_hook._group_and_referrer_from_run")
    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_agent")
    def test_next_step_not_triggered_when_coding_disabled(
        self, mock_trigger_autofix, mock_fetch_run_status, mock_run_context
    ):
        """Test that next step is not triggered if next step is CODE_CHANGES and sentry:enable_seer_coding is disabled."""
        self.organization.update_option("sentry:enable_seer_coding", False)
        group = self.create_group(project=self.project)

        # Mock run state: SOLUTION step just completed
        state = run_state(
            blocks=[solution_memory_block()],
            metadata={
                "stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
                "group_id": group.id,
            },
        )
        mock_fetch_run_status.return_value = state

        # Execute the hook
        AutofixOnCompletionHook.execute(self.organization, 123)

        mock_run_context.assert_not_called()

        # Verify: trigger_autofix_agent was NOT called (next step blocked)
        mock_trigger_autofix.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_agent")
    def test_next_step_triggered_when_coding_enabled(
        self, mock_trigger_autofix, mock_fetch_run_status
    ):
        """Test that next step IS triggered when next step is CODE_CHANGES and sentry:enable_seer_coding is enabled."""
        self.organization.update_option("sentry:enable_seer_coding", True)
        group = self.create_group(project=self.project)

        seer_run = self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=123,
            last_triggered_at=before_now(days=1),
        )

        # Mock run state: SOLUTION step just completed
        state = run_state(
            blocks=[solution_memory_block()],
            metadata={
                "stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
                "group_id": group.id,
            },
        )
        mock_fetch_run_status.return_value = state

        # Execute the hook
        AutofixOnCompletionHook.execute(self.organization, 123)

        # Verify: trigger_autofix_agent WAS called with CODE_CHANGES step
        mock_trigger_autofix.assert_called_once()
        call_kwargs = mock_trigger_autofix.call_args.kwargs
        assert call_kwargs["step"] == AutofixStep.CODE_CHANGES
        assert call_kwargs["group"] == group
        assert call_kwargs["run_id"] == 123

        seer_run.refresh_from_db()
        group.refresh_from_db()
        assert seer_run.last_triggered_at == group.seer_explorer_autofix_last_triggered

    @patch(
        "sentry.seer.autofix.on_completion_hook.AutofixOnCompletionHook._maybe_continue_pipeline"
    )
    @patch("sentry.seer.autofix.on_completion_hook.AutofixOnCompletionHook._send_step_webhook")
    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    def test_error_status_skips_success_path(
        self, mock_fetch_run_status, mock_send_webhook, mock_continue_pipeline
    ):
        mock_fetch_run_status.return_value = run_state(
            status="error",
            failure_reason="timeout",
            metadata={"group_id": 1},
        )

        AutofixOnCompletionHook.execute(self.organization, 123)

        mock_send_webhook.assert_not_called()
        mock_continue_pipeline.assert_not_called()

    @patch(
        "sentry.seer.autofix.on_completion_hook.AutofixOnCompletionHook._maybe_continue_pipeline"
    )
    @patch("sentry.seer.autofix.on_completion_hook.AutofixOnCompletionHook._send_step_webhook")
    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    def test_unclassified_error_still_skips_success_path(
        self, mock_fetch_run_status, mock_send_webhook, mock_continue_pipeline
    ):
        mock_fetch_run_status.return_value = run_state(
            status="error",
            metadata={"group_id": 1},
        )

        AutofixOnCompletionHook.execute(self.organization, 123)

        mock_send_webhook.assert_not_called()
        mock_continue_pipeline.assert_not_called()


REACT_PATH = "sentry.seer.autofix.on_completion_hook"


class TestMaybeReactToCompletedIteration(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="123",
            name="owner/repo",
        )

    def _feedback_metadata(
        self, sources: list[GithubPrCommentFeedbackSource | GithubPrReviewCommentFeedbackSource]
    ) -> dict[str, str]:
        return {
            "step": AutofixStep.PR_ITERATION.value,
            "iteration_index": "0",
            "feedback": serialize_feedback([Feedback(source=s) for s in sources]),
        }

    def _synced_pr_iteration_block(
        self,
        sources: list[GithubPrCommentFeedbackSource | GithubPrReviewCommentFeedbackSource],
        repo_name: str = "owner/repo",
        commit_sha: str = "synced-sha",
    ) -> MemoryBlock:
        return MemoryBlock(
            id="block-pr-iteration",
            message=Message(
                role="assistant",
                content="message pr iteration",
                metadata=self._feedback_metadata(sources),
            ),
            timestamp="2026-02-10T00:00:00Z",
            merged_file_patches=[
                AgentFilePatch(
                    repo_name=repo_name,
                    diff="diff --git a/test.py b/test.py",
                    patch=FilePatch(path="test.py", type="M", added=2, removed=1),
                )
            ],
            pr_commit_shas={repo_name: commit_sha},
        )

    def _top_level_source(self, comment_id: int = 111) -> GithubPrCommentFeedbackSource:
        return GithubPrCommentFeedbackSource(
            comment=GithubIssueComment(id=comment_id, body="@sentry fix it"),
            repo_name="owner/repo",
        )

    def _review_source(
        self, comment_id: int = 222, unique_id: str | None = "PRRC_222"
    ) -> GithubPrReviewCommentFeedbackSource:
        return GithubPrReviewCommentFeedbackSource(
            comment=GithubPullRequestReviewComment(
                id=comment_id, body="inline feedback", unique_id=unique_id
            ),
        )

    def _state_with(
        self,
        sources: list[GithubPrCommentFeedbackSource | GithubPrReviewCommentFeedbackSource],
        *,
        status: str = "completed",
        commit_sha: str = "synced-sha",
        repo_pr_states: dict[str, RepoPRState] | None = None,
    ) -> SeerRunState:
        state = run_state(blocks=[self._synced_pr_iteration_block(sources, commit_sha=commit_sha)])
        state.status = status
        state.repo_pr_states = (
            repo_pr_states
            if repo_pr_states is not None
            else {
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_number=7, commit_sha=commit_sha
                )
            }
        )
        return state

    def _run(
        self,
        state: SeerRunState,
        *,
        feature: str = "organizations:autofix-pr-iteration-manual",
    ) -> None:
        with self.feature(feature):
            AutofixOnCompletionHook._maybe_react_to_completed_iteration(
                self.organization, 123, state
            )

    def _reaction_outcomes(self, mock_incr: MagicMock) -> list[str]:
        return [
            call.kwargs["tags"]["outcome"]
            for call in mock_incr.call_args_list
            if call.args[0] == "autofix.on_completion_hook.completion_reaction"
        ]

    @patch(f"{REACT_PATH}.is_github_rate_limit_sensitive", return_value=False)
    @patch(f"{REACT_PATH}._resolve_review_comment_threads")
    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_reacts_hooray_on_top_level_comment_only(
        self, mock_react, mock_make_scm, mock_resolve, mock_sensitive
    ):
        # A review comment is present alongside the top-level comment; only the
        # top-level one is acked with :tada: while the review comment's thread is
        # resolved (CW-1688).
        scm = MagicMock()
        mock_make_scm.return_value = scm
        mock_resolve.return_value = ResolveReviewThreadsResult(resolved=1)
        state = self._state_with([self._top_level_source(111), self._review_source(222)])

        self._run(state)

        assert mock_react.call_count == 1
        assert mock_react.call_args.args[0] is scm
        assert mock_react.call_args.kwargs["source_type"] == "github-pr-comment"
        assert mock_react.call_args.kwargs["comment_id"] == 111
        assert mock_react.call_args.kwargs["reaction"] == "hooray"
        assert mock_react.call_args.kwargs["pr_number"] == 7

        # The review comment's thread is resolved alongside the top-level :tada:.
        mock_resolve.assert_called_once()

    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    @patch(f"{REACT_PATH}._resolve_review_comment_threads")
    def test_noop_on_error_status(self, mock_resolve, mock_react, mock_make_scm):
        state = self._state_with([self._top_level_source(), self._review_source()], status="error")
        self._run(state)
        mock_react.assert_not_called()
        mock_resolve.assert_not_called()

    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_noop_when_step_not_pr_iteration(self, mock_react, mock_make_scm):
        state = run_state(blocks=[solution_memory_block()])
        self._run(state)
        mock_react.assert_not_called()

    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_noop_when_not_synced(self, mock_react, mock_make_scm):
        # PR commit sha differs from the pushed state, so changes aren't synced yet.
        state = self._state_with(
            [self._top_level_source()],
            commit_sha="new-sha",
            repo_pr_states={
                "owner/repo": RepoPRState(repo_name="owner/repo", pr_number=7, commit_sha="old-sha")
            },
        )
        self._run(state)
        mock_react.assert_not_called()

    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    @patch(f"{REACT_PATH}._resolve_review_comment_threads")
    def test_noop_when_manual_feature_disabled(self, mock_resolve, mock_react, mock_make_scm):
        state = self._state_with([self._top_level_source(), self._review_source()])
        # Automated CI iteration on, manual off: only comment-triggered iterations have
        # a comment to ack, so the automated flag must not enable the reaction or the
        # thread resolution.
        self._run(state, feature="organizations:autofix-pr-iteration")
        mock_react.assert_not_called()
        mock_resolve.assert_not_called()

    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_multi_repo_skips_source_without_repo_name(self, mock_react, mock_make_scm):
        scm = MagicMock()
        mock_make_scm.return_value = scm
        legacy_source = GithubPrCommentFeedbackSource(
            comment=GithubIssueComment(id=111, body="@sentry fix it"),
        )
        assert legacy_source.repo_name is None
        state = run_state(
            blocks=[self._synced_pr_iteration_block([legacy_source, self._top_level_source(333)])]
        )
        state.repo_pr_states = {
            "owner/repo": RepoPRState(repo_name="owner/repo", pr_number=7, commit_sha="synced-sha"),
            "owner/other": RepoPRState(
                repo_name="owner/other", pr_number=9, commit_sha="other-sha"
            ),
        }

        self._run(state)

        # Only the source that carries repo_name is reacted on; the legacy one is
        # skipped rather than reacted on the wrong repo.
        assert mock_react.call_count == 1
        assert mock_react.call_args.kwargs["comment_id"] == 333
        assert mock_react.call_args.kwargs["source_type"] == "github-pr-comment"

    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_skips_reaction_when_pr_number_missing(self, mock_react, mock_make_scm):
        # A repo can be synced without a pr_number (e.g. after a repo rename).
        # Reacting with an invalid ``0`` would just fail and capture noise, so
        # the source is skipped instead.
        scm = MagicMock()
        mock_make_scm.return_value = scm
        state = self._state_with(
            [self._top_level_source()],
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_number=None, commit_sha="synced-sha"
                )
            },
        )

        self._run(state)

        mock_react.assert_not_called()

    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    @patch(f"{REACT_PATH}._resolve_review_comment_threads")
    def test_skips_reaction_when_repo_name_ambiguous(self, mock_resolve, mock_react, mock_make_scm):
        # The same slug can exist under multiple providers in one org; rather than
        # guess and react on the wrong repo, the source is skipped.
        self.create_repo(
            project=self.project,
            provider="integrations:gitlab",
            external_id="456",
            name="owner/repo",
        )
        state = self._state_with([self._top_level_source(), self._review_source()])

        self._run(state)

        mock_make_scm.assert_not_called()
        mock_react.assert_not_called()
        mock_resolve.assert_not_called()

    @patch(f"{REACT_PATH}.is_github_rate_limit_sensitive", return_value=False)
    @patch(f"{REACT_PATH}._delete_own_comment_eyes_reaction")
    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_deletes_own_eyes_on_top_level_comment(
        self, mock_react, mock_make_scm, mock_delete_eyes, mock_sensitive
    ):
        scm = MagicMock()
        mock_make_scm.return_value = scm
        state = self._state_with([self._top_level_source(111)])

        self._run(state)

        assert mock_react.call_args.kwargs["reaction"] == "hooray"
        assert mock_delete_eyes.call_count == 1
        assert mock_delete_eyes.call_args.args[0] is scm
        assert mock_delete_eyes.call_args.kwargs["source_type"] == "github-pr-comment"
        assert mock_delete_eyes.call_args.kwargs["pr_number"] == 7
        assert mock_delete_eyes.call_args.kwargs["comment_id"] == 111

    @patch(f"{REACT_PATH}.is_github_rate_limit_sensitive", return_value=False)
    @patch(f"{REACT_PATH}._resolve_review_comment_threads")
    @patch(f"{REACT_PATH}._delete_own_comment_eyes_reaction")
    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_deletes_own_eyes_on_review_comment_without_hooray(
        self, mock_react, mock_make_scm, mock_delete_eyes, mock_resolve, mock_sensitive
    ):
        # An inline review comment gets its trigger-time :eyes: removed, but no
        # :tada: (its thread is resolved separately, CW-1688).
        scm = MagicMock()
        mock_make_scm.return_value = scm
        state = self._state_with([self._top_level_source(111), self._review_source(222)])

        self._run(state)

        # :tada: only on the top-level comment.
        assert mock_react.call_count == 1
        assert mock_react.call_args.kwargs["comment_id"] == 111

        # :eyes: removed from both comment types, each via its own namespace.
        delete_by_comment_id = {
            call.kwargs["comment_id"]: call.kwargs["source_type"]
            for call in mock_delete_eyes.call_args_list
        }
        assert delete_by_comment_id == {
            111: "github-pr-comment",
            222: "github-pr-review-comment",
        }

    @patch(f"{REACT_PATH}.is_github_rate_limit_sensitive", return_value=True)
    @patch(f"{REACT_PATH}._delete_own_comment_eyes_reaction")
    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_skips_eyes_delete_for_rate_limit_sensitive_org(
        self, mock_react, mock_make_scm, mock_delete_eyes, mock_sensitive
    ):
        scm = MagicMock()
        mock_make_scm.return_value = scm
        state = self._state_with([self._top_level_source(111)])

        self._run(state)

        # :tada: is still added, but the eyes-delete is skipped entirely.
        assert mock_react.call_args.kwargs["reaction"] == "hooray"
        mock_delete_eyes.assert_not_called()

    @patch(f"{REACT_PATH}.is_github_rate_limit_sensitive", return_value=False)
    @patch(f"{REACT_PATH}._resolve_review_comment_threads")
    @patch(f"{REACT_PATH}._delete_own_comment_eyes_reaction")
    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_batches_multiple_review_comments_per_pr(
        self, mock_react, mock_make_scm, mock_delete_eyes, mock_resolve, mock_sensitive
    ):
        scm = MagicMock()
        mock_make_scm.return_value = scm
        mock_resolve.return_value = ResolveReviewThreadsResult(resolved=2)
        state = self._state_with(
            [
                self._review_source(222, unique_id="PRRC_222"),
                self._review_source(333, unique_id="PRRC_333"),
            ]
        )

        self._run(state)

        # One call per PR carrying every unique_id, not one call per comment.
        mock_resolve.assert_called_once()
        assert mock_resolve.call_args.args[0] is scm
        assert mock_resolve.call_args.kwargs["pr_number"] == 7
        assert mock_resolve.call_args.kwargs["comment_unique_ids"] == ["PRRC_222", "PRRC_333"]

    @patch(f"{REACT_PATH}.is_github_rate_limit_sensitive", return_value=False)
    @patch(f"{REACT_PATH}._resolve_review_comment_threads")
    @patch(f"{REACT_PATH}._delete_own_comment_eyes_reaction")
    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_skips_review_resolve_when_repo_ambiguous_multi_repo(
        self, mock_react, mock_make_scm, mock_delete_eyes, mock_resolve, mock_sensitive
    ):
        # Review-comment sources don't carry ``repo_name``; with more than one repo
        # in the run their repo can't be inferred, so resolution is skipped.
        scm = MagicMock()
        mock_make_scm.return_value = scm
        state = run_state(
            blocks=[
                self._synced_pr_iteration_block([self._review_source(222, unique_id="PRRC_222")])
            ]
        )
        state.repo_pr_states = {
            "owner/repo": RepoPRState(repo_name="owner/repo", pr_number=7, commit_sha="synced-sha"),
            "owner/other": RepoPRState(
                repo_name="owner/other", pr_number=9, commit_sha="other-sha"
            ),
        }

        self._run(state)

        mock_resolve.assert_not_called()

    @patch(f"{REACT_PATH}.is_github_rate_limit_sensitive", return_value=False)
    @patch(f"{REACT_PATH}._resolve_review_comment_threads")
    @patch(f"{REACT_PATH}._delete_own_comment_eyes_reaction")
    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_skips_resolve_for_legacy_source_without_unique_id(
        self, mock_react, mock_make_scm, mock_delete_eyes, mock_resolve, mock_sensitive
    ):
        # A source serialized before unique_id was stored still gets :eyes: removed
        # but is not resolvable.
        scm = MagicMock()
        mock_make_scm.return_value = scm
        state = self._state_with([self._review_source(222, unique_id=None)])

        self._run(state)

        mock_resolve.assert_not_called()
        # :eyes: removal still happens for the inline comment.
        assert mock_delete_eyes.call_count == 1
        assert mock_delete_eyes.call_args.kwargs["comment_id"] == 222

    @patch(f"{REACT_PATH}.metrics.incr")
    @patch(f"{REACT_PATH}.is_github_rate_limit_sensitive", return_value=False)
    @patch(f"{REACT_PATH}._resolve_review_comment_threads")
    @patch(f"{REACT_PATH}._delete_own_comment_eyes_reaction")
    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_records_resolve_unsupported_provider(
        self, mock_react, mock_make_scm, mock_delete_eyes, mock_resolve, mock_sensitive, mock_incr
    ):
        # A provider that can't resolve threads is a logged non-failure: the hook
        # records the outcome instead of propagating.
        mock_make_scm.return_value = MagicMock()
        mock_resolve.side_effect = UnsupportedProviderError("StubScm")
        state = self._state_with([self._review_source(222, unique_id="PRRC_222")])

        self._run(state)

        assert self._reaction_outcomes(mock_incr) == ["resolve_unsupported_provider"]

    @patch(f"{REACT_PATH}.metrics.incr")
    @patch(f"{REACT_PATH}.is_github_rate_limit_sensitive", return_value=False)
    @patch(f"{REACT_PATH}._resolve_review_comment_threads")
    @patch(f"{REACT_PATH}._delete_own_comment_eyes_reaction")
    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_records_resolve_failure(
        self, mock_react, mock_make_scm, mock_delete_eyes, mock_resolve, mock_sensitive, mock_incr
    ):
        # An SCM failure must not bubble out of the completion hook.
        mock_make_scm.return_value = MagicMock()
        mock_resolve.side_effect = RuntimeError("boom")
        state = self._state_with([self._review_source(222, unique_id="PRRC_222")])

        self._run(state)

        assert self._reaction_outcomes(mock_incr) == ["resolve_failed"]

    @patch(f"{REACT_PATH}.is_github_rate_limit_sensitive", return_value=True)
    @patch(f"{REACT_PATH}._resolve_review_comment_threads")
    @patch(f"{REACT_PATH}._delete_own_comment_eyes_reaction")
    @patch(f"{REACT_PATH}.make_scm")
    @patch(f"{REACT_PATH}._add_comment_reaction")
    def test_skips_resolve_for_rate_limit_sensitive_org(
        self, mock_react, mock_make_scm, mock_delete_eyes, mock_resolve, mock_sensitive
    ):
        scm = MagicMock()
        mock_make_scm.return_value = scm
        state = self._state_with([self._review_source(222, unique_id="PRRC_222")])

        self._run(state)

        mock_resolve.assert_not_called()


class TestAutofixOnCompletionHookMilestones(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)
        self.run_id = 123
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=self.run_id
        )

    def _recorded_milestones(self) -> set[str]:
        return set(
            SeerRunMilestone.objects.filter(seer_run=self.seer_run).values_list(
                "milestone", flat=True
            )
        )

    def _run_hook(self, state) -> None:
        AutofixOnCompletionHook._send_step_webhook(
            self.organization, self.run_id, state, self.group
        )

    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_reconciles_milestones_from_state(self, mock_broadcast):
        # The hook wires state through to reconcile_milestones; firing twice on the
        # same state is idempotent, matching webhook redelivery.
        state = run_state(
            blocks=[
                root_cause_memory_block(),
                solution_memory_block(),
                code_changes_memory_block(),
            ]
        )
        self._run_hook(state)
        self._run_hook(state)
        assert self._recorded_milestones() == {
            SeerRunMilestoneType.ROOT_CAUSE,
            SeerRunMilestoneType.SOLUTION,
            SeerRunMilestoneType.CODE_CHANGES,
        }
        assert SeerRunMilestone.objects.filter(seer_run=self.seer_run).count() == 3

    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_skips_reconcile_when_no_step_completed(self, mock_broadcast):
        # A block with a reached artifact but no step metadata would derive
        # ROOT_CAUSE, but the hook returns before reconcile when no step matches.
        block = MemoryBlock(
            id="b",
            message=Message(role="assistant", content="c"),
            timestamp="2026-02-10T00:00:00Z",
            artifacts=[Artifact(key="root_cause", data={}, reason="explorer")],
        )
        self._run_hook(run_state(blocks=[block]))
        assert self._recorded_milestones() == set()
