from unittest.mock import Mock

from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.testutils.cases import TestCase

REPO_NAME = "owner/repo"
RUN_ID = 4242
PR_NUMBER = 7
GROUP_ID = 99
ORGANIZATION_ID = 12


def _run_state(**repo_pr_states: RepoPRState) -> SeerRunState:
    return SeerRunState(
        run_id=RUN_ID,
        blocks=[],
        status="completed",
        updated_at="2024-01-01T00:00:00Z",
        repo_pr_states={pr_state.repo_name: pr_state for pr_state in repo_pr_states.values()},
        metadata={"group_id": GROUP_ID},
    )


class PrIterationIdentityDerivationTest(TestCase):
    def test_deriving_identity_touches_no_database(self) -> None:
        state = _run_state(repo=RepoPRState(repo_name=REPO_NAME, pr_number=PR_NUMBER))

        with self.assertNumQueries(0):
            PrIterationLogContext(
                Mock(),
                run_state=state,
                organization_id=ORGANIZATION_ID,
                group_id=GROUP_ID,
            )
