import uuid
from datetime import datetime
from typing import Any, TypedDict, cast
from unittest.mock import Mock, patch

from rest_framework.response import Response

from fixtures.seer.webhooks import MOCK_RUN_ID
from sentry.models.organization import Organization
from sentry.seer.autofix.constants import AutofixStatus
from sentry.seer.autofix.utils import AutofixState, AutofixStoppingPoint
from sentry.seer.entrypoints.operator import (
    AUTOFIX_FALLBACK_CAUSE_ID,
    SeerOperator,
    get_autofix_explorer_status,
    process_autofix_updates,
)
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import (
    SeerEntrypoint,
    SeerEntrypointKey,
    SeerOperatorCacheResult,
)
from sentry.seer.explorer.client_models import MemoryBlock, Message, RepoPRState, SeerRunState
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.testutils.cases import TestCase


class MockCachePayload(TypedDict):
    thread_id: str


class MockEntrypoint(SeerEntrypoint[MockCachePayload]):
    """Mock entrypoint implementation for testing. Stores function calls similar to a mock."""

    key = cast(SeerEntrypointKey, "MOCK")

    def __init__(self):
        self.thread_id = str(uuid.uuid4())
        self.autofix_errors = []
        self.autofix_run_ids = []
        self.autofix_update_cache_payloads = []
        self.autofix_already_exists_states: list[tuple[int, bool]] = []

    @staticmethod
    def has_access(organization: Organization) -> bool:
        return True

    def on_trigger_autofix_already_exists(self, *, run_id: int, has_complete_stage: bool) -> None:
        self.autofix_already_exists_states.append((run_id, has_complete_stage))

    def on_trigger_autofix_error(self, *, error: str) -> None:
        self.autofix_errors.append(error)

    def on_trigger_autofix_success(self, *, run_id: int) -> None:
        self.autofix_run_ids.append(run_id)

    def create_autofix_cache_payload(self) -> MockCachePayload:
        return {"thread_id": self.thread_id}

    @staticmethod
    def on_autofix_update(
        event_type: SentryAppEventType,
        event_payload: dict[str, Any],
        cache_payload: MockCachePayload,
    ) -> None:
        MockCachePayload(**cache_payload)


