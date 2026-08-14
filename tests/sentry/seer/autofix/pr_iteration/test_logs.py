from unittest.mock import Mock

from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.testutils.cases import TestCase

REPO_NAME = "owner/repo"
OTHER_REPO_NAME = "owner/other"
RUN_ID = 4242
PR_ID = 555
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


class PrIterationLogEmitTest(TestCase):
    def test_starts_empty_so_pre_resolution_lines_carry_no_identity(self) -> None:
        # The check-suite listener holds only GitHub's ids until Seer resolves the
        # run; those go on the line as fields, not as identity.
        log = Mock()
        ctx = PrIterationLogContext(log)

        ctx.info("autofix.pr_iteration.check_suite.received", check_suite_id=9)

        assert ctx.identity == {}
        log.info.assert_called_once_with(
            "autofix.pr_iteration.check_suite.received", extra={"check_suite_id": 9}
        )

    def test_info_merges_identity_and_fields(self) -> None:
        log = Mock()
        ctx = PrIterationLogContext(log, run_state=_run_state())

        ctx.info("autofix.pr_iteration.check_suite.received", check_suite_id=9)

        log.info.assert_called_once_with(
            "autofix.pr_iteration.check_suite.received",
            extra={"run_id": RUN_ID, "check_suite_id": 9},
        )

    def test_per_line_fields_do_not_persist(self) -> None:
        log = Mock()
        ctx = PrIterationLogContext(log, run_state=_run_state())

        ctx.info("autofix.pr_iteration.check_suite.received", check_suite_id=9)
        ctx.info("autofix.pr_iteration.check_suite.run_resolved")

        assert log.info.call_args.kwargs["extra"] == {"run_id": RUN_ID}
        assert ctx.identity == {"run_id": RUN_ID}

    def test_error_logs_at_error_with_exc_info(self) -> None:
        # Error, not warning: "show me every broken iteration" should be one
        # search for errors, not a list of names you have to already know.
        log = Mock()
        ctx = PrIterationLogContext(log, run_state=_run_state())

        ctx.error("autofix.pr_iteration.check_suite.failed", error_type="ConnectionError")

        log.error.assert_called_once_with(
            "autofix.pr_iteration.check_suite.failed",
            extra={"run_id": RUN_ID, "error_type": "ConnectionError"},
            exc_info=True,
        )
        log.warning.assert_not_called()

    def test_error_outside_a_handler_can_drop_exc_info(self) -> None:
        log = Mock()
        ctx = PrIterationLogContext(log)

        ctx.error("autofix.pr_iteration.check_suite.failed", exc_info=False)

        assert log.error.call_args.kwargs["exc_info"] is False


class PrIterationIdentityDerivationTest(TestCase):
    def test_ids_and_run_state(self) -> None:
        ctx = PrIterationLogContext(
            Mock(),
            run_state=_run_state(),
            organization_id=ORGANIZATION_ID,
            group_id=GROUP_ID,
        )

        assert ctx.identity == {
            "run_id": RUN_ID,
            "sentry_organization_id": ORGANIZATION_ID,
            "sentry_group_id": GROUP_ID,
        }

    def test_update_merges_without_erasing(self) -> None:
        ctx = PrIterationLogContext(Mock(), organization_id=ORGANIZATION_ID)

        ctx.update(run_state=_run_state())

        assert ctx.identity == {
            "run_id": RUN_ID,
            "sentry_organization_id": ORGANIZATION_ID,
        }

    def test_run_state_carries_the_pull_request(self) -> None:
        # The provider is recorded exactly as Seer sent it, prefix and all: the
        # point of the line is what the code read, not a tidied version of it.
        state = _run_state(
            repo=RepoPRState(
                repo_name=REPO_NAME,
                provider="integrations:github",
                pr_id=PR_ID,
                pr_number=PR_NUMBER,
                pr_url="https://github.com/owner/repo/pull/7",
            )
        )

        ctx = PrIterationLogContext(Mock(), run_state=state)

        assert ctx.identity["scm_infos"] == [
            {
                "scm_repo_full_name": REPO_NAME,
                "scm_provider": "integrations:github",
                "pr_id": PR_ID,
                "pr_number": PR_NUMBER,
                "pr_url": "https://github.com/owner/repo/pull/7",
            }
        ]

    def test_the_moving_head_commit_is_not_part_of_the_identity(self) -> None:
        # It changes on every push, and a line reporting a sha should report the
        # one it actually compared -- as a per-line field, not as identity.
        state = _run_state(
            repo=RepoPRState(repo_name=REPO_NAME, pr_number=PR_NUMBER, commit_sha="deadbeef")
        )

        ctx = PrIterationLogContext(Mock(), run_state=state)

        assert ctx.identity["scm_infos"] == [
            {"scm_repo_full_name": REPO_NAME, "pr_number": PR_NUMBER}
        ]

    def test_covers_every_repo_of_a_multi_repo_run(self) -> None:
        state = _run_state(
            repo=RepoPRState(repo_name=REPO_NAME, pr_number=PR_NUMBER),
            other=RepoPRState(repo_name=OTHER_REPO_NAME, pr_number=8),
        )

        ctx = PrIterationLogContext(Mock(), run_state=state)

        assert ctx.identity["scm_infos"] == [
            {"scm_repo_full_name": REPO_NAME, "pr_number": PR_NUMBER},
            {"scm_repo_full_name": OTHER_REPO_NAME, "pr_number": 8},
        ]

    def test_deriving_identity_touches_no_database(self) -> None:
        state = _run_state(repo=RepoPRState(repo_name=REPO_NAME, pr_number=PR_NUMBER))

        with self.assertNumQueries(0):
            PrIterationLogContext(
                Mock(),
                run_state=state,
                organization_id=ORGANIZATION_ID,
                group_id=GROUP_ID,
            )

    def test_an_update_that_names_no_repos_leaves_the_list_standing(self) -> None:
        state = _run_state(repo=RepoPRState(repo_name=REPO_NAME, pr_number=PR_NUMBER))
        ctx = PrIterationLogContext(Mock(), run_state=state)
        scm_infos = ctx.identity["scm_infos"]

        ctx.update(group_id=GROUP_ID)

        assert ctx.identity["scm_infos"] == scm_infos
