from unittest.mock import patch

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.autofix_agent import AutofixStep
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models import SeerRunType
from sentry.tasks.seer.rerun_autofix_rca import (
    rerun_autofix_rca_batch,
    rerun_autofix_rca_for_run,
)
from sentry.testutils.cases import TestCase


class RerunAutofixRcaTaskTest(TestCase):
    @patch("sentry.tasks.seer.rerun_autofix_rca.trigger_autofix_agent")
    @patch("sentry.tasks.seer.rerun_autofix_rca.get_autofix_run_state")
    def test_starts_from_source_run_configuration(self, mock_get_state, mock_trigger) -> None:
        group = self.create_group()
        source_run = self.create_seer_run(
            type=SeerRunType.EXPLORER,
            organization=group.organization,
            seer_run_state_id=123,
            referrer=AutofixReferrer.WEB,
        )
        self.create_seer_agent_run(source_run, source="autofix", group=group)
        mock_get_state.return_value = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            metadata={
                "referrer": AutofixReferrer.GROUP_AUTOFIX_ENDPOINT,
                "stopping_point": AutofixStoppingPoint.SOLUTION,
            },
        )

        outcome = rerun_autofix_rca_for_run(123)

        assert outcome == "started"
        mock_trigger.assert_called_once_with(
            group=group,
            step=AutofixStep.ROOT_CAUSE,
            referrer=AutofixReferrer.GROUP_AUTOFIX_ENDPOINT,
            stopping_point=AutofixStoppingPoint.SOLUTION,
            skip_quota=True,
        )

    def test_skips_unknown_run(self) -> None:
        outcome = rerun_autofix_rca_for_run(123)

        assert outcome == "missing_run"

    @patch("sentry.tasks.seer.rerun_autofix_rca.rerun_autofix_rca_for_run")
    def test_self_chains_next_batch(self, mock_rerun) -> None:
        mock_rerun.return_value = "started"
        run_ids = [1, 2, 3]

        with (
            self.options(
                {
                    "seer.autofix_rca_rerun.batch_size": 2,
                    "seer.autofix_rca_rerun.inter_batch_delay_s": 7,
                }
            ),
            patch.object(rerun_autofix_rca_batch, "apply_async") as mock_chain,
        ):
            rerun_autofix_rca_batch(run_ids)

        assert mock_rerun.call_args_list[0].args == (1,)
        assert mock_rerun.call_args_list[1].args == (2,)
        mock_chain.assert_called_once_with(
            args=[run_ids],
            kwargs={"offset": 2},
            countdown=7,
            headers={"sentry-propagate-traces": False},
        )

    @patch("sentry.tasks.seer.rerun_autofix_rca.rerun_autofix_rca_for_run")
    def test_stops_when_batch_failure_limit_is_reached(self, mock_rerun) -> None:
        mock_rerun.return_value = "failed"

        with (
            self.options(
                {
                    "seer.autofix_rca_rerun.batch_size": 2,
                    "seer.autofix_rca_rerun.max_failures_per_batch": 1,
                }
            ),
            patch.object(rerun_autofix_rca_batch, "apply_async") as mock_chain,
        ):
            rerun_autofix_rca_batch([1, 2, 3])

        mock_chain.assert_not_called()