class SeerOperatorTest(TestCase):
    def setUp(self):
        self.entrypoint = MockEntrypoint()
        self.operator = SeerOperator(self.entrypoint)

    @patch("sentry.seer.entrypoints.operator.has_seer_access", return_value=True)
    def test_has_access_with_seer(self, _mock_has_seer_access):
        MockNoAccessEntrypoint = Mock(spec=SeerEntrypoint)
        MockNoAccessEntrypoint.key = cast(SeerEntrypointKey, "MOCK_NO_ACCESS")
        MockNoAccessEntrypoint.has_access.return_value = False
        with (
            patch.dict(
                "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
                {
                    MockEntrypoint.key: MockEntrypoint,
                    MockNoAccessEntrypoint.key: MockNoAccessEntrypoint,
                },
                clear=True,
            ),
        ):
            assert SeerOperator.has_access(organization=self.group.project.organization)
            assert SeerOperator.has_access(
                organization=self.group.project.organization,
                entrypoint_key=MockEntrypoint.key,
            )
            assert not SeerOperator.has_access(
                organization=self.group.project.organization,
                entrypoint_key=MockNoAccessEntrypoint.key,
            )

    @patch("sentry.seer.entrypoints.operator.has_seer_access", return_value=False)
    def test_has_access_without_seer(self, _mock_has_seer_access):
        assert not SeerOperator.has_access(organization=self.group.project.organization)
        for entrypoint_key in entrypoint_registry.registrations.keys():
            assert not SeerOperator.has_access(
                organization=self.group.project.organization,
                entrypoint_key=cast(SeerEntrypointKey, entrypoint_key),
            )

    @patch(
        "sentry.seer.entrypoints.operator.update_autofix",
        return_value=Response({"run_id": MOCK_RUN_ID}, status=202),
    )
    @patch(
        "sentry.seer.entrypoints.operator.trigger_autofix",
        return_value=Response({"run_id": MOCK_RUN_ID}, status=202),
    )
    @patch("sentry.seer.entrypoints.operator.get_autofix_state", return_value=None)
    def test_trigger_autofix_pathway(
        self,
        mock_get_autofix_state,
        mock_trigger_autofix_helper,
        mock_update_autofix_helper,
    ):
        self.operator.trigger_autofix(
            group=self.group,
            user=self.user,
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
        )
        assert mock_trigger_autofix_helper.call_count == 1
        assert mock_update_autofix_helper.call_count == 0
        mock_trigger_autofix_helper.reset_mock()

        self.operator.trigger_autofix(
            group=self.group,
            user=self.user,
            stopping_point=AutofixStoppingPoint.SOLUTION,
            run_id=MOCK_RUN_ID,
        )
        assert mock_trigger_autofix_helper.call_count == 0
        assert mock_update_autofix_helper.call_count == 1

    @patch(
        "sentry.seer.entrypoints.operator.trigger_autofix",
        return_value=Response({"run_id": MOCK_RUN_ID}, status=202),
    )
    @patch("sentry.seer.entrypoints.operator.get_autofix_state", return_value=None)
    def test_trigger_autofix_success(self, mock_get_autofix_state, mock_trigger_autofix_helper):
        self.operator.trigger_autofix(
            group=self.group,
            user=self.user,
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
        )
        assert mock_trigger_autofix_helper.call_count == 1
        assert self.entrypoint.autofix_errors == []
        assert self.entrypoint.autofix_run_ids == [MOCK_RUN_ID]

    @patch("sentry.seer.entrypoints.operator.trigger_autofix")
    @patch("sentry.seer.entrypoints.operator.get_autofix_state")
    def test_trigger_autofix_already_exists(
        self, mock_get_autofix_state, mock_trigger_autofix_helper
    ):
        existing_rca_step_state = {
            "key": "root_cause_analysis",
            "status": AutofixStatus.COMPLETED,
        }
        existing_state = AutofixState(
            run_id=MOCK_RUN_ID,
            request={
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "issue": {"id": self.group.id, "title": "test"},
                "repos": [],
            },
            updated_at=datetime.now(),
            status=AutofixStatus.PROCESSING,
            steps=[existing_rca_step_state],
        )
        mock_get_autofix_state.return_value = existing_state

        self.operator.trigger_autofix(
            group=self.group,
            user=self.user,
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
        )

        mock_trigger_autofix_helper.assert_not_called()
        assert self.entrypoint.autofix_already_exists_states == [(existing_state.run_id, True)]
        assert self.entrypoint.autofix_run_ids == []
        assert self.entrypoint.autofix_errors == []

    @patch(
        "sentry.seer.entrypoints.operator.trigger_autofix",
        return_value=Response({"run_id": MOCK_RUN_ID}, status=202),
    )
    @patch("sentry.seer.entrypoints.operator.get_autofix_state")
    def test_trigger_autofix_proceeds_when_completed(
        self, mock_get_autofix_state, mock_trigger_autofix_helper
    ):
        existing_state = AutofixState(
            run_id=MOCK_RUN_ID,
            request={
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "issue": {"id": self.group.id, "title": "test"},
                "repos": [],
            },
            updated_at=datetime.now(),
            status=AutofixStatus.COMPLETED,
        )
        mock_get_autofix_state.return_value = existing_state

        self.operator.trigger_autofix(
            group=self.group,
            user=self.user,
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
        )

        mock_trigger_autofix_helper.assert_called_once()
        assert self.entrypoint.autofix_already_exists_states == []
        assert self.entrypoint.autofix_run_ids == [MOCK_RUN_ID]

    @patch("sentry.seer.entrypoints.operator.trigger_autofix")
    @patch("sentry.seer.entrypoints.operator.get_autofix_state", return_value=None)
    def test_trigger_autofix_error(self, mock_get_autofix_state, mock_trigger_autofix_helper):
        mock_trigger_autofix_helper.return_value = Response(
            {"detail": "Invalid request"}, status=400
        )
        self.operator.trigger_autofix(
            group=self.group,
            user=self.user,
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
        )
        mock_trigger_autofix_helper.return_value = Response({"run_id": None}, status=202)
        self.operator.trigger_autofix(
            group=self.group,
            user=self.user,
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
        )
        assert mock_trigger_autofix_helper.call_count == 2
        self.operator.trigger_autofix(
            group=self.group,
            user=self.user,
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
            run_id=MOCK_RUN_ID,
        )
        assert self.entrypoint.autofix_errors == [
            "Invalid request",
            "An unknown error has occurred",
            "Invalid stopping point provided",
        ]
        assert self.entrypoint.autofix_run_ids == []

    @patch(
        "sentry.seer.entrypoints.operator.trigger_autofix",
        return_value=Response({"run_id": MOCK_RUN_ID}, status=202),
    )
    @patch("sentry.seer.entrypoints.operator.get_autofix_state", return_value=None)
    @patch("sentry.seer.entrypoints.cache.SeerOperatorAutofixCache.populate_post_autofix_cache")
    def test_trigger_autofix_creates_cache_payload(
        self,
        mock_populate_post_autofix_cache,
        mock_get_autofix_state,
        mock_trigger_autofix_helper,
    ):
        self.operator.trigger_autofix(
            group=self.group,
            user=self.user,
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
        )
        mock_populate_post_autofix_cache.assert_called_with(
            entrypoint_key=MockEntrypoint.key,
            run_id=MOCK_RUN_ID,
            cache_payload=self.entrypoint.create_autofix_cache_payload(),
        )

    @patch.object(SeerOperator, "has_access", return_value=True)
    @patch.dict(
        "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
        {MockEntrypoint.key: MockEntrypoint},
        clear=True,
    )
    def test_process_autofix_updates_early_exits(self, _mock_has_access):
        with patch.object(MockEntrypoint, "on_autofix_update") as mock_on_autofix_update:
            # Missing group_id/run_id
            process_autofix_updates(
                event_type=SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
                event_payload={},
                organization_id=self.organization.id,
            )
            mock_on_autofix_update.assert_not_called()

            # Invalid event type
            process_autofix_updates(
                event_type=SentryAppEventType.ISSUE_CREATED,
                event_payload={"run_id": MOCK_RUN_ID, "group_id": self.group.id},
                organization_id=self.organization.id,
            )
            mock_on_autofix_update.assert_not_called()

            # Group not found
            process_autofix_updates(
                event_type=SentryAppEventType.SEER_ROOT_CAUSE_STARTED,
                event_payload={"run_id": MOCK_RUN_ID, "group_id": -1},
                organization_id=self.organization.id,
            )
            mock_on_autofix_update.assert_not_called()

            # Cache miss
            process_autofix_updates(
                event_type=SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
                event_payload={"run_id": MOCK_RUN_ID, "group_id": self.group.id},
                organization_id=self.organization.id,
            )
            mock_on_autofix_update.assert_not_called()

    @patch.object(SeerOperator, "has_access", return_value=True)
    @patch("sentry.seer.entrypoints.cache.SeerOperatorAutofixCache.get")
    def test_process_autofix_updates(self, mock_autofix_cache_get, _mock_has_access):
        cache_payload = self.entrypoint.create_autofix_cache_payload()
        mock_autofix_cache_get.side_effect = lambda **kwargs: SeerOperatorCacheResult(
            payload=cache_payload, source="run_id", key="abc"
        )
        mock_entrypoint_cls = Mock(spec=SeerEntrypoint)
        mock_entrypoint_cls.has_access.return_value = True
        event_type = SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED
        event_payload = {"run_id": MOCK_RUN_ID, "group_id": self.group.id}

        with patch.dict(
            "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
            {MockEntrypoint.key: mock_entrypoint_cls},
            clear=True,
        ):
            process_autofix_updates(
                event_type=event_type,
                event_payload=event_payload,
                organization_id=self.organization.id,
            )

        mock_entrypoint_cls.on_autofix_update.assert_called_once_with(
            event_type=event_type,
            event_payload=event_payload,
            cache_payload=cache_payload,
        )

    def test_process_autofix_updates_no_operator_access(self):
        mock_entrypoint_cls = Mock(spec=SeerEntrypoint)
        event_type = SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED
        event_payload = {"run_id": MOCK_RUN_ID, "group_id": self.group.id}

        with (
            patch.object(SeerOperator, "has_access", return_value=False),
            patch.dict(
                "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
                {MockEntrypoint.key: mock_entrypoint_cls},
                clear=True,
            ),
        ):
            process_autofix_updates(
                event_type=event_type,
                event_payload=event_payload,
                organization_id=self.organization.id,
            )

        mock_entrypoint_cls.has_access.assert_not_called()
        mock_entrypoint_cls.on_autofix_update.assert_not_called()

    @patch.object(SeerOperator, "has_access", return_value=True)
    @patch("sentry.seer.entrypoints.cache.SeerOperatorAutofixCache.get")
    def test_process_autofix_updates_skips_entrypoint_without_access(
        self, mock_autofix_cache_get, _mock_has_access
    ):
        cache_payload = self.entrypoint.create_autofix_cache_payload()
        mock_autofix_cache_get.side_effect = lambda **kwargs: SeerOperatorCacheResult(
            payload=cache_payload, source="run_id", key="abc"
        )
        mock_no_access_cls = Mock(spec=SeerEntrypoint)
        mock_no_access_cls.has_access.return_value = False
        mock_has_access_cls = Mock(spec=SeerEntrypoint)
        mock_has_access_cls.has_access.return_value = True
        event_type = SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED
        event_payload = {"run_id": MOCK_RUN_ID, "group_id": self.group.id}

        with patch.dict(
            "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
            {
                cast(SeerEntrypointKey, "NO_ACCESS"): mock_no_access_cls,
                cast(SeerEntrypointKey, "HAS_ACCESS"): mock_has_access_cls,
            },
            clear=True,
        ):
            process_autofix_updates(
                event_type=event_type,
                event_payload=event_payload,
                organization_id=self.organization.id,
            )

        mock_no_access_cls.on_autofix_update.assert_not_called()
        mock_has_access_cls.on_autofix_update.assert_called_once_with(
            event_type=event_type,
            event_payload=event_payload,
            cache_payload=cache_payload,
        )

    @patch("sentry.seer.entrypoints.operator.update_autofix")
    @patch("sentry.seer.entrypoints.operator.get_autofix_state", return_value=None)
    def test_solution_stopping_point_sends_select_root_cause(
        self, _mock_get_autofix_state, mock_update_autofix
    ):
        mock_update_autofix.return_value = Response({"run_id": MOCK_RUN_ID}, status=202)

        self.operator.trigger_autofix(
            group=self.group,
            user=self.user,
            stopping_point=AutofixStoppingPoint.SOLUTION,
            run_id=MOCK_RUN_ID,
        )

        mock_update_autofix.assert_called_once()
        call_kwargs = mock_update_autofix.call_args.kwargs
        assert call_kwargs["organization_id"] == self.group.organization.id
        payload = call_kwargs["payload"]
        assert payload["type"] == "select_root_cause"
        assert payload["cause_id"] == AUTOFIX_FALLBACK_CAUSE_ID

    @patch("sentry.seer.entrypoints.operator.has_seer_access", return_value=True)
    def test_has_access_returns_false_with_autofix_on_explorer(self, _mock_has_seer_access):
        with self.feature({"organizations:autofix-on-explorer": True}):
            assert not SeerOperator.has_access(organization=self.group.project.organization)

    @patch("sentry.seer.entrypoints.operator.update_autofix")
    @patch("sentry.seer.entrypoints.operator.get_autofix_state")
    def test_solution_stopping_point_uses_cause_id_from_state(
        self, mock_get_autofix_state, mock_update_autofix
    ):
        mock_update_autofix.return_value = Response({"run_id": MOCK_RUN_ID}, status=202)
        existing_state = AutofixState(
            run_id=MOCK_RUN_ID,
            request={
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "issue": {"id": self.group.id, "title": "test"},
                "repos": [],
            },
            updated_at=datetime.now(),
            status=AutofixStatus.PROCESSING,
            steps=[
                {
                    "key": "root_cause_analysis",
                    "status": AutofixStatus.COMPLETED,
                    "causes": [{"id": 12}, {"id": 34}],
                },
            ],
        )
        mock_get_autofix_state.return_value = existing_state

        self.operator.trigger_autofix(
            group=self.group,
            user=self.user,
            stopping_point=AutofixStoppingPoint.SOLUTION,
            run_id=MOCK_RUN_ID,
        )

        mock_update_autofix.assert_called_once()
        call_kwargs = mock_update_autofix.call_args.kwargs
        payload = call_kwargs["payload"]
        assert payload["type"] == "select_root_cause"
        assert payload["cause_id"] == 34

    def test_can_trigger_autofix_returns_false_without_seer_access(self):
        assert SeerOperator.can_trigger_autofix(group=self.group) is False

    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    def test_can_trigger_autofix_returns_true_when_all_conditions_met(self, mock_quota):
        with self.feature(
            {
                "organizations:gen-ai-features": True,
            }
        ):
            assert SeerOperator.can_trigger_autofix(group=self.group) is True

    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    def test_can_trigger_autofix_returns_false_for_ineligible_category(self, mock_quota):
        from sentry.issues.grouptype import FeedbackGroup

        feedback_group = self.create_group(project=self.project, type=FeedbackGroup.type_id)
        with self.feature(
            {
                "organizations:gen-ai-features": True,
            }
        ):
            assert SeerOperator.can_trigger_autofix(group=feedback_group) is False

    @patch("sentry.quotas.backend.check_seer_quota", return_value=False)
    def test_can_trigger_autofix_returns_false_without_quota(self, mock_quota):
        with self.feature(
            {
                "organizations:gen-ai-features": True,
            }
        ):
            assert SeerOperator.can_trigger_autofix(group=self.group) is False


