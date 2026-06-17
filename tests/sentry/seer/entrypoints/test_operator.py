import uuid
from datetime import datetime
from typing import Any, TypedDict, cast
from unittest.mock import Mock, patch

from fixtures.seer.webhooks import MOCK_RUN_ID
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
)
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.agent.client_models import (
    CodingAgentState,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
)
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    CodingAgentProviderType,
)
from sentry.seer.entrypoints.operator import (
    SEER_EVENT_TO_ACTIVITY_TYPE,
    SeerAgentOperator,
    SeerAutofixOperator,
    SeerOperatorCompletionHook,
    get_autofix_explorer_status,
    process_autofix_updates,
)
from sentry.seer.entrypoints.registry import autofix_entrypoint_registry
from sentry.seer.entrypoints.types import (
    SeerAgentEntrypoint,
    SeerAutofixEntrypoint,
    SeerEntrypointKey,
    SeerOperatorCacheResult,
)
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.testutils.asserts import assert_failure_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.types.activity import ActivityType


class MockCachePayload(TypedDict):
    thread_id: str


class MockAutofixEntrypoint(SeerAutofixEntrypoint[MockCachePayload]):
    """Mock entrypoint implementation for testing. Stores function calls similar to a mock."""

    key = cast(SeerEntrypointKey, "MOCK")

    def __init__(self):
        self.thread_id = str(uuid.uuid4())
        self.autofix_errors = []
        self.autofix_run_ids = []
        self.autofix_update_cache_payloads = []
        self.autofix_already_exists_states: list[tuple[int, bool]] = []
        self.handoff_errors: list[str] = []
        self.handoff_successes: list[tuple[int, CodingAgentProviderType]] = []
        self.handoff_already_exists: list[tuple[int, CodingAgentProviderType, bool]] = []

    @staticmethod
    def has_access(organization: Organization) -> bool:
        return True

    def on_trigger_autofix_already_exists(self, *, run_id: int, has_complete_stage: bool) -> None:
        self.autofix_already_exists_states.append((run_id, has_complete_stage))

    def on_trigger_autofix_error(self, *, error: str) -> None:
        self.autofix_errors.append(error)

    def on_trigger_autofix_success(self, *, run_id: int) -> None:
        self.autofix_run_ids.append(run_id)

    def on_trigger_handoff_already_exists(
        self, *, run_id: int, target: CodingAgentProviderType, has_complete_stage: bool
    ) -> None:
        self.handoff_already_exists.append((run_id, target, has_complete_stage))

    def on_trigger_handoff_error(self, *, error: str) -> None:
        self.handoff_errors.append(error)

    def on_trigger_handoff_success(self, *, run_id: int, target: CodingAgentProviderType) -> None:
        self.handoff_successes.append((run_id, target))

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
    def setUp(self) -> None:
        self.entrypoint = MockAutofixEntrypoint()
        self.operator = SeerAutofixOperator(self.entrypoint)

    def _set_automation_handoff(
        self, target: CodingAgentProviderType = CodingAgentProviderType.CURSOR_BACKGROUND_AGENT
    ) -> None:
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option("sentry:seer_automation_handoff_target", target.value)
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 789)

    @patch("sentry.seer.entrypoints.operator.has_seer_access", return_value=True)
    def test_has_access_with_seer(self, _mock_has_seer_access):
        MockNoAccessEntrypoint = Mock(spec=SeerAutofixEntrypoint)
        MockNoAccessEntrypoint.key = cast(SeerEntrypointKey, "MOCK_NO_ACCESS")
        MockNoAccessEntrypoint.has_access.return_value = False
        with (
            patch.dict(
                "sentry.seer.entrypoints.operator.autofix_entrypoint_registry.registrations",
                {
                    MockAutofixEntrypoint.key: MockAutofixEntrypoint,
                    MockNoAccessEntrypoint.key: MockNoAccessEntrypoint,
                },
                clear=True,
            ),
        ):
            assert SeerAutofixOperator.has_access(organization=self.group.project.organization)
            assert SeerAutofixOperator.has_access(
                organization=self.group.project.organization,
                entrypoint_key=MockAutofixEntrypoint.key,
            )
            assert not SeerAutofixOperator.has_access(
                organization=self.group.project.organization,
                entrypoint_key=MockNoAccessEntrypoint.key,
            )

    @patch("sentry.seer.entrypoints.operator.has_seer_access", return_value=False)
    def test_has_access_without_seer(self, _mock_has_seer_access):
        assert not SeerAutofixOperator.has_access(organization=self.group.project.organization)
        for entrypoint_key in autofix_entrypoint_registry.registrations.keys():
            assert not SeerAutofixOperator.has_access(
                organization=self.group.project.organization,
                entrypoint_key=cast(SeerEntrypointKey, entrypoint_key),
            )

    @patch("sentry.seer.autofix.autofix_agent.trigger_coding_agent_handoff")
    def test_trigger_handoff_no_config_is_silent_halt(self, mock_trigger_handoff_helper):
        self.operator.trigger_handoff(group=self.group, run_id=MOCK_RUN_ID)
        mock_trigger_handoff_helper.assert_not_called()
        assert self.entrypoint.handoff_successes == []
        assert self.entrypoint.handoff_already_exists == []
        assert self.entrypoint.handoff_errors == []

    @patch("sentry.seer.entrypoints.operator.fetch_run_status", return_value=None)
    @patch(
        "sentry.seer.autofix.autofix_agent.trigger_coding_agent_handoff",
        side_effect=RuntimeError("boom"),
    )
    def test_trigger_handoff_launch_error_calls_error_hook(
        self, mock_trigger_handoff_helper, mock_fetch_status
    ):
        self._set_automation_handoff()
        mock_fetch_status.return_value = self._build_explorer_state_with_agents({})
        self.operator.trigger_handoff(group=self.group, run_id=MOCK_RUN_ID)
        assert self.entrypoint.handoff_errors == [
            "Encountered an error while launching the coding agent"
        ]
        assert self.entrypoint.handoff_successes == []

    def _build_explorer_state_with_agents(
        self, agents: dict[str, CodingAgentState]
    ) -> SeerRunState:
        return SeerRunState(
            run_id=MOCK_RUN_ID,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            coding_agents=agents,
        )

    @patch("sentry.seer.entrypoints.operator.fetch_run_status")
    @patch("sentry.seer.autofix.autofix_agent.trigger_coding_agent_handoff")
    def test_trigger_handoff_success(self, mock_trigger_handoff_helper, mock_fetch_status):
        self._set_automation_handoff()
        mock_fetch_status.return_value = self._build_explorer_state_with_agents({})
        self.operator.trigger_handoff(group=self.group, run_id=MOCK_RUN_ID)
        mock_trigger_handoff_helper.assert_called_once()
        assert mock_trigger_handoff_helper.call_args.kwargs["referrer"] == AutofixReferrer.SLACK
        assert self.entrypoint.handoff_successes == [
            (MOCK_RUN_ID, CodingAgentProviderType.CURSOR_BACKGROUND_AGENT)
        ]
        assert self.entrypoint.handoff_already_exists == []
        assert self.entrypoint.handoff_errors == []

    @patch("sentry.seer.entrypoints.operator.fetch_run_status")
    @patch("sentry.seer.autofix.autofix_agent.trigger_coding_agent_handoff")
    def test_trigger_handoff_already_exists_running(
        self, mock_trigger_handoff_helper, mock_fetch_status
    ):
        self._set_automation_handoff()
        mock_fetch_status.return_value = self._build_explorer_state_with_agents(
            {
                "agent-1": CodingAgentState(
                    id="agent-1",
                    status="running",
                    provider="cursor_background_agent",
                    name="Cursor",
                    started_at=datetime.now(),
                )
            }
        )
        self.operator.trigger_handoff(group=self.group, run_id=MOCK_RUN_ID)
        mock_trigger_handoff_helper.assert_not_called()
        assert self.entrypoint.handoff_already_exists == [
            (MOCK_RUN_ID, CodingAgentProviderType.CURSOR_BACKGROUND_AGENT, False)
        ]

    @patch("sentry.seer.entrypoints.operator.fetch_run_status")
    @patch("sentry.seer.autofix.autofix_agent.trigger_coding_agent_handoff")
    def test_trigger_handoff_already_exists_completed(
        self, mock_trigger_handoff_helper, mock_fetch_status
    ):
        self._set_automation_handoff()
        mock_fetch_status.return_value = self._build_explorer_state_with_agents(
            {
                "agent-1": CodingAgentState(
                    id="agent-1",
                    status="completed",
                    provider="cursor_background_agent",
                    name="Cursor",
                    started_at=datetime.now(),
                )
            }
        )
        self.operator.trigger_handoff(group=self.group, run_id=MOCK_RUN_ID)
        mock_trigger_handoff_helper.assert_not_called()
        assert self.entrypoint.handoff_already_exists == [
            (MOCK_RUN_ID, CodingAgentProviderType.CURSOR_BACKGROUND_AGENT, True)
        ]

    @patch("sentry.seer.entrypoints.operator.fetch_run_status")
    @patch("sentry.seer.autofix.autofix_agent.trigger_coding_agent_handoff")
    def test_trigger_handoff_proceeds_when_all_agents_failed(
        self, mock_trigger_handoff_helper, mock_fetch_status
    ):
        self._set_automation_handoff()
        mock_fetch_status.return_value = self._build_explorer_state_with_agents(
            {
                "agent-1": CodingAgentState(
                    id="agent-1",
                    status="failed",
                    provider="cursor_background_agent",
                    name="Cursor",
                    started_at=datetime.now(),
                )
            }
        )
        self.operator.trigger_handoff(group=self.group, run_id=MOCK_RUN_ID)
        mock_trigger_handoff_helper.assert_called_once()
        assert self.entrypoint.handoff_successes == [
            (MOCK_RUN_ID, CodingAgentProviderType.CURSOR_BACKGROUND_AGENT)
        ]
        assert self.entrypoint.handoff_already_exists == []

    @patch(
        "sentry.seer.entrypoints.operator.fetch_run_status",
        side_effect=Exception("seer down"),
    )
    @patch("sentry.seer.autofix.autofix_agent.trigger_coding_agent_handoff")
    def test_trigger_handoff_state_fetch_error_calls_error_hook(
        self, mock_trigger_handoff_helper, mock_fetch_status
    ):
        self._set_automation_handoff()
        self.operator.trigger_handoff(group=self.group, run_id=MOCK_RUN_ID)
        mock_trigger_handoff_helper.assert_not_called()
        assert self.entrypoint.handoff_errors == ["Encountered an error while talking to Seer"]
        assert self.entrypoint.handoff_successes == []

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    @patch.dict(
        "sentry.seer.entrypoints.operator.autofix_entrypoint_registry.registrations",
        {MockAutofixEntrypoint.key: MockAutofixEntrypoint},
        clear=True,
    )
    def test_process_autofix_updates_early_exits(self, _mock_has_access):
        with patch.object(MockAutofixEntrypoint, "on_autofix_update") as mock_on_autofix_update:
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

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    @patch("sentry.seer.entrypoints.cache.SeerOperatorAutofixCache.get")
    def test_process_autofix_updates(self, mock_autofix_cache_get, _mock_has_access):
        cache_payload = self.entrypoint.create_autofix_cache_payload()
        mock_autofix_cache_get.side_effect = lambda **kwargs: SeerOperatorCacheResult(
            payload=cache_payload, source="run_id", key="abc"
        )
        mock_entrypoint_cls = Mock(spec=SeerAutofixEntrypoint)
        mock_entrypoint_cls.has_access.return_value = True
        event_type = SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED
        event_payload = {"run_id": MOCK_RUN_ID, "group_id": self.group.id}

        with patch.dict(
            "sentry.seer.entrypoints.operator.autofix_entrypoint_registry.registrations",
            {MockAutofixEntrypoint.key: mock_entrypoint_cls},
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

    def _pr_created_event_payload(self) -> dict:
        return {
            "run_id": MOCK_RUN_ID,
            "group_id": self.group.id,
            "pull_requests": [
                {
                    "provider": "unknown",
                    "repo_name": "getsentry/sentry",
                    "pull_request": {"pr_id": 1, "pr_number": 99, "pr_url": "https://x/99"},
                }
            ],
        }

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    def test_process_autofix_updates_records_pr_attribution(self, _mock_has_access):
        repo = self.create_repo(self.project, name="getsentry/sentry")

        with (
            self.feature("organizations:pr-metrics-attribution"),
            override_options({"issues.record-seer-actions-as-activities": False}),
            patch.dict(
                "sentry.seer.entrypoints.operator.autofix_entrypoint_registry.registrations",
                {},
                clear=True,
            ),
        ):
            process_autofix_updates(
                event_type=SentryAppEventType.SEER_PR_CREATED,
                event_payload=self._pr_created_event_payload(),
                organization_id=self.organization.id,
            )

        pull_request = PullRequest.objects.get(repository_id=repo.id, key="99")
        attribution = PullRequestAttribution.objects.get(pull_request=pull_request)
        assert attribution.signal_type == PullRequestAttributionSignalType.SENTRY_APP
        assert attribution.signal_details is not None
        assert attribution.signal_details["run_id"] == MOCK_RUN_ID

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    def test_process_autofix_updates_pr_attribution_disabled(self, _mock_has_access):
        repo = self.create_repo(self.project, name="getsentry/sentry")

        # Feature flag off (default) — the attribution block must not run.
        with (
            override_options({"issues.record-seer-actions-as-activities": False}),
            patch.dict(
                "sentry.seer.entrypoints.operator.autofix_entrypoint_registry.registrations",
                {},
                clear=True,
            ),
        ):
            process_autofix_updates(
                event_type=SentryAppEventType.SEER_PR_CREATED,
                event_payload=self._pr_created_event_payload(),
                organization_id=self.organization.id,
            )

        assert not PullRequest.objects.filter(repository_id=repo.id).exists()
        assert not PullRequestAttribution.objects.exists()

    def test_process_autofix_updates_no_operator_access(self) -> None:
        mock_entrypoint_cls = Mock(spec=SeerAutofixEntrypoint)
        event_type = SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED
        event_payload = {"run_id": MOCK_RUN_ID, "group_id": self.group.id}

        with (
            patch.object(SeerAutofixOperator, "has_access", return_value=False),
            patch.dict(
                "sentry.seer.entrypoints.operator.autofix_entrypoint_registry.registrations",
                {MockAutofixEntrypoint.key: mock_entrypoint_cls},
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

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    @patch("sentry.seer.entrypoints.cache.SeerOperatorAutofixCache.get")
    def test_process_autofix_updates_skips_entrypoint_without_access(
        self, mock_autofix_cache_get, _mock_has_access
    ):
        cache_payload = self.entrypoint.create_autofix_cache_payload()
        mock_autofix_cache_get.side_effect = lambda **kwargs: SeerOperatorCacheResult(
            payload=cache_payload, source="run_id", key="abc"
        )
        mock_no_access_cls = Mock(spec=SeerAutofixEntrypoint)
        mock_no_access_cls.has_access.return_value = False
        mock_has_access_cls = Mock(spec=SeerAutofixEntrypoint)
        mock_has_access_cls.has_access.return_value = True
        event_type = SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED
        event_payload = {"run_id": MOCK_RUN_ID, "group_id": self.group.id}

        with patch.dict(
            "sentry.seer.entrypoints.operator.autofix_entrypoint_registry.registrations",
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

    def test_can_trigger_autofix_returns_false_without_seer_access(self) -> None:
        assert SeerAutofixOperator.can_trigger_autofix(group=self.group) is False

    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    def test_can_trigger_autofix_returns_true_when_all_conditions_met(self, mock_quota):
        with self.feature(
            {
                "organizations:gen-ai-features": True,
            }
        ):
            assert SeerAutofixOperator.can_trigger_autofix(group=self.group) is True

    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    def test_can_trigger_autofix_returns_false_for_ineligible_category(self, mock_quota):
        from sentry.issues.grouptype import FeedbackGroup

        feedback_group = self.create_group(project=self.project, type=FeedbackGroup.type_id)
        with self.feature(
            {
                "organizations:gen-ai-features": True,
            }
        ):
            assert SeerAutofixOperator.can_trigger_autofix(group=feedback_group) is False

    @patch("sentry.quotas.backend.check_seer_quota", return_value=False)
    def test_can_trigger_autofix_returns_false_without_quota(self, mock_quota):
        with self.feature(
            {
                "organizations:gen-ai-features": True,
            }
        ):
            assert SeerAutofixOperator.can_trigger_autofix(group=self.group) is False

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    def test_seer_event_creates_activity_rca_completed(self, _mock_has_access):
        event_payload = {
            "run_id": MOCK_RUN_ID,
            "group_id": self.group.id,
            "root_cause": {
                "one_line_description": "Test root cause summary",
                "five_whys": ["why1", "why2"],
                "reproduction_steps": ["step1"],
                "relevant_repo": "getsentry/sentry",
            },
        }

        process_autofix_updates(
            event_type=SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
            event_payload=event_payload,
            organization_id=self.organization.id,
        )

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.SEER_RCA_COMPLETED.value
        )
        assert activity.data["run_id"] == MOCK_RUN_ID
        assert activity.data["summary"] == "Test root cause summary"
        assert "root_cause" not in activity.data
        assert "five_whys" not in activity.data

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    def test_seer_event_creates_activity_solution_completed(self, _mock_has_access):
        event_payload = {
            "run_id": MOCK_RUN_ID,
            "group_id": self.group.id,
            "solution": {
                "one_line_summary": "Test solution summary",
                "steps": [{"title": "Fix the bug", "description": "Change X to Y"}],
            },
        }

        process_autofix_updates(
            event_type=SentryAppEventType.SEER_SOLUTION_COMPLETED,
            event_payload=event_payload,
            organization_id=self.organization.id,
        )

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.SEER_SOLUTION_COMPLETED.value
        )
        assert activity.data["run_id"] == MOCK_RUN_ID
        assert activity.data["summary"] == "Test solution summary"
        assert "solution" not in activity.data
        assert "steps" not in activity.data

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    def test_seer_event_creates_activity_coding_completed(self, _mock_has_access):
        event_payload = {
            "run_id": MOCK_RUN_ID,
            "group_id": self.group.id,
            "code_changes": {"getsentry/sentry": [{"diff": "...", "path": "foo.py"}]},
        }

        process_autofix_updates(
            event_type=SentryAppEventType.SEER_CODING_COMPLETED,
            event_payload=event_payload,
            organization_id=self.organization.id,
        )

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.SEER_CODING_COMPLETED.value
        )
        assert activity.data["run_id"] == MOCK_RUN_ID
        assert "changes" not in activity.data
        assert "code_changes" not in activity.data

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    def test_create_seer_activity_all_mapped_event_types(self, _mock_has_access):
        for seer_event, expected_activity_type in SEER_EVENT_TO_ACTIVITY_TYPE.items():
            event_payload = {"run_id": MOCK_RUN_ID, "group_id": self.group.id}
            process_autofix_updates(
                event_type=seer_event,
                event_payload=event_payload,
                organization_id=self.organization.id,
            )
            assert Activity.objects.filter(
                group=self.group, type=expected_activity_type.value
            ).exists(), f"Activity not created for {seer_event}"

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    def test_create_seer_activity_skips_non_seer_events(self, _mock_has_access):
        event_payload = {"run_id": MOCK_RUN_ID, "group_id": self.group.id}

        process_autofix_updates(
            event_type=SentryAppEventType.ISSUE_CREATED,
            event_payload=event_payload,
            organization_id=self.organization.id,
        )

        seer_type_values = [t.value for t in SEER_EVENT_TO_ACTIVITY_TYPE.values()]
        assert not Activity.objects.filter(group=self.group, type__in=seer_type_values).exists()

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    def test_create_seer_activity_option_disabled(self, _mock_has_access):
        event_payload = {"run_id": MOCK_RUN_ID, "group_id": self.group.id}

        with override_options({"issues.record-seer-actions-as-activities": False}):
            process_autofix_updates(
                event_type=SentryAppEventType.SEER_ROOT_CAUSE_STARTED,
                event_payload=event_payload,
                organization_id=self.organization.id,
            )

        seer_type_values = [t.value for t in SEER_EVENT_TO_ACTIVITY_TYPE.values()]
        assert not Activity.objects.filter(group=self.group, type__in=seer_type_values).exists()

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    def test_create_seer_activity_pr_created_with_pull_requests(self, _mock_has_access):
        event_payload = {
            "run_id": MOCK_RUN_ID,
            "group_id": self.group.id,
            "pull_requests": [
                {
                    "pull_request": {
                        "pr_number": 42,
                        "pr_url": "https://github.com/owner/repo/pull/42",
                    },
                    "repo_name": "owner/repo",
                    "provider": "github",
                }
            ],
        }

        process_autofix_updates(
            event_type=SentryAppEventType.SEER_PR_CREATED,
            event_payload=event_payload,
            organization_id=self.organization.id,
        )

        activity = Activity.objects.get(group=self.group, type=ActivityType.SEER_PR_CREATED.value)
        assert activity.data["pull_requests"][0]["repo_name"] == "owner/repo"
        assert (
            activity.data["pull_requests"][0]["pull_request"]["pr_url"]
            == "https://github.com/owner/repo/pull/42"
        )

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    def test_create_seer_activity_iteration_completed(self, _mock_has_access):
        event_payload = {
            "run_id": MOCK_RUN_ID,
            "group_id": self.group.id,
            "code_changes": {"owner/repo": [{"diff": "...", "path": "foo.py"}]},
            "pull_requests": [
                {
                    "pull_request": {
                        "pr_number": 42,
                        "pr_url": "https://github.com/owner/repo/pull/42",
                    },
                    "repo_name": "owner/repo",
                    "provider": "github",
                }
            ],
        }

        process_autofix_updates(
            event_type=SentryAppEventType.SEER_ITERATION_COMPLETED,
            event_payload=event_payload,
            organization_id=self.organization.id,
        )

        activity = Activity.objects.get(
            group=self.group, type=ActivityType.SEER_ITERATION_COMPLETED.value
        )
        assert activity.data["pull_requests"][0]["repo_name"] == "owner/repo"
        assert activity.data["code_changes"]["owner/repo"][0]["path"] == "foo.py"

    @patch("sentry.models.activity.invoke_workflow_activity_handlers")
    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    def test_create_seer_activity_invokes_workflow_activity_handlers(
        self, _mock_has_access, mock_invoke
    ):
        event_payload = {"run_id": MOCK_RUN_ID, "group_id": self.group.id}

        process_autofix_updates(
            event_type=SentryAppEventType.SEER_ROOT_CAUSE_STARTED,
            event_payload=event_payload,
            organization_id=self.organization.id,
        )

        mock_invoke.assert_called_once()
        group, activity = mock_invoke.call_args[0][:2]
        assert group == self.group
        assert activity.type == ActivityType.SEER_RCA_STARTED.value


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

    def test_no_blocks_returns_none(self) -> None:
        state = self._make_state(blocks=[])
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is None

    def test_blocks_with_no_metadata_returns_none(self) -> None:
        block = MemoryBlock(
            id="1",
            message=Message(role="assistant", metadata=None),
            timestamp="2024-01-01T00:00:00Z",
        )
        state = self._make_state(blocks=[block])
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is None

    def test_blocks_with_metadata_but_no_step_key_returns_none(self) -> None:
        block = MemoryBlock(
            id="1",
            message=Message(role="assistant", metadata={"other": "value"}),
            timestamp="2024-01-01T00:00:00Z",
        )
        state = self._make_state(blocks=[block])
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is None

    def test_block_with_invalid_step_value_returns_none(self) -> None:
        block = MemoryBlock(
            id="1",
            message=Message(role="assistant", metadata={"step": "not_a_real_step"}),
            timestamp="2024-01-01T00:00:00Z",
        )
        state = self._make_state(blocks=[block])
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is None

    def test_matching_last_block_processing_returns_false(self) -> None:
        block = self._make_block("root_cause")
        state = self._make_state(blocks=[block], status="processing")
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is False

    def test_matching_last_block_completed_returns_true(self) -> None:
        block = self._make_block("root_cause")
        state = self._make_state(blocks=[block], status="completed")
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is True

    def test_matching_last_block_error_returns_true(self) -> None:
        block = self._make_block("root_cause")
        state = self._make_state(blocks=[block], status="error")
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is True

    def test_matching_block_not_last_returns_true(self) -> None:
        root_cause_block = self._make_block("root_cause", block_id="1")
        solution_block = self._make_block("solution", block_id="2")
        state = self._make_state(blocks=[root_cause_block, solution_block], status="processing")
        # root_cause is not the last block, so it's already completed
        assert get_autofix_explorer_status(AutofixStoppingPoint.ROOT_CAUSE, state) is True

    def test_open_pr_no_repo_pr_states_returns_false(self) -> None:
        block = self._make_block("code_changes")
        state = self._make_state(blocks=[block], repo_pr_states={})
        assert get_autofix_explorer_status(AutofixStoppingPoint.OPEN_PR, state) is None

    def test_open_pr_all_prs_completed_returns_true(self) -> None:
        block = self._make_block("code_changes")
        pr_states = {
            "repo1": RepoPRState(repo_name="repo1", pr_creation_status="completed"),
            "repo2": RepoPRState(repo_name="repo2", pr_creation_status="completed"),
        }
        state = self._make_state(blocks=[block], repo_pr_states=pr_states)
        assert get_autofix_explorer_status(AutofixStoppingPoint.OPEN_PR, state) is True

    def test_open_pr_some_prs_still_creating_returns_false(self) -> None:
        block = self._make_block("code_changes")
        pr_states = {
            "repo1": RepoPRState(repo_name="repo1", pr_creation_status="completed"),
            "repo2": RepoPRState(repo_name="repo2", pr_creation_status="creating"),
        }
        state = self._make_state(blocks=[block], repo_pr_states=pr_states)
        assert get_autofix_explorer_status(AutofixStoppingPoint.OPEN_PR, state) is False

    def test_multiple_stopping_points(self) -> None:
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


class MockAgentEntrypoint(SeerAgentEntrypoint[MockCachePayload]):
    """Mock agent entrypoint for testing."""

    key = cast(SeerEntrypointKey, "MOCK_AGENT")

    def __init__(self):
        self.thread_id = str(uuid.uuid4())
        self.agent_errors: list[str] = []
        self.agent_run_ids: list[int] = []

    @staticmethod
    def has_access(organization: Organization | RpcOrganization) -> bool:
        return True

    def on_trigger_agent_error(self, *, error: str) -> None:
        self.agent_errors.append(error)

    def on_trigger_agent_success(self, *, run_id: int) -> None:
        self.agent_run_ids.append(run_id)

    def create_agent_cache_payload(self) -> MockCachePayload:
        return {"thread_id": self.thread_id}

    @staticmethod
    def on_agent_update(cache_payload: MockCachePayload, summary: str | None, run_id: int) -> None:
        return None


class TestSeerAgentOperatorAccess(TestCase):
    def setUp(self) -> None:
        self.entrypoint = MockAgentEntrypoint()
        self.operator = SeerAgentOperator(self.entrypoint)

    def test_has_access_with_seer_agent(self):
        MockNoAccessEntrypoint = Mock(spec=SeerAgentEntrypoint)
        MockNoAccessEntrypoint.key = cast(SeerEntrypointKey, "MOCK_NO_ACCESS")
        MockNoAccessEntrypoint.has_access.return_value = False
        with (
            self.feature(
                {
                    "organizations:gen-ai-features": True,
                    "organizations:seer-explorer": True,
                }
            ),
            patch.dict(
                "sentry.seer.entrypoints.operator.agent_entrypoint_registry.registrations",
                {
                    MockAgentEntrypoint.key: MockAgentEntrypoint,
                    MockNoAccessEntrypoint.key: MockNoAccessEntrypoint,
                },
                clear=True,
            ),
        ):
            assert SeerAgentOperator.has_access(organization=self.organization)
            assert SeerAgentOperator.has_access(
                organization=self.organization,
                entrypoint_key=MockAgentEntrypoint.key,
            )
            assert not SeerAgentOperator.has_access(
                organization=self.organization,
                entrypoint_key=MockNoAccessEntrypoint.key,
            )

    def test_has_access_without_seer_agent(self):
        with self.feature({"organizations:gen-ai-features": False}):
            assert not SeerAgentOperator.has_access(organization=self.organization)


class TestSeerOperatorCompletionHook(TestCase):
    def _make_state(self, blocks: list[MemoryBlock], status: str = "completed") -> SeerRunState:
        return SeerRunState(
            run_id=MOCK_RUN_ID,
            blocks=blocks,
            status=status,
            updated_at="2024-01-01T00:00:00Z",
        )

    _SENTINEL = object()

    def _execute_with_mock_entrypoint(
        self,
        mock_fetch: Mock,
        state: SeerRunState,
        *,
        cache_return_value: dict | None | object = _SENTINEL,
        registrations: dict | None = None,
    ) -> Mock:
        """Execute the hook with a standard mock entrypoint setup.

        Returns the mock entrypoint class so callers can assert on it.
        """
        if cache_return_value is self._SENTINEL:
            cache_return_value = {"thread_id": "abc", "organization_id": self.organization.id}

        mock_fetch.return_value = state
        mock_entrypoint_cls = Mock(spec=SeerAgentEntrypoint)
        mock_entrypoint_cls.has_access.return_value = True

        if registrations is None:
            registrations = {MockAgentEntrypoint.key: mock_entrypoint_cls}

        with (
            patch.dict(
                "sentry.seer.entrypoints.operator.agent_entrypoint_registry.registrations",
                registrations,
                clear=True,
            ),
            patch(
                "sentry.seer.entrypoints.operator.SeerOperatorAgentCache.get",
                return_value=cache_return_value,
            ),
            patch(
                "sentry.seer.entrypoints.operator.SeerAgentOperator.has_access",
                return_value=True,
            ),
        ):
            SeerOperatorCompletionHook.execute(self.organization, MOCK_RUN_ID)

        return mock_entrypoint_cls

    @patch("sentry.seer.entrypoints.operator.fetch_run_status")
    def test_execute_fetches_summary_from_last_assistant_block(self, mock_fetch):
        state = self._make_state(
            blocks=[
                MemoryBlock(
                    id="2",
                    message=Message(role="assistant", content="first assistant"),
                    timestamp="2024-01-01T00:00:01Z",
                ),
                MemoryBlock(
                    id="3",
                    message=Message(role="assistant", content="last assistant"),
                    timestamp="2024-01-01T00:00:02Z",
                ),
                MemoryBlock(
                    id="2",
                    message=Message(role="user", content="user message"),
                    timestamp="2024-01-01T00:00:01Z",
                ),
            ]
        )
        mock_entrypoint_cls = self._execute_with_mock_entrypoint(mock_fetch, state)

        mock_entrypoint_cls.on_agent_update.assert_called_once_with(
            cache_payload={"thread_id": "abc", "organization_id": self.organization.id},
            summary="last assistant",
            run_id=MOCK_RUN_ID,
        )

    @patch("sentry.seer.entrypoints.operator.fetch_run_status")
    def test_execute_uses_default_summary_when_no_assistant_content(self, mock_fetch):
        state = self._make_state(
            blocks=[
                MemoryBlock(
                    id="1",
                    message=Message(role="user", content="hello"),
                    timestamp="2024-01-01T00:00:00Z",
                ),
                MemoryBlock(
                    id="2",
                    message=Message(role="assistant", content=None),
                    timestamp="2024-01-01T00:00:01Z",
                ),
            ]
        )
        mock_entrypoint_cls = self._execute_with_mock_entrypoint(mock_fetch, state)

        mock_entrypoint_cls.on_agent_update.assert_called_once_with(
            cache_payload={"thread_id": "abc", "organization_id": self.organization.id},
            summary=None,
            run_id=MOCK_RUN_ID,
        )

    @patch("sentry.seer.entrypoints.operator.SeerAgentOperator.has_access", return_value=True)
    @patch("sentry.seer.entrypoints.operator.fetch_run_status")
    def test_execute_returns_early_on_fetch_error(self, mock_fetch, _mock_access):
        mock_fetch.side_effect = Exception("Seer is down")
        mock_entrypoint_cls = Mock(spec=SeerAgentEntrypoint)

        with patch.dict(
            "sentry.seer.entrypoints.operator.agent_entrypoint_registry.registrations",
            {MockAgentEntrypoint.key: mock_entrypoint_cls},
            clear=True,
        ):
            SeerOperatorCompletionHook.execute(self.organization, MOCK_RUN_ID)

        mock_entrypoint_cls.on_agent_update.assert_not_called()

    @patch("sentry.seer.entrypoints.operator.SeerAgentOperator.has_access", return_value=True)
    @patch("sentry.seer.entrypoints.operator.fetch_run_status")
    def test_execute_skips_entrypoint_without_access(self, mock_fetch, _mock_access):
        state = self._make_state(
            blocks=[
                MemoryBlock(
                    id="1",
                    message=Message(role="assistant", content="summary"),
                    timestamp="2024-01-01T00:00:00Z",
                ),
            ]
        )
        mock_fetch.return_value = state
        mock_no_access = Mock(spec=SeerAgentEntrypoint)
        mock_no_access.has_access.return_value = False
        mock_has_access = Mock(spec=SeerAgentEntrypoint)
        mock_has_access.has_access.return_value = True
        cache_payload = {"thread_id": "abc", "organization_id": self.organization.id}

        with (
            patch.dict(
                "sentry.seer.entrypoints.operator.agent_entrypoint_registry.registrations",
                {
                    cast(SeerEntrypointKey, "NO_ACCESS"): mock_no_access,
                    cast(SeerEntrypointKey, "HAS_ACCESS"): mock_has_access,
                },
                clear=True,
            ),
            patch(
                "sentry.seer.entrypoints.operator.SeerOperatorAgentCache.get",
                return_value=cache_payload,
            ),
        ):
            SeerOperatorCompletionHook.execute(self.organization, MOCK_RUN_ID)

        mock_no_access.on_agent_update.assert_not_called()
        mock_has_access.on_agent_update.assert_called_once_with(
            cache_payload=cache_payload,
            summary="summary",
            run_id=MOCK_RUN_ID,
        )

    @patch("sentry.seer.entrypoints.operator.fetch_run_status")
    def test_execute_skips_entrypoint_without_cache(self, mock_fetch):
        state = self._make_state(
            blocks=[
                MemoryBlock(
                    id="1",
                    message=Message(role="assistant", content="summary"),
                    timestamp="2024-01-01T00:00:00Z",
                ),
            ]
        )
        mock_entrypoint_cls = self._execute_with_mock_entrypoint(
            mock_fetch, state, cache_return_value=None
        )

        mock_entrypoint_cls.on_agent_update.assert_not_called()

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.seer.entrypoints.operator.fetch_run_status")
    def test_execute_records_failure_on_org_mismatch(self, mock_fetch, mock_record):
        state = self._make_state(
            blocks=[
                MemoryBlock(
                    id="1",
                    message=Message(role="assistant", content="summary"),
                    timestamp="2024-01-01T00:00:00Z",
                ),
            ]
        )
        other_org = self.create_organization()
        mock_entrypoint_cls = self._execute_with_mock_entrypoint(
            mock_fetch,
            state,
            cache_return_value={"thread_id": "abc", "organization_id": other_org.id},
        )

        mock_entrypoint_cls.on_agent_update.assert_not_called()
        assert_failure_metric(mock_record, "org_mismatch")

    @patch("sentry.seer.entrypoints.operator.fetch_run_status")
    def test_execute_with_empty_blocks(self, mock_fetch):
        state = self._make_state(blocks=[])
        mock_entrypoint_cls = self._execute_with_mock_entrypoint(mock_fetch, state)

        mock_entrypoint_cls.on_agent_update.assert_called_once_with(
            cache_payload={"thread_id": "abc", "organization_id": self.organization.id},
            summary=None,
            run_id=MOCK_RUN_ID,
        )


class TestSeerAgentOperatorCodeMode(TestCase):
    def setUp(self) -> None:
        self.entrypoint = MockAgentEntrypoint()
        self.operator = SeerAgentOperator(self.entrypoint)

    @patch("sentry.seer.entrypoints.operator.SeerAgentClient")
    def test_slack_code_mode_enabled(self, mock_client_cls):
        mock_client = Mock()
        mock_client.get_runs.return_value = []
        mock_client.start_run.return_value = Mock(seer_run_state_id=1)
        mock_client_cls.return_value = mock_client

        with self.feature("organizations:seer-slack-code-mode"):
            self.operator.trigger_agent(
                organization=self.organization,
                user=self.user,
                prompt="hi",
                category_key="slack_thread",
                category_value="thread-123",
            )

        mock_client_cls.assert_called_once()
        assert mock_client_cls.call_args.kwargs["enable_code_mode_tools"] == "only"

    @patch("sentry.seer.entrypoints.operator.SeerAgentClient")
    def test_slack_code_mode_disabled(self, mock_client_cls):
        mock_client = Mock()
        mock_client.get_runs.return_value = []
        mock_client.start_run.return_value = Mock(seer_run_state_id=1)
        mock_client_cls.return_value = mock_client

        self.operator.trigger_agent(
            organization=self.organization,
            user=self.user,
            prompt="hi",
            category_key="slack_thread",
            category_value="thread-123",
        )

        mock_client_cls.assert_called_once()
        assert mock_client_cls.call_args.kwargs["enable_code_mode_tools"] == "off"

    @patch("sentry.seer.entrypoints.operator.SeerAgentClient")
    def test_non_slack_category_ignores_flag(self, mock_client_cls):
        mock_client = Mock()
        mock_client.get_runs.return_value = []
        mock_client.start_run.return_value = Mock(seer_run_state_id=1)
        mock_client_cls.return_value = mock_client

        with self.feature("organizations:seer-slack-code-mode"):
            self.operator.trigger_agent(
                organization=self.organization,
                user=self.user,
                prompt="hi",
                category_key="other_category",
                category_value="val-123",
            )

        mock_client_cls.assert_called_once()
        assert mock_client_cls.call_args.kwargs["enable_code_mode_tools"] == "off"
