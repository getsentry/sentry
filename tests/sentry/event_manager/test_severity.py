from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import MagicMock, patch

import orjson
from django.core.cache import cache
from django.test import override_settings
from urllib3 import HTTPResponse
from urllib3.exceptions import ConnectTimeoutError, MaxRetryError

from sentry.constants import PLACEHOLDER_EVENT_TITLES
from sentry.event_manager import (
    SEER_ERROR_COUNT_KEY,
    EventManager,
    _get_severity_score,
    severity_connection_pool,
)
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


def make_event(**kwargs) -> dict[str, Any]:
    result: dict[str, Any] = {
        "event_id": uuid.uuid1().hex,
    }
    result.update(kwargs)
    return result


class TestGetEventSeverity(TestCase):
    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        return_value=HTTPResponse(body=orjson.dumps({"severity": 0.1231})),
    )
    def test_error_event_simple(self, mock_urlopen: MagicMock) -> None:
        manager = EventManager(
            make_event(
                exception={
                    "values": [
                        {
                            "type": "NopeError",
                            "value": "Nopey McNopeface",
                            "mechanism": {"type": "generic", "handled": True},
                        }
                    ]
                },
                platform="python",
            )
        )
        event = manager.save(self.project.id)

        severity, reason = _get_severity_score(event)

        payload = {
            "message": "NopeError: Nopey McNopeface",
            "has_stacktrace": 0,
            "handled": True,
        }

        mock_urlopen.assert_called_with(
            "POST",
            "/v0/issues/severity-score?",
            body=orjson.dumps(payload),
            headers={"content-type": "application/json;charset=utf-8"},
            timeout=0.2,
        )
        assert severity == 0.1231
        assert reason == "ml"
        assert cache.get(SEER_ERROR_COUNT_KEY) == 0

        with (
            override_options({"seer.api.use-shared-secret": 1.0}),
            override_settings(SEER_API_SHARED_SECRET="some-secret"),
        ):
            _get_severity_score(event)
            mock_urlopen.assert_called_with(
                "POST",
                "/v0/issues/severity-score?",
                body=orjson.dumps(payload),
                headers={
                    "content-type": "application/json;charset=utf-8",
                    "Authorization": "Rpcsignature rpc0:8d982376e4e49ffe845ed39853f6f2cb9bf38564d2a8a325dcd88abba8c58564",
                },
                timeout=0.2,
            )

    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        return_value=HTTPResponse(body=orjson.dumps({"severity": 0.1231})),
    )
    def test_message_event_simple(
        self,
        mock_urlopen: MagicMock,
    ) -> None:
        cases: list[dict[str, Any]] = [
            {"message": "Dogs are great!"},
            {"logentry": {"formatted": "Dogs are great!"}},
            {"logentry": {"message": "Dogs are great!"}},
        ]
        for case in cases:
            manager = EventManager(make_event(**case))
            event = manager.save(self.project.id)

            severity, reason = _get_severity_score(event)

            payload = {
                "message": "Dogs are great!",
                "has_stacktrace": 0,
                "handled": None,
            }

            mock_urlopen.assert_called_with(
                "POST",
                "/v0/issues/severity-score?",
                body=orjson.dumps(payload),
                headers={"content-type": "application/json;charset=utf-8"},
                timeout=0.2,
            )
            assert severity == 0.1231
            assert reason == "ml"
            assert cache.get(SEER_ERROR_COUNT_KEY) == 0

    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        return_value=HTTPResponse(body=orjson.dumps({"severity": 0.1231})),
    )
    def test_uses_exception(
        self,
        mock_urlopen: MagicMock,
    ) -> None:
        manager = EventManager(
            make_event(
                exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]},
                platform="python",
            )
        )
        event = manager.save(self.project.id)
        # `title` is a property with no setter, but it pulls from `metadata`, so it's equivalent
        # to set it there. (We have to ignore mypy because `metadata` isn't supposed to be mutable.)
        event.get_event_metadata()["title"] = "Dogs are great!"  # type: ignore[index]

        _get_severity_score(event)

        assert (
            orjson.loads(mock_urlopen.call_args.kwargs["body"])["message"]
            == "NopeError: Nopey McNopeface"
        )

    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        return_value=HTTPResponse(body=orjson.dumps({"severity": 0.1231})),
    )
    def test_short_circuit_level(
        self,
        mock_urlopen: MagicMock,
    ) -> None:
        cases: list[tuple[str, float, str]] = [
            ("fatal", 1.0, "log_level_fatal"),
            ("info", 0.0, "log_level_info"),
            ("debug", 0.0, "log_level_info"),
            ("error", 0.1231, "ml"),
        ]

        for level, expected_severity, expected_reason in cases:
            manager = EventManager(
                make_event(
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]},
                    level=level,
                    platform="python",
                )
            )
            event = manager.save(self.project.id)
            severity, reason = _get_severity_score(event)

            assert severity == expected_severity
            assert reason == expected_reason

    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        return_value=HTTPResponse(body=orjson.dumps({"severity": 0.1231})),
    )
    @patch("sentry.event_manager.logger.warning")
    def test_unusable_event_title(
        self,
        mock_logger_warning: MagicMock,
        mock_urlopen: MagicMock,
    ) -> None:
        for title in PLACEHOLDER_EVENT_TITLES:
            manager = EventManager(make_event(exception={"values": []}, platform="python"))
            event = manager.save(self.project.id)
            # `title` is a property with no setter, but it pulls from `data`, so it's equivalent
            # to set it there
            event.data["title"] = title

            severity, reason = _get_severity_score(event)

            mock_urlopen.assert_not_called()
            mock_logger_warning.assert_called_with(
                "Unable to get severity score because of unusable `message` value '%s'",
                title,
                extra={
                    "event_id": event.event_id,
                    "op": "event_manager._get_severity_score",
                    "event_type": "default",
                    "title": title,
                },
            )
            assert severity == 0.0
            assert reason == "bad_title"

    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        side_effect=MaxRetryError(
            severity_connection_pool, "/issues/severity-score", Exception("It broke")
        ),
    )
    @patch("sentry.event_manager.metrics.incr")
    def test_max_retry_exception(
        self,
        mock_metrics_incr: MagicMock,
        _mock_urlopen: MagicMock,
    ) -> None:
        manager = EventManager(
            make_event(
                exception={
                    "values": [
                        {
                            "type": "NopeError",
                            "value": "Nopey McNopeface",
                            "mechanism": {"type": "generic", "handled": True},
                        }
                    ]
                },
                platform="python",
            )
        )
        event = manager.save(self.project.id)

        severity, reason = _get_severity_score(event)

        mock_metrics_incr.assert_called_with(
            "issues.severity.error", tags={"reason": "max_retries"}
        )
        assert severity == 1.0
        assert reason == "microservice_max_retry"
        assert cache.get(SEER_ERROR_COUNT_KEY) == 1

    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        side_effect=ConnectTimeoutError(),
    )
    @patch("sentry.event_manager.metrics.incr")
    def test_timeout_error(
        self,
        mock_metrics_incr: MagicMock,
        _mock_urlopen: MagicMock,
    ) -> None:
        manager = EventManager(
            make_event(
                exception={
                    "values": [
                        {
                            "type": "NopeError",
                            "value": "Nopey McNopeface",
                            "mechanism": {"type": "generic", "handled": True},
                        }
                    ]
                },
                platform="python",
            )
        )
        event = manager.save(self.project.id)

        severity, reason = _get_severity_score(event)

        mock_metrics_incr.assert_called_with("issues.severity.error", tags={"reason": "timeout"})
        assert severity == 1.0
        assert reason == "microservice_timeout"
        assert cache.get(SEER_ERROR_COUNT_KEY) == 1

    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        side_effect=Exception("It broke"),
    )
    @patch("sentry.event_manager.sentry_sdk.capture_exception")
    @patch("sentry.event_manager.metrics.incr")
    def test_other_exception(
        self,
        mock_metrics_incr: MagicMock,
        mock_capture_exception: MagicMock,
        _mock_urlopen: MagicMock,
    ) -> None:
        manager = EventManager(
            make_event(
                exception={
                    "values": [
                        {
                            "type": "NopeError",
                            "value": "Nopey McNopeface",
                            "mechanism": {"type": "generic", "handled": True},
                        }
                    ],
                },
                platform="python",
            )
        )
        event = manager.save(self.project.id)

        severity, reason = _get_severity_score(event)

        mock_capture_exception.assert_called_once_with()
        mock_metrics_incr.assert_called_with("issues.severity.error", tags={"reason": "unknown"})
        assert severity == 1.0
        assert reason == "microservice_error"
        assert cache.get(SEER_ERROR_COUNT_KEY) == 1


