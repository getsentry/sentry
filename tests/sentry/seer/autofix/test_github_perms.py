from __future__ import annotations

from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.github_perms import get_blocked_pr_iteration_permissions
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

REPO_NAME = "getsentry/sentry"


def _state(*, pr_number: int | None) -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=[],
        status="completed",
        updated_at="2023-07-18T12:00:00Z",
        repo_pr_states={REPO_NAME: RepoPRState(repo_name=REPO_NAME, pr_number=pr_number)},
    )


class GetBlockedPrIterationPermissionsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="9999",
            metadata={"permissions": {"contents": "read"}},
        )
        self.create_repo(
            project=self.create_project(organization=self.organization),
            name=REPO_NAME,
            provider="integrations:github",
            integration_id=self.integration.id,
        )

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_warns_when_a_pr_exists_and_feedback_is_queued(self) -> None:
        missing = get_blocked_pr_iteration_permissions(
            self.organization, _state(pr_number=7), has_actionable_feedback=True
        )

        assert set(missing) == {REPO_NAME}
        assert missing[REPO_NAME].missing_scopes == ["contents"]
        assert missing[REPO_NAME].installation_id == "9999"

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_silent_without_actionable_feedback(self) -> None:
        assert (
            get_blocked_pr_iteration_permissions(
                self.organization, _state(pr_number=7), has_actionable_feedback=False
            )
            == {}
        )

    @override_options({"github-app.required-permissions": {"contents": "write"}})
    def test_silent_before_the_pr_is_created(self) -> None:
        assert (
            get_blocked_pr_iteration_permissions(
                self.organization, _state(pr_number=None), has_actionable_feedback=True
            )
            == {}
        )

    @override_options({"github-app.required-permissions": {"contents": "read"}})
    def test_silent_when_the_install_is_healthy(self) -> None:
        assert (
            get_blocked_pr_iteration_permissions(
                self.organization, _state(pr_number=7), has_actionable_feedback=True
            )
            == {}
        )
