from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import MagicMock, patch

from urllib3 import HTTPResponse
from urllib3.exceptions import MaxRetryError

from sentry.event_manager import (
    NON_TITLE_EVENT_TITLES,
    EventManager,
    _get_event_instance,
    _get_severity_score,
    _save_aggregate,
    _save_grouphash_and_group,
    severity_connection_pool,
)
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]


def make_event(**kwargs) -> dict[str, Any]:
    result: dict[str, Any] = {
        "event_id": uuid.uuid1().hex,
    }
    result.update(kwargs)
    return result


@region_silo_test
class TestGetEventSeverity(TestCase):
    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        return_value=HTTPResponse(body=json.dumps({"severity": 0.1231})),
    )
    @patch("sentry.event_manager.logger.info")
    def test_error_event_simple(
        self,
        mock_logger_info: MagicMock,
        mock_urlopen: MagicMock,
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
                }
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
            "/v0/issues/severity-score",
            body=json.dumps(payload),
            headers={"content-type": "application/json;charset=utf-8"},
        )
        mock_logger_info.assert_called_with(
            "Got severity score of %s for event %s",
            severity,
            event.event_id,
            extra={
                "event_id": event.event_id,
                "op": "event_manager._get_severity_score",
                "payload": payload,
            },
        )
        assert severity == 0.1231
        assert reason == "ml"

    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        return_value=HTTPResponse(body=json.dumps({"severity": 0.1231})),
    )
    @patch("sentry.event_manager.logger.info")
    def test_message_event_simple(
        self,
        mock_logger_info: MagicMock,
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
                "/v0/issues/severity-score",
                body=json.dumps(payload),
                headers={"content-type": "application/json;charset=utf-8"},
            )
            mock_logger_info.assert_called_with(
                "Got severity score of %s for event %s",
                severity,
                event.event_id,
                extra={
                    "event_id": event.event_id,
                    "op": "event_manager._get_severity_score",
                    "payload": payload,
                },
            )
            assert severity == 0.1231
            assert reason == "ml"

    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        return_value=HTTPResponse(body=json.dumps({"severity": 0.1231})),
    )
    def test_uses_exception(
        self,
        mock_urlopen: MagicMock,
    ) -> None:
        manager = EventManager(
            make_event(
                exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]},
            )
        )
        event = manager.save(self.project.id)
        # `title` is a property with no setter, but it pulls from `metadata`, so it's equivalent
        # to set it there. (We have to ignore mypy because `metadata` isn't supposed to be mutable.)
        event.get_event_metadata()["title"] = "Dogs are great!"  # type: ignore[index]

        _get_severity_score(event)

        assert (
            json.loads(mock_urlopen.call_args.kwargs["body"])["message"]
            == "NopeError: Nopey McNopeface"
        )

    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        return_value=HTTPResponse(body=json.dumps({"severity": 0.1231})),
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
                )
            )
            event = manager.save(self.project.id)
            severity, reason = _get_severity_score(event)

            assert severity == expected_severity
            assert reason == expected_reason

    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        return_value=HTTPResponse(body=json.dumps({"severity": 0.1231})),
    )
    @patch("sentry.event_manager.logger.warning")
    def test_unusable_event_title(
        self,
        mock_logger_warning: MagicMock,
        mock_urlopen: MagicMock,
    ) -> None:
        for title in NON_TITLE_EVENT_TITLES:
            manager = EventManager(make_event(exception={"values": []}))
            event = manager.save(self.project.id)
            # `title` is a property with no setter, but it pulls from `metadata`, so it's equivalent
            # to set it there. (We have to ignore mypy because `metadata` isn't supposed to be mutable.)
            event.get_event_metadata()["title"] = title  # type: ignore[index]

            severity, reason = _get_severity_score(event)

            mock_urlopen.assert_not_called()
            mock_logger_warning.assert_called_with(
                "Unable to get severity score because of unusable `message` value '%s'",
                "<unlabeled event>",
                extra={
                    "event_id": event.event_id,
                    "op": "event_manager._get_severity_score",
                    "event_type": "default",
                    "event_title": title,
                    "computed_title": "<unlabeled event>",
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
    @patch("sentry.event_manager.logger.warning")
    def test_max_retry_exception(
        self,
        mock_logger_warning: MagicMock,
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
                }
            )
        )
        event = manager.save(self.project.id)

        severity, reason = _get_severity_score(event)

        mock_logger_warning.assert_called_with(
            "Unable to get severity score from microservice after %s retr%s. Got MaxRetryError caused by: %s.",
            1,
            "y",
            "Exception('It broke')",
            extra={
                "event_id": event.event_id,
                "op": "event_manager._get_severity_score",
                "payload": {
                    "message": "NopeError: Nopey McNopeface",
                    "has_stacktrace": 0,
                    "handled": True,
                },
            },
        )
        assert severity == 1.0
        assert reason == "microservice_max_retry"

    @patch(
        "sentry.event_manager.severity_connection_pool.urlopen",
        side_effect=Exception("It broke"),
    )
    @patch("sentry.event_manager.logger.warning")
    def test_other_exception(
        self,
        mock_logger_warning: MagicMock,
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
            )
        )
        event = manager.save(self.project.id)

        severity, reason = _get_severity_score(event)

        mock_logger_warning.assert_called_with(
            "Unable to get severity score from microservice. Got: %s.",
            "Exception('It broke')",
            extra={
                "event_id": event.event_id,
                "op": "event_manager._get_severity_score",
                "payload": {
                    "message": "NopeError: Nopey McNopeface",
                    "has_stacktrace": 0,
                    "handled": True,
                },
            },
        )
        assert severity == 1.0
        assert reason == "microservice_error"


