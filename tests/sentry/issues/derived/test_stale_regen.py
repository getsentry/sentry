from unittest.mock import MagicMock, call, patch

from sentry.issues.derived.stale_regen import regenerate_stale_projects
from sentry.issues.derived.tasks import generate_project_derived_data
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

ENABLED = {"issues.derived.stale-regen-on-read-enabled": True}


@patch.object(generate_project_derived_data, "delay")
class RegenerateStaleProjectsTest(TestCase):
    def test_disabled_by_default(self, mock_delay: MagicMock) -> None:
        regenerate_stale_projects({self.project.id})

        mock_delay.assert_not_called()

    @override_options(ENABLED)
    def test_schedules_stale_only_regeneration(self, mock_delay: MagicMock) -> None:
        regenerate_stale_projects({self.project.id})

        mock_delay.assert_called_once_with(project_id=self.project.id, stale_only=True)

    @override_options(ENABLED)
    def test_schedules_each_project_once_per_window(self, mock_delay: MagicMock) -> None:
        regenerate_stale_projects({self.project.id})
        regenerate_stale_projects({self.project.id})

        mock_delay.assert_called_once_with(project_id=self.project.id, stale_only=True)

    @override_options({**ENABLED, "issues.derived.stale-regen-on-read-global-limit": 1})
    def test_global_limit_caps_scheduled_projects(self, mock_delay: MagicMock) -> None:
        other_project = self.create_project()
        first, second = sorted([self.project.id, other_project.id])

        with patch("sentry.issues.derived.stale_regen.metrics.incr") as mock_incr:
            regenerate_stale_projects({first, second})

        mock_delay.assert_called_once_with(project_id=first, stale_only=True)
        assert mock_incr.call_args_list == [
            call(
                "issues.derived.stale_regen_on_read",
                sample_rate=1.0,
                tags={"result": "scheduled"},
            ),
            call(
                "issues.derived.stale_regen_on_read",
                sample_rate=1.0,
                tags={"result": "global_limited"},
            ),
        ]

    @override_options(ENABLED)
    def test_does_not_schedule_when_limiter_is_unavailable(self, mock_delay: MagicMock) -> None:
        with patch(
            "sentry.issues.derived.stale_regen.ratelimits.backend.is_limited_with_value",
            return_value=(False, 0, 0),
        ):
            regenerate_stale_projects({self.project.id})

        mock_delay.assert_not_called()
