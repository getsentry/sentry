import uuid
from typing import Any, TypedDict, cast
from unittest.mock import ANY, Mock, patch

from rest_framework.response import Response

from fixtures.seer.webhooks import MOCK_RUN_ID
from sentry.models.organization import Organization
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.operator import SeerOperator, process_autofix_updates
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey, SeerOperatorCacheResult
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

    @staticmethod
    def has_access(organization: Organization) -> bool:
        return True

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
                organization=self.group.project.organization, entrypoint_key=MockEntrypoint.key
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
        "sentry.seer.entrypoints.operator._trigger_autofix",
        return_value=Response({"run_id": MOCK_RUN_ID}, status=202),
    )
    def test_trigger_autofix_pathway(self, mock_trigger_autofix_helper, mock_update_autofix_helper):
        self.operator.trigger_autofix(
            group=self.group, user=self.user, stopping_point=AutofixStoppingPoint.ROOT_CAUSE
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
        "sentry.seer.entrypoints.operator._trigger_autofix",
        return_value=Response({"run_id": MOCK_RUN_ID}, status=202),
    )
    def test_trigger_autofix_success(self, mock_trigger_autofix_helper):
        self.operator.trigger_autofix(
            group=self.group, user=self.user, stopping_point=AutofixStoppingPoint.ROOT_CAUSE
        )
        assert mock_trigger_autofix_helper.call_count == 1
        assert self.entrypoint.autofix_errors == []
        assert self.entrypoint.autofix_run_ids == [MOCK_RUN_ID]

    @patch("sentry.seer.entrypoints.operator._trigger_autofix")
    def test_trigger_autofix_error(self, mock_trigger_autofix_helper):
        mock_trigger_autofix_helper.return_value = Response(
            {"detail": "Invalid request"}, status=400
        )
        self.operator.trigger_autofix(
            group=self.group, user=self.user, stopping_point=AutofixStoppingPoint.ROOT_CAUSE
        )
        mock_trigger_autofix_helper.return_value = Response({"run_id": None}, status=202)
        self.operator.trigger_autofix(
            group=self.group, user=self.user, stopping_point=AutofixStoppingPoint.ROOT_CAUSE
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
        "sentry.seer.entrypoints.operator._trigger_autofix",
        return_value=Response({"run_id": MOCK_RUN_ID}, status=202),
    )
    @patch("sentry.seer.entrypoints.cache.SeerOperatorAutofixCache.populate_post_autofix_cache")
    def test_trigger_autofix_creates_cache_payload(
        self, mock_populate_post_autofix_cache, _mock_trigger_autofix_helper
    ):
        self.operator.trigger_autofix(
            group=self.group, user=self.user, stopping_point=AutofixStoppingPoint.ROOT_CAUSE
        )
        mock_populate_post_autofix_cache.assert_called_with(
            entrypoint_key=MockEntrypoint.key,
            run_id=MOCK_RUN_ID,
            cache_payload=self.entrypoint.create_autofix_cache_payload(),
        )

    @patch.dict(
        "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
        {MockEntrypoint.key: MockEntrypoint},
        clear=True,
    )
    @patch("sentry.seer.entrypoints.operator.logger")
    def test_process_autofix_updates_early_exits(self, mock_logger):
        process_autofix_updates(
            event_type=SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
            event_payload={},
            organization_id=self.organization.id,
        )
        mock_logger.error.assert_called_once_with(
            "seer.operator.process_updates.missing_identifiers", extra=ANY
        )

        mock_logger.reset_mock()
        process_autofix_updates(
            event_type=SentryAppEventType.ISSUE_CREATED,
            event_payload={"run_id": MOCK_RUN_ID, "group_id": self.group.id},
            organization_id=self.organization.id,
        )
        mock_logger.info.assert_called_once_with("seer.operator.process_updates.skipped", extra=ANY)

        mock_logger.reset_mock()
        process_autofix_updates(
            event_type=SentryAppEventType.SEER_ROOT_CAUSE_STARTED,
            event_payload={"run_id": MOCK_RUN_ID, "group_id": -1},
            organization_id=self.organization.id,
        )
        mock_logger.error.assert_called_once_with(
            "seer.operator.process_updates.group_not_found", extra=ANY
        )

        mock_logger.reset_mock()
        process_autofix_updates(
            event_type=SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
            event_payload={"run_id": MOCK_RUN_ID, "group_id": self.group.id},
            organization_id=self.organization.id,
        )
        mock_logger.info.assert_called_with("seer.operator.process_updates.cache_miss", extra=ANY)

    @patch("sentry.seer.entrypoints.cache.SeerOperatorAutofixCache.get")
    def test_process_autofix_updates(self, mock_autofix_cache_get):
        cache_payload = self.entrypoint.create_autofix_cache_payload()
        mock_autofix_cache_get.side_effect = lambda **kwargs: SeerOperatorCacheResult(
            payload=cache_payload, source="run_id", key="abc"
        )
        mock_entrypoint_cls = Mock(spec=SeerEntrypoint)
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

    @patch("sentry.seer.entrypoints.operator.update_autofix")
    def test_solution_stopping_point_continues_to_code_changes(self, mock_update_autofix):
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
        assert payload["stopping_point"] == "code_changes"