@region_silo_test
class TestEventManagerSeverity(TestCase):
    @patch("sentry.event_manager._get_severity_score", return_value=(0.1121, "ml"))
    def test_flag_on(self, mock_get_severity_score: MagicMock):
        with self.feature({"projects:first-event-severity-calculation": True}):
            manager = EventManager(
                make_event(
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]}
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
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]}
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
        with self.feature({"projects:first-event-severity-calculation": True}):
            nope_event = EventManager(
                make_event(
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]},
                    fingerprint=["dogs_are_great"],
                )
            ).save(self.project.id)

            assert mock_get_severity_score.call_count == 1

            broken_stuff_event = EventManager(
                make_event(
                    exception={"values": [{"type": "BrokenStuffError", "value": "It broke"}]},
                    fingerprint=["dogs_are_great"],
                )
            ).save(self.project.id)

            # Same group, but no extra `_get_severity_score` call
            assert broken_stuff_event.group_id == nope_event.group_id
            assert mock_get_severity_score.call_count == 1

    @patch("sentry.event_manager._get_severity_score", return_value=(0.1121, "ml"))
    def test_score_not_clobbered_by_second_event(self, mock_get_severity_score: MagicMock):
        with self.feature({"projects:first-event-severity-calculation": True}):
            with TaskRunner():  # Needed because updating groups is normally async
                nope_event = EventManager(
                    make_event(
                        exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]},
                        fingerprint=["dogs_are_great"],
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
                    )
                ).save(self.project.id)

                # Both events landed in the same group
                assert broken_stuff_event.group_id == nope_event.group_id

                group.refresh_from_db()

                # Metadata has been updated, but severity hasn't been clobbered in the process
                assert group.data["metadata"]["type"] == "BrokenStuffError"
                assert group.get_event_metadata()["severity"] == 0.1121


