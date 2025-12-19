import uuid
from typing import Any, TypedDict
from unittest.mock import ANY, Mock, patch

from rest_framework.response import Response

from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.operator import AUTOFIX_CACHE_TIMEOUT, SeerOperator
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.testutils.cases import TestCase


class MockCachePayload(TypedDict):
    thread_id: uuid.UUID


class MockEntrypoint(SeerEntrypoint[MockCachePayload]):
    """Mock entrypoint implementation for testing. Stores function calls similar to a mock."""

    key = SeerEntrypointKey.SLACK

    def __init__(self):
        self.thread_id = uuid.uuid4()
        self.autofix_errors = []
        self.autofix_run_ids = []
        self.autofix_update_cache_payloads = []

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


RUN_ID = 123


class SeerOperatorTest(TestCase):

    def setUp(self):
        self.entrypoint = MockEntrypoint()
        self.operator = SeerOperator(self.entrypoint)

    def _cache_get_side_effect(self, cache_key: str):
        if cache_key == SeerOperator.get_autofix_cache_key(
            entrypoint_key=self.entrypoint.key, run_id=RUN_ID
        ):
            return {"thread_id": self.entrypoint.thread_id}
        return None

    def test_get_autofix_cache_key(self):
        cache_key = SeerOperator.get_autofix_cache_key(
            entrypoint_key=self.entrypoint.key, run_id=RUN_ID
        )
        assert cache_key == f"seer:autofix:{self.entrypoint.key}:{RUN_ID}"

    @patch(
        "sentry.seer.entrypoints.operator.update_autofix",
        return_value=Response({"run_id": RUN_ID}, status=202),
    )
    @patch(
        "sentry.seer.entrypoints.operator._trigger_autofix",
        return_value=Response({"run_id": RUN_ID}, status=202),
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
            run_id=RUN_ID,
        )
        assert mock_trigger_autofix_helper.call_count == 0
        assert mock_update_autofix_helper.call_count == 1

    @patch(
        "sentry.seer.entrypoints.operator._trigger_autofix",
        return_value=Response({"run_id": RUN_ID}, status=202),
    )
    def test_trigger_autofix_success(self, mock_trigger_autofix_helper):
        self.operator.trigger_autofix(
            group=self.group, user=self.user, stopping_point=AutofixStoppingPoint.ROOT_CAUSE
        )
        assert mock_trigger_autofix_helper.call_count == 1
        assert self.entrypoint.autofix_errors == []
        assert self.entrypoint.autofix_run_ids == [RUN_ID]

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
            run_id=RUN_ID,
        )
        assert self.entrypoint.autofix_errors == [
            "Invalid request",
            "An unknown error has occurred",
            "Invalid stopping point provided",
        ]
        assert self.entrypoint.autofix_run_ids == []

    @patch(
        "sentry.seer.entrypoints.operator._trigger_autofix",
        return_value=Response({"run_id": RUN_ID}, status=202),
    )
    @patch("sentry.seer.entrypoints.operator.cache.set")
    def test_trigger_autofix_cache_payload(self, mock_cache_set, _mock_trigger_autofix_helper):
        mock_cache_set.reset_mock()
        self.operator.trigger_autofix(
            group=self.group, user=self.user, stopping_point=AutofixStoppingPoint.ROOT_CAUSE
        )
        mock_cache_set.assert_called_with(
            self.operator.get_autofix_cache_key(entrypoint_key=self.entrypoint.key, run_id=RUN_ID),
            self.entrypoint.create_autofix_cache_payload(),
            timeout=AUTOFIX_CACHE_TIMEOUT,
        )

    @patch("sentry.seer.entrypoints.operator.logger.info")
    def test_process_autofix_updates_ignore_non_seer_events(self, mock_logger_info):
        SeerOperator.process_autofix_updates(
            run_id=RUN_ID,
            event_type=SentryAppEventType.ISSUE_CREATED,
            event_payload={},
        )
        mock_logger_info.assert_called_once_with("operator.skipping_update", extra=ANY)

    @patch.dict(
        "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
        {MockEntrypoint.key: MockEntrypoint},
    )
    @patch("sentry.seer.entrypoints.operator.logger.info")
    @patch("sentry.seer.entrypoints.operator.cache.get", return_value=None)
    def test_process_autofix_updates_cache_miss(self, mock_cache_get, mock_logger_info):
        SeerOperator.process_autofix_updates(
            run_id=RUN_ID,
            event_type=SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
            event_payload={},
        )
        mock_cache_get.assert_called_once_with(
            SeerOperator.get_autofix_cache_key(entrypoint_key=self.entrypoint.key, run_id=RUN_ID),
        )
        mock_logger_info.assert_called_once_with("operator.no_cache_payload", extra=ANY)

    @patch("sentry.seer.entrypoints.operator.cache.get")
    def test_process_autofix_updates(self, mock_cache_get):
        # XXX: cache.get() is used everywhere, so side-effect to only affect our callsite
        mock_cache_get.side_effect = self._cache_get_side_effect
        mock_entrypoint_cls = Mock(spec=SeerEntrypoint)
        event_type = SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED
        event_payload = {"imagine": "this was typesafe"}

        with patch.dict(
            "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
            {MockEntrypoint.key: mock_entrypoint_cls},
        ):
            SeerOperator.process_autofix_updates(
                run_id=RUN_ID,
                event_type=event_type,
                event_payload=event_payload,
            )
            mock_cache_get.assert_called_once_with(
                SeerOperator.get_autofix_cache_key(
                    entrypoint_key=self.entrypoint.key, run_id=RUN_ID
                ),
            )
            mock_entrypoint_cls.on_autofix_update.assert_called_once_with(
                event_type=event_type,
                event_payload=event_payload,
                cache_payload=self.entrypoint.create_autofix_cache_payload(),
            )
