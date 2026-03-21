from __future__ import annotations

import logging
import uuid
from typing import Any
from unittest.mock import MagicMock, patch

from sentry.event_manager import EventManager
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import cell_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.group import PriorityLevel

pytestmark = [requires_snuba]


def make_event(**kwargs: Any) -> dict[str, Any]:
    result: dict[str, Any] = {
        "event_id": uuid.uuid1().hex,
    }
    result.update(kwargs)
    return result


@cell_silo_test
@with_feature("organizations:seer-based-priority")
class TestEventManagerPriority(TestCase):
    @patch("sentry.event_manager._get_priority_for_group", return_value=PriorityLevel.HIGH)
    def test_get_priority_for_group_not_called_on_second_event(
        self, mock_get_priority_for_group: MagicMock
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
        for level, expected_priority in (
            (logging.INFO, PriorityLevel.LOW),
            (logging.DEBUG, PriorityLevel.LOW),
            (logging.WARNING, PriorityLevel.MEDIUM),
            (logging.ERROR, PriorityLevel.HIGH),
            (logging.FATAL, PriorityLevel.HIGH),
        ):
            manager = EventManager(make_event(level=level, fingerprint=[level], platform="python"))
            event = manager.save(self.project.id)

            assert event.group
            assert "severity" not in event.group.get_event_metadata()
            assert event.group.priority == expected_priority
            assert event.group.get_event_metadata()["initial_priority"] == expected_priority
