from unittest.mock import patch

from sentry import options
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class ProjectSeerNightShiftTest(APITestCase):
    endpoint = "sentry-api-0-project-seer-night-shift"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    @with_feature("organizations:seer-night-shift")
    def test_triggers_task(self) -> None:
        with patch(
            "sentry.seer.endpoints.project_seer_night_shift.run_night_shift_for_org",
            return_value=42,
        ) as mock_task:
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=200,
            )

        assert response.data == {"agent_run_id": 42}
        mock_task.assert_called_once_with(
            self.organization.id,
            options={
                "source": "manual",
                "dry_run": False,
                "max_candidates": options.get("seer.night_shift.issues_per_org"),
                "intelligence_level": "high",
                "reasoning_effort": "high",
                "extra_triage_instructions": "",
            },
            project_ids=[self.project.id],
            triggering_user_id=self.user.id,
            execute_in_task=True,
        )

    @with_feature("organizations:seer-night-shift")
    def test_triggers_task_with_dry_run(self) -> None:
        with patch(
            "sentry.seer.endpoints.project_seer_night_shift.run_night_shift_for_org",
            return_value=None,
        ) as mock_task:
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                dryRun=True,
                status_code=200,
            )

        assert response.data == {"agent_run_id": None}
        mock_task.assert_called_once_with(
            self.organization.id,
            options={
                "source": "manual",
                "dry_run": True,
                "max_candidates": options.get("seer.night_shift.issues_per_org"),
                "intelligence_level": "high",
                "reasoning_effort": "high",
                "extra_triage_instructions": "",
            },
            project_ids=[self.project.id],
            triggering_user_id=self.user.id,
            execute_in_task=True,
        )

    @with_feature("organizations:seer-night-shift")
    def test_forwards_tweaks_to_task(self) -> None:
        self.project.update_option(
            "sentry:seer_nightshift_tweaks",
            {
                "max_candidates": 25,
                "intelligence_level": "low",
                "reasoning_effort": "medium",
                "extra_triage_instructions": "Be terse.",
            },
        )

        with patch(
            "sentry.seer.endpoints.project_seer_night_shift.run_night_shift_for_org",
            return_value=99,
        ) as mock_task:
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=200,
            )

        assert response.data == {"agent_run_id": 99}
        mock_task.assert_called_once_with(
            self.organization.id,
            options={
                "source": "manual",
                "dry_run": False,
                "max_candidates": 25,
                "intelligence_level": "low",
                "reasoning_effort": "medium",
                "extra_triage_instructions": "Be terse.",
            },
            project_ids=[self.project.id],
            triggering_user_id=self.user.id,
            execute_in_task=True,
        )

    def test_without_feature_returns_404(self) -> None:
        with patch(
            "sentry.seer.endpoints.project_seer_night_shift.run_night_shift_for_org"
        ) as mock_task:
            response = self.get_response(self.organization.slug, self.project.slug)

        assert response.status_code == 404
        mock_task.assert_not_called()
