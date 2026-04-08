from unittest.mock import patch

from sentry.tasks.seer.night_shift import (
    run_night_shift_for_org,
    schedule_night_shift,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestScheduleNightShift(TestCase):
    def test_disabled_by_option(self) -> None:
        with (
            self.options({"seer.night_shift.enable": False}),
            patch("sentry.tasks.seer.night_shift.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()

    def test_dispatches_eligible_orgs(self) -> None:
        org = self.create_organization()

        with (
            self.options({"seer.night_shift.enable": True}),
            self.feature(
                {
                    "organizations:seer-night-shift": [org.slug],
                    "organizations:gen-ai-features": [org.slug],
                }
            ),
            patch("sentry.tasks.seer.night_shift.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_called_once()
            assert mock_worker.apply_async.call_args.kwargs["args"] == [org.id]

    def test_skips_ineligible_orgs(self) -> None:
        self.create_organization()

        with (
            self.options({"seer.night_shift.enable": True}),
            patch("sentry.tasks.seer.night_shift.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()

    def test_skips_orgs_with_hidden_ai(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:hide_ai_features", True)

        with (
            self.options({"seer.night_shift.enable": True}),
            self.feature(
                {
                    "organizations:seer-night-shift": [org.slug],
                    "organizations:gen-ai-features": [org.slug],
                }
            ),
            patch("sentry.tasks.seer.night_shift.run_night_shift_for_org") as mock_worker,
        ):
            schedule_night_shift()
            mock_worker.apply_async.assert_not_called()


@django_db_all
class TestRunNightShiftForOrg(TestCase):
    def test_logs_for_valid_org(self) -> None:
        org = self.create_organization()

        with patch("sentry.tasks.seer.night_shift.logger") as mock_logger:
            run_night_shift_for_org(org.id)
            mock_logger.info.assert_called_once()
            assert mock_logger.info.call_args.args[0] == "night_shift.org_dispatched"

    def test_nonexistent_org(self) -> None:
        with patch("sentry.tasks.seer.night_shift.logger") as mock_logger:
            run_night_shift_for_org(999999999)
            mock_logger.info.assert_not_called()
