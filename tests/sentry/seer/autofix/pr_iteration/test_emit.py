from __future__ import annotations

from typing import Any
from unittest.mock import patch

from sentry.seer.agent.client_models import (
    AgentFilePatch,
    FilePatch,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
    ToolCall,
    ToolLink,
    ToolResult,
)
from sentry.seer.autofix.pr_iteration.emit import (
    DETAILS_EMITTED_EXTRA,
    emit_pr_iteration_details,
    emit_pr_iteration_details_started,
)
from sentry.seer.autofix.pr_iteration.feedback import Feedback, serialize_feedback
from sentry.seer.models.run import SeerRunPullRequest
from sentry.testutils.cases import TestCase

RUN_ID = 4242
REPO_NAME = "owner/repo"
PR_NUMBER = 7
TRIGGER_SHA = "aaaa1111"
RESULT_SHA = "bbbb2222"


def _assert_row(row: Any, **expected: Any) -> None:
    assert row is not None
    for name, value in expected.items():
        assert getattr(row, name) == value, name


def _check_suite_feedback(head_sha: str = TRIGGER_SHA) -> Feedback:
    return Feedback.parse_obj(
        {
            "source": {
                "type": "check-suite",
                "event": {
                    "check_suite": {
                        "id": 1,
                        "head_sha": head_sha,
                        "check_runs_url": "https://github.com/owner/repo/check-runs",
                        "app": {"name": "CI"},
                        "conclusion": "failure",
                        "updated_at": "2024-01-01T00:00:00Z",
                    },
                    "repository": {
                        "html_url": "https://github.com/owner/repo",
                        "full_name": REPO_NAME,
                    },
                },
            }
        }
    )


def _patch(added: int = 3, removed: int = 1, path: str = "src/a.py") -> AgentFilePatch:
    return AgentFilePatch(
        repo_name=REPO_NAME,
        patch=FilePatch(path=path, type="M", added=added, removed=removed),
    )


def _iteration_block(
    *,
    index: int = 0,
    patches: list[AgentFilePatch] | None = None,
    pr_commit_shas: dict[str, str] | None = None,
    consume_id: str | None = None,
) -> MemoryBlock:
    metadata: dict[str, Any] = {
        "step": "pr_iteration",
        "iteration_index": str(index),
        "feedback": serialize_feedback([_check_suite_feedback()]),
    }
    if consume_id is not None:
        metadata["consume_id"] = consume_id
    return MemoryBlock(
        id=f"block-{index}",
        timestamp="2024-01-01T00:00:00Z",
        message=Message(
            role="assistant",
            metadata=metadata,
        ),
        merged_file_patches=patches,
        pr_commit_shas=pr_commit_shas,
    )


def _failed_tool_block(function: str = "get_pr_files") -> MemoryBlock:
    return MemoryBlock(
        id="tool-block",
        timestamp="2024-01-01T00:01:00Z",
        message=Message(
            role="assistant",
            tool_calls=[ToolCall(id="call-1", function=function, args="{}")],
        ),
        tool_links=[ToolLink(kind="tool", params={"is_error": True})],
        tool_results=[ToolResult(tool_call_id="call-1", tool_call_function=function)],
    )


class EmitPrIterationDetailsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project, provider="integrations:github", name=REPO_NAME
        )
        self.pull_request = self.create_pull_request(
            repository_id=self.repo.id, key=str(PR_NUMBER), organization_id=self.organization.id
        )
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )
        SeerRunPullRequest.objects.create(seer_run=self.seer_run, pull_request=self.pull_request)

    def _state(
        self,
        *,
        blocks: list[MemoryBlock],
        status: str = "completed",
        commit_sha: str | None = RESULT_SHA,
        pr_creation_status: str | None = None,
        pr_creation_error_code: str | None = None,
    ) -> SeerRunState:
        pr_state_kwargs: dict[str, Any] = {
            "repo_name": REPO_NAME,
            "pr_number": PR_NUMBER,
            "commit_sha": commit_sha,
        }
        if pr_creation_status is not None:
            pr_state_kwargs["pr_creation_status"] = pr_creation_status
        if pr_creation_error_code is not None:
            pr_state_kwargs["pr_creation_error_code"] = pr_creation_error_code
        return SeerRunState(
            run_id=RUN_ID,
            blocks=blocks,
            status=status,
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={REPO_NAME: RepoPRState(**pr_state_kwargs)},
        )

    def _emit(
        self, state: SeerRunState, errored_repos: list[str] | None = None
    ) -> tuple[bool, Any]:
        with patch("sentry.seer.autofix.pr_iteration.emit.analytics.record") as record:
            emitted = emit_pr_iteration_details(
                organization=self.organization,
                group=self.group,
                run_id=RUN_ID,
                state=state,
                errored_repos=errored_repos or [],
                referrer="github.check_suite",
            )
        row = record.call_args.args[0] if record.call_args else None
        return emitted, row

    def test_no_code_changes(self) -> None:
        state = self._state(blocks=[_iteration_block()])

        emitted, row = self._emit(state)
        assert emitted is True
        _assert_row(
            row,
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=self.group.id,
            run_id=RUN_ID,
            repository_id=self.repo.id,
            pull_request_id=self.pull_request.id,
            repository_provider="github",
            referrer="github.check_suite",
            iteration_index=0,
            consecutive_automated_iterations=1,
            trigger_source="check-suite",
            trigger_feedback_count=1,
            trigger_head_sha=TRIGGER_SHA,
            outcome="no_code_changes",
            failure_stage="agent",
            run_status="completed",
            result_head_sha=None,
            files_changed=0,
        )

    def test_code_changes_pushed(self) -> None:
        block = _iteration_block(patches=[_patch()], pr_commit_shas={REPO_NAME: RESULT_SHA})
        state = self._state(blocks=[block])

        emitted, row = self._emit(state)
        assert emitted is True
        _assert_row(
            row,
            run_id=RUN_ID,
            outcome="code_changes_pushed",
            failure_stage="none",
            result_head_sha=RESULT_SHA,
            files_changed=1,
            lines_added=3,
            lines_removed=1,
        )

    def test_unsynced_iteration_is_not_terminal(self) -> None:
        block = _iteration_block(patches=[_patch()], pr_commit_shas={REPO_NAME: "stale"})
        state = self._state(blocks=[block])

        assert self._emit(state)[0] is False

    def _push_failure_state(self, code: str | None) -> SeerRunState:
        block = _iteration_block(patches=[_patch()], pr_commit_shas={REPO_NAME: "stale"})
        return self._state(
            blocks=[block],
            pr_creation_status="error",
            pr_creation_error_code=code,
        )

    def test_push_failed_carries_seer_error_code(self) -> None:
        state = self._push_failure_state("missing_permission")

        emitted, row = self._emit(state, errored_repos=[REPO_NAME])
        assert emitted is True
        _assert_row(
            row,
            run_id=RUN_ID,
            outcome="push_failed",
            failure_stage="push",
            push_error_code="missing_permission",
        )

    def test_push_failed_with_no_error_code_recorded(self) -> None:
        state = self._push_failure_state(None)

        emitted, row = self._emit(state, errored_repos=[REPO_NAME])
        assert emitted is True
        _assert_row(row, outcome="push_failed", push_error_code=None)

    def test_workflow_patches_detected_in_diff(self) -> None:
        block = _iteration_block(
            patches=[_patch(), _patch(path=".github/workflows/ci.yml")],
            pr_commit_shas={REPO_NAME: RESULT_SHA},
        )

        emitted, row = self._emit(self._state(blocks=[block]))
        assert emitted is True
        _assert_row(row, outcome="code_changes_pushed", has_workflow_patches=True)

    def test_workflow_patches_absent_from_ordinary_diff(self) -> None:
        block = _iteration_block(patches=[_patch()], pr_commit_shas={REPO_NAME: RESULT_SHA})

        emitted, row = self._emit(self._state(blocks=[block]))
        assert emitted is True
        _assert_row(row, outcome="code_changes_pushed", has_workflow_patches=False)

    def test_agent_error(self) -> None:
        state = self._state(blocks=[_iteration_block()], status="error")

        emitted, row = self._emit(state)
        assert emitted is True
        _assert_row(
            row,
            run_id=RUN_ID,
            outcome="agent_error",
            failure_stage="agent",
            run_status="error",
        )

    def test_failed_tool_calls_are_broken_down_by_name(self) -> None:
        state = self._state(blocks=[_iteration_block(), _failed_tool_block()])

        with patch(
            "sentry.seer.autofix.pr_iteration.emit.get_out_of_date_github_permissions",
            return_value={},
        ):
            emitted, row = self._emit(state)
        assert emitted is True
        _assert_row(
            row,
            run_id=RUN_ID,
            outcome="no_code_changes",
            tool_calls_total=1,
            tool_calls_failed=1,
            tool_calls_failed_by_name='{"get_pr_files":1}',
            missing_permission_scopes=[],
        )

    def test_emits_once_per_iteration(self) -> None:
        state = self._state(blocks=[_iteration_block()])

        assert self._emit(state)[0] is True
        assert self._emit(state)[0] is False

        self.seer_run.refresh_from_db()
        assert (self.seer_run.extras or {})[DETAILS_EMITTED_EXTRA] == {"0": True}

    def test_consume_id_is_emitted_and_dedupes(self) -> None:
        state = self._state(blocks=[_iteration_block(consume_id="abc123")])

        emitted, row = self._emit(state)
        assert emitted is True
        _assert_row(row, consume_id="abc123")
        assert self._emit(state)[0] is False

        self.seer_run.refresh_from_db()
        assert (self.seer_run.extras or {})[DETAILS_EMITTED_EXTRA] == {"abc123": True}

    def test_dedupe_keys_on_consume_id_not_index(self) -> None:
        first = self._state(blocks=[_iteration_block(index=0, consume_id="first")])
        second = self._state(blocks=[_iteration_block(index=0, consume_id="second")])

        assert self._emit(first)[0] is True
        emitted, row = self._emit(second)
        assert emitted is True
        _assert_row(row, consume_id="second")

    def test_started_records_consume_id(self) -> None:
        feedback = _check_suite_feedback()

        with patch("sentry.seer.autofix.pr_iteration.emit.analytics.record") as record:
            emitted = emit_pr_iteration_details_started(
                run_id=RUN_ID,
                organization_id=self.organization.id,
                group_id=self.group.id,
                consume_id="abc123",
                feedback=feedback,
                referrer="github.check_suite",
            )

        assert emitted is True
        _assert_row(
            record.call_args.args[0],
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=self.group.id,
            run_id=RUN_ID,
            consume_id="abc123",
            referrer="github.check_suite",
            trigger_head_sha=TRIGGER_SHA,
        )