@apply_feature_flag_on_cls("projects:first-event-severity-calculation")
@apply_feature_flag_on_cls("organizations:seer-based-priority")
class TestEventManagerSeverity(TestCase):
    @patch("sentry.event_manager._get_severity_score", return_value=(0.1121, "ml"))
    def test_flag_on(self, mock_get_severity_score: MagicMock):
        manager = EventManager(
            make_event(
                exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]},
                platform="python",
            )
        )
        event = manager.save(self.project.id)

        mock_get_severity_score.assert_called()
        assert (
            event.group
            and event.group.get_event_metadata()["severity"] == 0.1121
            and event.group.get_event_metadata()["severity_reason"] == "ml"
        )

    @patch("sentry.event_manager._get_severity_score", return_value=(0.1121, "ml"))
    def test_flag_off(self, mock_get_severity_score: MagicMock):
        with self.feature({"projects:first-event-severity-calculation": False}):
            manager = EventManager(
                make_event(
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]},
                    platform="python",
                )
            )
            event = manager.save(self.project.id)

            mock_get_severity_score.assert_not_called()
            assert (
                event.group
                and "severity" not in event.group.get_event_metadata()
                and "severity.reason" not in event.group.get_event_metadata()
            )

    @patch("sentry.event_manager._get_severity_score", return_value=(0.1121, "ml"))
    def test_get_severity_score_not_called_on_second_event(
        self, mock_get_severity_score: MagicMock
    ):
        nope_event = EventManager(
            make_event(
                exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]},
                fingerprint=["dogs_are_great"],
                platform="python",
            )
        ).save(self.project.id)

        assert mock_get_severity_score.call_count == 1

        broken_stuff_event = EventManager(
            make_event(
                exception={"values": [{"type": "BrokenStuffError", "value": "It broke"}]},
                fingerprint=["dogs_are_great"],
                platform="python",
            )
        ).save(self.project.id)

        # Same group, but no extra `_get_severity_score` call
        assert broken_stuff_event.group_id == nope_event.group_id
        assert mock_get_severity_score.call_count == 1

    @patch("sentry.event_manager._get_severity_score", return_value=(0.1121, "ml"))
    def test_score_not_clobbered_by_second_event(self, mock_get_severity_score: MagicMock):
        with TaskRunner():  # Needed because updating groups is normally async
            nope_event = EventManager(
                make_event(
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]},
                    fingerprint=["dogs_are_great"],
                    platform="python",
                )
            ).save(self.project.id)

            group = Group.objects.get(id=nope_event.group_id)

            # This first assertion isn't useful in and of itself, but it allows us to prove
            # below that the data gets updated
            assert group.data["metadata"]["type"] == "NopeError"
            assert group.data["metadata"]["severity"] == 0.1121

            broken_stuff_event = EventManager(
                make_event(
                    exception={"values": [{"type": "BrokenStuffError", "value": "It broke"}]},
                    fingerprint=["dogs_are_great"],
                    platform="python",
                )
            ).save(self.project.id)

            # Both events landed in the same group
            assert broken_stuff_event.group_id == nope_event.group_id

            group.refresh_from_db()

            # Metadata has been updated, but severity hasn't been clobbered in the process
            assert group.data["metadata"]["type"] == "BrokenStuffError"
            assert group.get_event_metadata()["severity"] == 0.1121

    @patch("sentry.event_manager._get_severity_score")
    def test_killswitch_on(self, mock_get_severity_score: MagicMock):
        with override_options({"issues.severity.skip-seer-requests": [self.project.id]}):
            event = EventManager(
                make_event(
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]},
                    platform="python",
                )
            ).save(self.project.id)

            assert event.group
            assert "severity" not in event.group.get_event_metadata()
            assert cache.get(SEER_ERROR_COUNT_KEY) is None
            assert mock_get_severity_score.call_count == 0
