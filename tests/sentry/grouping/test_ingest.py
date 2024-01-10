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

    @patch("sentry_sdk.capture_exception")
    def test_handles_errors_with_background_grouping(
        self, mock_capture_exception: MagicMock
    ) -> None:
        background_grouping_error = Exception("nope")

        with patch(
            "sentry.grouping.ingest._calculate_background_grouping",
            side_effect=background_grouping_error,
        ):
            manager = EventManager({"message": "foo 123"})
            manager.normalize()
            event = manager.save(self.project.id)

            with self.options(
                {
                    "store.background-grouping-config-id": "mobile:2021-02-12",
                    "store.background-grouping-sample-rate": 1.0,
                }
            ):
                manager.save(self.project.id)

            mock_capture_exception.assert_called_with(background_grouping_error)
            # This proves the background grouping crash didn't crash the overall grouping process
            assert event.group

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