class TestGetAutofixExplorerStatus(TestCase):
    @staticmethod
    def _make_block(step: str, block_id: str = "1") -> MemoryBlock:
        return MemoryBlock(
            id=block_id,
            message=Message(role="assistant", metadata={"step": step}),
            timestamp="2024-01-01T00:00:00Z",
        )

    @staticmethod
    def _make_state(
        blocks: list[MemoryBlock],
        status: str = "completed",
        repo_pr_states: dict[str, RepoPRState] | None = None,
    ) -> SeerRunState:
        return SeerRunState(
            run_id=1,
            blocks=blocks,
            status=status,
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states=repo_pr_states or {},
        )

    def test_no_blocks_returns_none(self):
        state = self._make_state(blocks=[])
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is None

    def test_blocks_with_no_metadata_returns_none(self):
        block = MemoryBlock(
            id="1",
            message=Message(role="assistant", metadata=None),
            timestamp="2024-01-01T00:00:00Z",
        )
        state = self._make_state(blocks=[block])
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is None

    def test_blocks_with_metadata_but_no_step_key_returns_none(self):
        block = MemoryBlock(
            id="1",
            message=Message(role="assistant", metadata={"other": "value"}),
            timestamp="2024-01-01T00:00:00Z",
        )
        state = self._make_state(blocks=[block])
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is None

    def test_block_with_invalid_step_value_returns_none(self):
        block = MemoryBlock(
            id="1",
            message=Message(role="assistant", metadata={"step": "not_a_real_step"}),
            timestamp="2024-01-01T00:00:00Z",
        )
        state = self._make_state(blocks=[block])
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is None

    def test_matching_last_block_processing_returns_false(self):
        block = self._make_block("root_cause")
        state = self._make_state(blocks=[block], status="processing")
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is False

    def test_matching_last_block_completed_returns_true(self):
        block = self._make_block("root_cause")
        state = self._make_state(blocks=[block], status="completed")
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is True

    def test_matching_last_block_error_returns_true(self):
        block = self._make_block("root_cause")
        state = self._make_state(blocks=[block], status="error")
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is True

    def test_matching_block_not_last_returns_true(self):
        root_cause_block = self._make_block("root_cause", block_id="1")
        solution_block = self._make_block("solution", block_id="2")
        state = self._make_state(blocks=[root_cause_block, solution_block], status="processing")
        # root_cause is not the last block, so it's already completed
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is True

    def test_open_pr_no_repo_pr_states_returns_false(self):
        block = self._make_block("code_changes")
        state = self._make_state(blocks=[block], repo_pr_states={})
        assert get_autofix_explorer_status(AutofixStoppingPoint.OPEN_PR, state) is None

    def test_open_pr_all_prs_completed_returns_true(self):
        block = self._make_block("code_changes")
        pr_states = {
            "repo1": RepoPRState(repo_name="repo1", pr_creation_status="completed"),
            "repo2": RepoPRState(repo_name="repo2", pr_creation_status="completed"),
        }
        state = self._make_state(blocks=[block], repo_pr_states=pr_states)
        assert get_autofix_explorer_status(AutofixStoppingPoint.OPEN_PR, state) is True

    def test_open_pr_some_prs_still_creating_returns_false(self):
        block = self._make_block("code_changes")
        pr_states = {
            "repo1": RepoPRState(repo_name="repo1", pr_creation_status="completed"),
            "repo2": RepoPRState(repo_name="repo2", pr_creation_status="creating"),
        }
        state = self._make_state(blocks=[block], repo_pr_states=pr_states)
        assert get_autofix_explorer_status(AutofixStoppingPoint.OPEN_PR, state) is False

    def test_multiple_stopping_points(self):
        """Verify from_autofix_stopping_point mapping works for various stopping points."""
        root_cause_block = self._make_block("root_cause", block_id="1")
        solution_block = self._make_block("solution", block_id="2")
        code_changes_block = self._make_block("code_changes", block_id="3")
        state = self._make_state(
            blocks=[root_cause_block, solution_block, code_changes_block],
            status="processing",
        )

        # root_cause and solution are not the last block → True
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is True
        assert get_autofix_explorer_status(AutofixStoppingPoint.SOLUTION, state) is True
        # code_changes is the last block and status is processing → False
        assert get_autofix_explorer_status(AutofixStoppingPoint.CODE_CHANGES, state) is False