@region_silo_test
class TestSaveAggregateSeverity(TestCase):
    @patch("sentry.event_manager._save_aggregate", wraps=_save_aggregate)
    @patch("sentry.event_manager.logger.error")
    @patch("sentry.event_manager._get_severity_score", return_value=(None, None))
    def test_error_logged_on_no_score_when_enabled(
        self,
        mock_get_severity_score: MagicMock,
        mock_logger_error: MagicMock,
        mock_save_aggregate: MagicMock,
    ):
        with self.feature({"projects:first-event-severity-calculation": True}):
            manager = EventManager(
                make_event(
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]}
                )
            )
            event = manager.save(self.project.id)

            mock_save_aggregate.assert_called()
            mock_get_severity_score.assert_called()
            mock_logger_error.assert_called_with(
                "Group created without severity score",
                extra={
                    "event_id": event.event_id,
                    "group_id": event.group_id,
                },
            )

    @patch("sentry.event_manager._save_aggregate", wraps=_save_aggregate)
    @patch("sentry.event_manager.logger.error")
    @patch("sentry.event_manager._get_severity_score", return_value=None)
    def test_no_error_logged_on_no_score_when_disabled(
        self,
        mock_get_severity_score: MagicMock,
        mock_logger_error: MagicMock,
        mock_save_aggregate: MagicMock,
    ):
        with self.feature({"projects:first-event-severity-calculation": False}):
            manager = EventManager(
                make_event(
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]}
                )
            )
            manager.save(self.project.id)

            logger_messages = [call.args[0] for call in mock_logger_error.mock_calls]

            mock_save_aggregate.assert_called()
            mock_get_severity_score.assert_not_called()
            assert "Group created without severity score" not in logger_messages

    @patch("sentry.event_manager._save_aggregate", wraps=_save_aggregate)
    @patch("sentry.event_manager.logger.error")
    @patch("sentry.event_manager._get_severity_score", return_value=(0.0, "ml"))
    def test_no_error_logged_on_zero_score_when_enabled(
        self,
        mock_get_severity_score: MagicMock,
        mock_logger_error: MagicMock,
        mock_save_aggregate: MagicMock,
    ):
        with self.feature({"projects:first-event-severity-calculation": True}):
            manager = EventManager(
                make_event(
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]}
                )
            )
            event = manager.save(self.project.id)

            logger_messages = [call.args[0] for call in mock_logger_error.mock_calls]

            mock_save_aggregate.assert_called()
            mock_get_severity_score.assert_called()
            assert event.group and event.group.data["metadata"]["severity"] == 0.0
            assert "Group created without severity score" not in logger_messages


@region_silo_test
class TestSaveGroupHashAndGroupSeverity(TestCase):
    @patch("sentry.event_manager.logger.error")
    @patch("sentry.event_manager._get_severity_score", return_value=(None, None))
    def test_error_logged_on_no_score_when_enabled(
        self,
        mock_get_severity_score: MagicMock,
        mock_logger_error: MagicMock,
    ):
        with self.feature({"projects:first-event-severity-calculation": True}):
            event = _get_event_instance(
                make_event(
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]}
                ),
                self.project.id,
            )

            group, created = _save_grouphash_and_group(self.project, event, "dogs are great")

            assert created is True
            mock_get_severity_score.assert_called()
            mock_logger_error.assert_called_with(
                "Group created without severity score",
                extra={
                    "event_id": event.event_id,
                    "group_id": group.id,
                },
            )

    @patch("sentry.event_manager.logger.error")
    @patch("sentry.event_manager._get_severity_score", return_value=(None, None))
    def test_no_error_logged_on_no_score_when_disabled(
        self,
        mock_get_severity_score: MagicMock,
        mock_logger_error: MagicMock,
    ):
        with self.feature({"projects:first-event-severity-calculation": False}):
            event = _get_event_instance(
                make_event(
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]}
                ),
                self.project.id,
            )

            _save_grouphash_and_group(self.project, event, "dogs are great")

            logger_messages = [call.args[0] for call in mock_logger_error.mock_calls]

            mock_get_severity_score.assert_not_called()
            assert "Group created without severity score" not in logger_messages

    @patch("sentry.event_manager.logger.error")
    @patch("sentry.event_manager._get_severity_score", return_value=(0.0, "ml"))
    def test_no_error_logged_on_zero_score_when_enabled(
        self,
        mock_get_severity_score: MagicMock,
        mock_logger_error: MagicMock,
    ):
        with self.feature({"projects:first-event-severity-calculation": True}):
            event = _get_event_instance(
                make_event(
                    exception={"values": [{"type": "NopeError", "value": "Nopey McNopeface"}]}
                ),
                self.project.id,
            )

            group, _ = _save_grouphash_and_group(self.project, event, "dogs are great")

            logger_messages = [call.args[0] for call in mock_logger_error.mock_calls]

            mock_get_severity_score.assert_called()
            assert group.data["metadata"]["severity"] == 0.0
            assert "Group created without severity score" not in logger_messages
