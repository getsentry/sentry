import uuid
from typing import Any, TypedDict
from unittest.mock import ANY, Mock, patch

import pytest
from rest_framework.response import Response

from fixtures.seer.webhooks import MOCK_GROUP_ID, MOCK_RUN_ID
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.operator import (
    AUTOFIX_CACHE_TIMEOUT_SECONDS,
    SeerOperator,
    process_autofix_updates,
)
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.testutils.cases import TestCase


class MockCachePayload(TypedDict):
    thread_id: str


class MockEntrypoint(SeerEntrypoint[MockCachePayload]):
    """Mock entrypoint implementation for testing. Stores function calls similar to a mock."""

    key = SeerEntrypointKey.SLACK

    def __init__(self):
        self.thread_id = str(uuid.uuid4())
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


class SeerOperatorTest(TestCase):
    def setUp(self):
        self.entrypoint = MockEntrypoint()
        self.operator = SeerOperator(self.entrypoint)
        self.pre_cache_key = SeerOperator.get_pre_autofix_cache_key(
            entrypoint_key=self.entrypoint.key, group_id=MOCK_GROUP_ID
        )
        self.post_cache_key = SeerOperator.get_post_autofix_cache_key(
            entrypoint_key=self.entrypoint.key, run_id=MOCK_RUN_ID
        )

    def test_get_pre_autofix_cache_key(self):
        assert self.pre_cache_key == f"seer:pre_autofix:{self.entrypoint.key}:{MOCK_GROUP_ID}"

    def test_get_post_autofix_cache_key(self):
        assert self.post_cache_key == f"seer:post_autofix:{self.entrypoint.key}:{MOCK_RUN_ID}"

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
    @patch("sentry.seer.entrypoints.operator.cache.set")
    def test_trigger_autofix_creates_cache_payload(
        self, mock_cache_set, _mock_trigger_autofix_helper
    ):
        self.operator.trigger_autofix(
            group=self.group, user=self.user, stopping_point=AutofixStoppingPoint.ROOT_CAUSE
        )
        mock_cache_set.assert_called_with(
            self.post_cache_key,
            self.entrypoint.create_autofix_cache_payload(),
            timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS,
        )

    @patch("sentry.seer.entrypoints.operator.cache.set")
    def test_populate_autofix_cache_group_id(self, mock_cache_set):
        pre_cache_payload = MockCachePayload(thread_id="pre_cache_payload")
        self.operator.populate_autofix_cache(
            entrypoint_key=self.entrypoint.key,
            cache_payload=pre_cache_payload,
            group_id=MOCK_GROUP_ID,
        )
        mock_cache_set.assert_called_once_with(
            self.pre_cache_key,
            pre_cache_payload,
            timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS,
        )

    @patch("sentry.seer.entrypoints.operator.cache.set")
    def test_populate_autofix_cache_run_id(self, mock_cache_set):
        post_cache_payload = MockCachePayload(thread_id="post_cache_payload")
        self.operator.populate_autofix_cache(
            entrypoint_key=self.entrypoint.key,
            cache_payload=post_cache_payload,
            run_id=MOCK_RUN_ID,
        )
        mock_cache_set.assert_called_once_with(
            self.post_cache_key,
            post_cache_payload,
            timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS,
        )

    @patch("sentry.seer.entrypoints.operator.cache.set")
    def test_populate_autofix_cache_both(self, mock_cache_set):
        with pytest.raises(
            ValueError, match="Either group_id or run_id must be provided, but not both."
        ):
            SeerOperator.populate_autofix_cache(
                entrypoint_key=self.entrypoint.key,
                cache_payload=self.entrypoint.create_autofix_cache_payload(),
                group_id=MOCK_GROUP_ID,
                run_id=MOCK_RUN_ID,
            )
        mock_cache_set.assert_not_called()

    @patch.dict(
        "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
        {MockEntrypoint.key: MockEntrypoint},
    )
    @patch("sentry.seer.entrypoints.operator.cache.set")
    @patch("sentry.seer.entrypoints.operator.cache.get")
    def test_migrate_autofix_cache(self, mock_cache_get, mock_cache_set):
        pre_cache_payload = MockCachePayload(thread_id="pre_cache_payload")
        mock_cache_get.side_effect = lambda k: (
            pre_cache_payload if k == self.pre_cache_key else None
        )
        SeerOperator.migrate_autofix_cache(group_id=MOCK_GROUP_ID, run_id=MOCK_RUN_ID)
        mock_cache_set.assert_called_once_with(
            self.post_cache_key,
            pre_cache_payload,
            timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS,
        )

    @patch.dict(
        "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
        {MockEntrypoint.key: MockEntrypoint},
    )
    @patch("sentry.seer.entrypoints.operator.cache.set")
    @patch("sentry.seer.entrypoints.operator.cache.get")
    def test_migrate_autofix_cache_full_miss(self, mock_cache_get, mock_cache_set):
        mock_cache_get.side_effect = lambda k: None
        SeerOperator.migrate_autofix_cache(group_id=MOCK_GROUP_ID, run_id=MOCK_RUN_ID)
        mock_cache_set.assert_not_called()

    @patch.dict(
        "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
        {MockEntrypoint.key: MockEntrypoint},
    )
    @patch("sentry.seer.entrypoints.operator.cache.set")
    @patch("sentry.seer.entrypoints.operator.cache.get")
    def test_migrate_autofix_cache_overwrite(self, mock_cache_get, mock_cache_set):
        pre_cache_payload = MockCachePayload(thread_id="pre_cache_payload")
        post_cache_payload = MockCachePayload(thread_id="post_cache_payload")
        mock_cache_get.side_effect = lambda k: (
            post_cache_payload if k == self.post_cache_key else pre_cache_payload
        )
        # No overwrite by default
        SeerOperator.migrate_autofix_cache(group_id=MOCK_GROUP_ID, run_id=MOCK_RUN_ID)
        mock_cache_set.assert_not_called()
        # With overwrite, the post cache should be set
        SeerOperator.migrate_autofix_cache(
            group_id=MOCK_GROUP_ID, run_id=MOCK_RUN_ID, overwrite=True
        )
        mock_cache_set.assert_called_once_with(
            self.post_cache_key,
            pre_cache_payload,
            timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS,
        )

    @patch.dict(
        "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
        {MockEntrypoint.key: MockEntrypoint},
    )
    @patch("sentry.seer.entrypoints.operator.logger")
    def test_process_autofix_updates_early_exits(self, mock_logger):
        process_autofix_updates(
            event_type=SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
            event_payload={},
        )
        mock_logger.warning.assert_called_once_with("operator.missing_identifiers", extra=ANY)

        process_autofix_updates(
            event_type=SentryAppEventType.ISSUE_CREATED,
            event_payload={"run_id": MOCK_RUN_ID},
        )
        mock_logger.info.assert_called_once_with("operator.skipping_update", extra=ANY)

    @patch("sentry.seer.entrypoints.operator.cache.get")
    def test_process_autofix_updates_all_cache_hit(self, mock_cache_get):
        pre_cache_payload = MockCachePayload(thread_id="pre_cache_payload")
        post_cache_payload = MockCachePayload(thread_id="post_cache_payload")
        mock_cache_get.side_effect = lambda k: (
            post_cache_payload if k == self.post_cache_key else pre_cache_payload
        )
        mock_entrypoint_cls = Mock(spec=SeerEntrypoint)
        event_type = SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED
        event_payload = {"run_id": MOCK_RUN_ID, "group_id": MOCK_GROUP_ID}

        with patch.dict(
            "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
            {MockEntrypoint.key: mock_entrypoint_cls},
        ):
            process_autofix_updates(event_type=event_type, event_payload=event_payload)

        mock_entrypoint_cls.on_autofix_update.assert_called_once_with(
            event_type=event_type,
            event_payload=event_payload,
            # If both caches are hit, post should be used
            cache_payload=post_cache_payload,
        )

    @patch("sentry.seer.entrypoints.operator.logger")
    @patch("sentry.seer.entrypoints.operator.cache.get")
    def test_process_autofix_updates_all_cache_miss(self, mock_cache_get, mock_logger):
        mock_cache_get.side_effect = lambda k: None
        mock_entrypoint_cls = Mock(spec=SeerEntrypoint)
        event_type = SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED
        event_payload = {"run_id": MOCK_RUN_ID, "group_id": MOCK_GROUP_ID}

        with patch.dict(
            "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
            {MockEntrypoint.key: mock_entrypoint_cls},
        ):
            process_autofix_updates(event_type=event_type, event_payload=event_payload)

        mock_entrypoint_cls.on_autofix_update.assert_not_called()
        mock_logger.info.assert_called_once_with("operator.no_cache_payload", extra=ANY)

    @patch("sentry.seer.entrypoints.operator.cache.get")
    def test_process_autofix_updates_pre_cache_hit(self, mock_cache_get):
        pre_cache_payload = MockCachePayload(thread_id="pre_cache_payload")
        mock_cache_get.side_effect = lambda k: (
            pre_cache_payload if k == self.pre_cache_key else None
        )
        mock_entrypoint_cls = Mock(spec=SeerEntrypoint)
        event_type = SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED
        event_payload = {"run_id": MOCK_RUN_ID, "group_id": MOCK_GROUP_ID}

        with patch.dict(
            "sentry.seer.entrypoints.operator.entrypoint_registry.registrations",
            {MockEntrypoint.key: mock_entrypoint_cls},
        ):
            process_autofix_updates(event_type=event_type, event_payload=event_payload)

        mock_entrypoint_cls.on_autofix_update.assert_called_once_with(
            event_type=event_type,
            event_payload=event_payload,
            cache_payload=pre_cache_payload,
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
