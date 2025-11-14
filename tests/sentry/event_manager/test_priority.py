from __future__ import annotations
from typing import int

import logging
from unittest.mock import MagicMock, patch

from sentry import options
from sentry.event_manager import EventManager
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.group import PriorityLevel
from tests.sentry.event_manager.test_severity import make_event

pytestmark = [requires_snuba]


@region_silo_test
@with_feature("projects:first-event-severity-calculation")
@with_feature("organizations:seer-based-priority")
class TestEventManagerPriority(TestCase):
    @patch("sentry.event_manager._get_severity_score", return_value=(0.1121, "ml"))
    def test_flag_on(self, mock_get_severity_score: MagicMock) -> None:
        manager = EventManager(make_event(level=logging.FATAL, platform="python"))
        event = manager.save(self.project.id)

        mock_get_severity_score.assert_called()
        assert event.group
        assert event.group.get_event_metadata()["severity"] == 0.1121
        assert event.group.priority == PriorityLevel.HIGH
        assert event.group.get_event_metadata()["initial_priority"] == 75

    @patch("sentry.event_manager._get_severity_score", return_value=(0.1121, "ml"))
    @patch("sentry.event_manager._get_priority_for_group", return_value=PriorityLevel.HIGH)
    def test_get_priority_for_group_not_called_on_second_event(
        self, mock_get_priority_for_group: MagicMock, mock_get_severity_score: MagicMock
    ) -> None:
        event = EventManager(make_event(level=logging.FATAL, platform="python")).save(
            self.project.id
        )
        assert mock_get_priority_for_group.call_count == 1

        event2 = EventManager(make_event(platform="python")).save(self.project.id)

        # Same group, but no extra `_get_priority_for_group` call
        assert event2.group_id == event.group_id
        assert mock_get_priority_for_group.call_count == 1

    def test_priority_scores_without_severity(self) -> None:
        with self.feature({"projects:first-event-severity-calculation": False}):
            for level, expected_priority in (
                (logging.INFO, PriorityLevel.LOW),
                (logging.DEBUG, PriorityLevel.LOW),
                (logging.WARNING, PriorityLevel.MEDIUM),
                (logging.ERROR, PriorityLevel.HIGH),
                (logging.FATAL, PriorityLevel.HIGH),
            ):
                manager = EventManager(
                    make_event(level=level, fingerprint=[level], platform="python")
                )
                event = manager.save(self.project.id)

                assert event.group
                assert "severity" not in event.group.get_event_metadata()
                assert event.group.priority == expected_priority
                assert event.group.get_event_metadata()["initial_priority"] == expected_priority

    @patch("sentry.event_manager._get_severity_score", return_value=(0.09, "ml"))
    def test_priority_scores_with_low_severity(self, mock_get_severity_score: MagicMock) -> None:
        for level, expected_priority in (
            (logging.INFO, PriorityLevel.LOW),
            (logging.DEBUG, PriorityLevel.LOW),
            (logging.WARNING, PriorityLevel.MEDIUM),
            (logging.ERROR, PriorityLevel.MEDIUM),
            (logging.FATAL, PriorityLevel.HIGH),
        ):
            manager = EventManager(make_event(level=level, fingerprint=[level], platform="python"))
            event = manager.save(self.project.id)

            assert event.group
            assert event.group.get_event_metadata()["severity"] == 0.09
            assert event.group.priority == expected_priority
            assert event.group.get_event_metadata()["initial_priority"] == expected_priority

    @patch("sentry.event_manager._get_severity_score", return_value=(0.2, "ml"))
    def test_priority_level_with_high_severity(self, mock_get_severity_score: MagicMock) -> None:
        for level, expected_priority in (
            (logging.INFO, PriorityLevel.LOW),
            (logging.DEBUG, PriorityLevel.LOW),
            (logging.WARNING, PriorityLevel.HIGH),
            (logging.ERROR, PriorityLevel.HIGH),
            (logging.FATAL, PriorityLevel.HIGH),
        ):
            manager = EventManager(make_event(level=level, fingerprint=[level], platform="python"))
            event = manager.save(self.project.id)

            assert event.group
            assert event.group.get_event_metadata()["severity"] == 0.2
            assert event.group.priority == expected_priority
            assert event.group.get_event_metadata()["initial_priority"] == expected_priority

    @patch("sentry.event_manager._get_severity_score", return_value=(0.2, "ml"))
    def test_killswitch_on(self, mock_get_severity_score: MagicMock) -> None:
        options.set("issues.severity.skip-seer-requests", [self.project.id])
        event = EventManager(
            make_event(level=logging.WARNING, fingerprint=["def"], platform="python")
        ).save(self.project.id)

        assert event.group
        assert "severity" not in event.group.get_event_metadata()
        assert event.group.priority == PriorityLevel.MEDIUM
        assert event.group.get_event_metadata()["initial_priority"] == PriorityLevel.MEDIUM
        assert mock_get_severity_score.call_count == 0

        options.set("issues.severity.skip-seer-requests", [])
        event = EventManager(
            make_event(level=logging.WARNING, fingerprint=["abc"], platform="python")
        ).save(self.project.id)

        assert event.group
        assert event.group.get_event_metadata()["severity"] == 0.2
        assert event.group.priority == PriorityLevel.HIGH
        assert event.group.get_event_metadata()["initial_priority"] == PriorityLevel.HIGH
        assert mock_get_severity_score.call_count == 1

    @patch("sentry.event_manager._get_severity_metadata_for_group", return_value={})
    def test_severity_error(self, mock_get_severity_metadata_for_group: MagicMock) -> None:
        event = EventManager(
            make_event(level=logging.WARNING, fingerprint=["def"], platform="python")
        ).save(self.project.id)

        assert event.group
        assert "severity" not in event.group.get_event_metadata()
        assert event.group.priority == PriorityLevel.MEDIUM
        assert event.group.get_event_metadata()["initial_priority"] == PriorityLevel.MEDIUM
        assert mock_get_severity_metadata_for_group.call_count == 1
