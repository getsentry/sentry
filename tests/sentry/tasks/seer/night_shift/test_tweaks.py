from unittest.mock import patch

from sentry import options
from sentry.tasks.seer.night_shift.tweaks import NightShiftTweaks, get_night_shift_tweaks
from sentry.testutils.cases import TestCase


class GetNightShiftTweaksTest(TestCase):
    def test_unset_returns_defaults(self) -> None:
        tweaks = get_night_shift_tweaks(self.project)

        assert tweaks.enabled is False
        assert tweaks.candidate_issues == options.get("seer.night_shift.issues_per_org")

    def test_empty_object_returns_defaults(self) -> None:
        self.project.update_option("sentry:seer_nightshift_tweaks", {})

        tweaks = get_night_shift_tweaks(self.project)

        assert tweaks.enabled is False
        assert tweaks.candidate_issues == options.get("seer.night_shift.issues_per_org")

    def test_full_override(self) -> None:
        self.project.update_option(
            "sentry:seer_nightshift_tweaks",
            {"enabled": True, "candidate_issues": 25},
        )

        tweaks = get_night_shift_tweaks(self.project)

        assert tweaks == NightShiftTweaks(enabled=True, candidate_issues=25)

    def test_partial_override_falls_back_to_option(self) -> None:
        self.project.update_option(
            "sentry:seer_nightshift_tweaks",
            {"enabled": True},
        )

        with self.options({"seer.night_shift.issues_per_org": 42}):
            tweaks = get_night_shift_tweaks(self.project)

        assert tweaks.enabled is True
        assert tweaks.candidate_issues == 42

    def test_candidate_issues_only_uses_default_enabled(self) -> None:
        self.project.update_option(
            "sentry:seer_nightshift_tweaks",
            {"candidate_issues": 7},
        )

        tweaks = get_night_shift_tweaks(self.project)

        assert tweaks.enabled is False
        assert tweaks.candidate_issues == 7

    def test_non_dict_value_reports_and_returns_defaults(self) -> None:
        self.project.update_option(
            "sentry:seer_nightshift_tweaks",
            [{"enabled": True}],
        )

        with patch(
            "sentry.tasks.seer.night_shift.tweaks.sentry_sdk.capture_exception"
        ) as mock_capture:
            tweaks = get_night_shift_tweaks(self.project)

        mock_capture.assert_called_once()
        assert tweaks.enabled is False
        assert tweaks.candidate_issues == options.get("seer.night_shift.issues_per_org")

    def test_invalid_payload_reports_and_returns_defaults(self) -> None:
        self.project.update_option(
            "sentry:seer_nightshift_tweaks",
            {"candidate_issues": "not-an-int"},
        )

        with patch(
            "sentry.tasks.seer.night_shift.tweaks.sentry_sdk.capture_exception"
        ) as mock_capture:
            tweaks = get_night_shift_tweaks(self.project)

        mock_capture.assert_called_once()
        assert tweaks.enabled is False
        assert tweaks.candidate_issues == options.get("seer.night_shift.issues_per_org")
