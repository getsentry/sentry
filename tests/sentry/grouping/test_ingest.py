from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry.event_manager import EventManager
from sentry.grouping.ingest import _calculate_background_grouping
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@region_silo_test
class BackgroundGroupingTest(TestCase):
    @patch(
        "sentry.grouping.ingest._calculate_background_grouping",
        wraps=_calculate_background_grouping,
    )
    def test_applies_background_grouping(self, mock_calc_background_grouping: MagicMock) -> None:
        manager = EventManager({"message": "foo 123"})
        manager.normalize()
        manager.save(self.project.id)

        assert mock_calc_background_grouping.call_count == 0

        with self.options(
            {
                "store.background-grouping-config-id": "mobile:2021-02-12",
                "store.background-grouping-sample-rate": 1.0,
            }
        ):
            manager.save(self.project.id)

        assert mock_calc_background_grouping.call_count == 1

    @patch("sentry.grouping.ingest._calculate_background_grouping")
    def test_background_grouping_can_be_disabled_via_sample_rate(
        self, mock_calc_background_grouping: MagicMock
    ) -> None:
        manager = EventManager({"message": "foo 123"})
        manager.normalize()
        manager.save(self.project.id)

        assert mock_calc_background_grouping.call_count == 0

        with self.options(
            {
                "store.background-grouping-config-id": "mobile:2021-02-12",
                "store.background-grouping-sample-rate": 0.0,
            }
        ):
            manager.save(self.project.id)

        manager.save(self.project.id)

        assert mock_calc_background_grouping.call_count == 0
