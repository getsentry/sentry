from typing import Any
from unittest.mock import MagicMock, patch

from sentry.seer.agent.client_models import MemoryBlock, Message, RepoPRState, SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.feature.models import FEATURE_ID
from sentry.seer.autofix.steps import AutofixStep
from sentry.testutils.cases import APITestCase
from sentry.viewer_context import ActorType, ViewerContext, get_viewer_context


def block(step: str | None, referrer: str | None = None) -> MemoryBlock:
    metadata: dict[str, str] = {}
    if step is not None:
        metadata["step"] = step
    if referrer is not None:
        metadata["referrer"] = referrer
    return MemoryBlock(
        id=f"block-{step}",
        message=Message(role="assistant", content="", metadata=metadata or None),
        timestamp="2026-02-10T00:00:00Z",
    )


def run_state(
    run_id: int,
    blocks: list[MemoryBlock],
    status: str = "error",
    group_id: int | None = None,
    repo_pr_states: dict[str, RepoPRState] | None = None,
) -> SeerRunState:
    return SeerRunState(
        run_id=run_id,
        blocks=blocks,
        status=status,
        updated_at="2026-02-10T00:00:00Z",
        metadata={"group_id": group_id} if group_id is not None else None,
        repo_pr_states=repo_pr_states or {},
    )


@patch("sentry.seer.endpoints.admin_autofix_retry.trigger_autofix_agent")
@patch("sentry.seer.endpoints.admin_autofix_retry.fetch_run_status")
class SeerAdminAutofixRetryTest(APITestCase):
    endpoint = "sentry-admin-seer-autofix-retry"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(is_staff=True)
        self.login_as(user=self.user)
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    def get_response(self, *args, **params):
        with patch("sentry.api.permissions.is_active_staff", return_value=True):
            return super().get_response(*args, **params)

    def create_autofix_run(self, run_id: int, source: str = FEATURE_ID) -> None:
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=run_id)
        self.create_seer_agent_run(run=run, source=source, group_id=self.group.id)

    def test_retries_failed_step_as_system(
        self, mock_fetch: MagicMock, mock_trigger: MagicMock
    ) -> None:
        self.create_autofix_run(1)
        mock_fetch.return_value = run_state(
            1,
            [
                block("root_cause", referrer=AutofixReferrer.NIGHT_SHIFT.value),
                block(None),
                block("solution", referrer=AutofixReferrer.NIGHT_SHIFT.value),
                block(None),
            ],
            group_id=self.group.id,
        )
        viewer_contexts: list[ViewerContext | None] = []
        mock_trigger.side_effect = lambda **kwargs: viewer_contexts.append(get_viewer_context())

        response = self.get_success_response(run_ids=[1])

        assert response.data["results"] == [
            {"run_id": 1, "retried": True, "step": AutofixStep.SOLUTION}
        ]
        mock_fetch.assert_called_once_with(1, self.organization)
        mock_trigger.assert_called_once_with(
            group=self.group,
            step=AutofixStep.SOLUTION,
            referrer=AutofixReferrer.NIGHT_SHIFT,
            run_id=1,
            insert_index=2,
        )
        assert viewer_contexts == [
            ViewerContext(organization_id=self.organization.id, actor_type=ActorType.SYSTEM)
        ]

    def test_reports_per_run_results(self, mock_fetch: MagicMock, mock_trigger: MagicMock) -> None:
        other_group = self.create_group(
            project=self.create_project(organization=self.create_organization())
        )
        for run_id in range(1, 8):
            self.create_autofix_run(run_id)
        self.create_autofix_run(8, source="chat")
        states = {
            1: run_state(1, [block("root_cause")], group_id=self.group.id),
            2: run_state(2, [block("root_cause")], status="completed", group_id=self.group.id),
            3: run_state(3, [block("pr_iteration")], group_id=self.group.id),
            4: run_state(4, [block(None)], group_id=self.group.id),
            5: run_state(5, [block("root_cause")], group_id=other_group.id),
            6: run_state(
                6,
                [block("code_changes")],
                group_id=self.group.id,
                repo_pr_states={
                    "owner/repo": RepoPRState(
                        repo_name="owner/repo", pr_number=1, pr_creation_status="completed"
                    )
                },
            ),
        }

        def fetch(run_id, organization):
            if run_id == 7:
                raise Exception("seer down")
            return states[run_id]

        mock_fetch.side_effect = fetch

        response = self.get_success_response(run_ids=[1, 2, 3, 4, 5, 6, 7, 8, 9, 1])

        results = {r["run_id"]: r for r in response.data["results"]}
        assert len(response.data["results"]) == 9
        assert results[1]["retried"] is True
        assert results[2]["reason"] == "Run status is 'completed', not 'error'"
        assert results[3]["reason"] == "Retrying the pr_iteration step is not supported"
        assert results[4]["reason"] == "Could not determine the failed step"
        assert results[5]["reason"] == "Group not found"
        assert results[6]["reason"] == "Run has a pull request or coding agent"
        assert results[7]["reason"] == "Failed to fetch run state"
        assert results[8]["reason"] == "Autofix run not found"
        assert results[9]["reason"] == "Autofix run not found"
        mock_trigger.assert_called_once()

    def test_trigger_failure(self, mock_fetch: MagicMock, mock_trigger: MagicMock) -> None:
        self.create_autofix_run(1)
        mock_fetch.return_value = run_state(1, [block("root_cause")], group_id=self.group.id)
        mock_trigger.side_effect = Exception("boom")

        response = self.get_success_response(run_ids=[1])

        assert response.data["results"] == [
            {"run_id": 1, "retried": False, "reason": "Failed to trigger the step"}
        ]

    def test_invalid_payload(self, mock_fetch: MagicMock, mock_trigger: MagicMock) -> None:
        payloads: list[dict[str, Any]] = [
            {},
            {"run_ids": []},
            {"run_ids": ["abc"]},
            {"run_ids": list(range(51))},
        ]
        for payload in payloads:
            response = self.get_response(**payload)
            assert response.status_code == 400, payload
        mock_fetch.assert_not_called()

    def test_requires_staff(self, mock_fetch: MagicMock, mock_trigger: MagicMock) -> None:
        self.login_as(self.create_user())
        response = super().get_response(run_ids=[1])
        assert response.status_code == 403
        mock_fetch.assert_not_called()
