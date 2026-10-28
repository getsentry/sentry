from typing import Any
from unittest.mock import MagicMock, patch

from sentry.analytics.events.pr_iteration_events import (
    AiAutofixPrIterationFeedbackBatchCompletedEvent,
)
from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.agent.feature_delivery import DELIVERY_HANDLERS
from sentry.seer.autofix.pr_iteration.ad_hoc import FEATURE_ID
from sentry.seer.autofix.pr_iteration.constants import AD_HOC_FLAG
from sentry.seer.autofix.pr_iteration.details_store import open_iterations
from sentry.seer.autofix.pr_iteration.emit import PrIterationOutcome
from sentry.seer.autofix.pr_iteration.listeners.check_suite import (
    pr_iteration_from_check_suite_listener,
)
from sentry.seer.autofix.pr_iteration.queue import peek_queued_autofix_feedback
from sentry.seer.models.run import SeerRunType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from tests.sentry.seer.autofix.pr_iteration.test_check_suite import (
    OWN_REPO_ID,
    _live_pr_result,
    check_suite_event,
    own_repo_pr,
)
from tests.sentry.seer.autofix.pr_iteration.test_pr_state import APP_LOGIN, _commit, _ScmStub

RUN_ID = 67890
INSTALLATION_ID = 4242
PR_URL = "https://github.com/owner/repo/pull/7"
# The chat's own push is all this run records; an earlier iteration pushed from its own run.
CHAT_PUSH = "chat-push"
ITERATION_PUSH = "iteration-push"


class AdHocPrIterationFlowTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id=str(INSTALLATION_ID)
        )
        self.create_repo(
            project=self.project,
            name="owner/repo",
            provider="integrations:github",
            external_id=str(OWN_REPO_ID),
            integration_id=integration.id,
        )
        self.source_run = self.create_seer_run(seer_run_state_id=RUN_ID, user_id=self.user.id)
        self.execution = self.create_seer_run(
            seer_run_state_id=RUN_ID + 1, user_id=self.user.id, type=SeerRunType.FEATURE_RUN
        )
        self.state = SeerRunState(
            run_id=RUN_ID,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_number=7, pr_url=PR_URL, commit_sha=CHAT_PUSH
                )
            },
        )

    def _failing_check_suite(self):
        return check_suite_event(
            {
                "check_suite": {
                    "id": 1,
                    "head_sha": ITERATION_PUSH,
                    "check_runs_url": "https://github.com/owner/repo/check-runs",
                    "app": {"name": "CI"},
                    "conclusion": "failure",
                    "updated_at": "2024-01-01T00:00:00Z",
                    "pull_requests": [own_repo_pr(555)],
                },
                "repository": {
                    "html_url": "https://github.com/owner/repo",
                    "id": OWN_REPO_ID,
                    "full_name": "owner/repo",
                },
                "installation": {"id": INSTALLATION_ID},
            },
            installation_id=INSTALLATION_ID,
        )

    def _start_feature_run(self, **kwargs: Any):
        self.create_seer_agent_run(
            run=self.execution, source=kwargs["feature_id"], extras=kwargs["extras"]
        )
        kwargs["on_run_created"](self.execution)
        return self.execution

    def test_failing_ci_on_an_iteration_push_runs_the_next_iteration(self) -> None:
        github = MagicMock(spec=_ScmStub)
        seer_client = MagicMock()
        seer_client.return_value.start_feature_run.side_effect = self._start_feature_run

        with (
            self.feature({AD_HOC_FLAG: True, "organizations:ask-seer-create-pr": True}),
            override_options({"github-app.name": "Seer Dev"}),
            patch("sentry.scm.factory.new", return_value=github),
            patch("sentry.seer.autofix.pr_iteration.pr_state.make_scm", return_value=github),
            patch("scm.actions.get_pull_request", return_value=_live_pr_result(ITERATION_PUSH)),
            patch("scm.actions.get_commit", return_value=_commit(APP_LOGIN, verified=True)),
            patch(
                "sentry.seer.autofix.pr_iteration.check_suites.get_agent_state_from_pr_id",
                return_value=self.state,
            ),
            patch("sentry.tasks.seer.pr_iteration.fetch_run_status", return_value=self.state),
            patch(
                "sentry.seer.autofix.pr_iteration.ad_hoc.has_seer_agent_access_with_detail",
                return_value=(True, None),
            ),
            patch("sentry.seer.autofix.pr_iteration.ad_hoc.SeerAgentClient", seer_client),
            patch("sentry.analytics.record") as record,
            self.tasks(),
        ):
            pr_iteration_from_check_suite_listener(self._failing_check_suite())

            assert peek_queued_autofix_feedback(RUN_ID) == []
            (iteration,) = open_iterations(self.source_run)
            assert iteration.data["execution_seer_run_id"] == self.execution.id
            # The iteration acts as the chat's owner.
            assert seer_client.call_args.args[1].id == self.user.id
            start = seer_client.return_value.start_feature_run.call_args.kwargs
            assert start["feature_id"] == FEATURE_ID
            assert start["payload"]["source_run_id"] == RUN_ID
            assert start["payload"]["iteration_id"] == iteration.id
            assert start["payload"]["pr_urls"] == {"owner/repo": PR_URL}

            deliver = DELIVERY_HANDLERS[FEATURE_ID]
            result = {"outcome": "already_pushed", "head_shas": ["fix-push"]}
            # Seer may deliver the same result more than once.
            deliver(self.organization.id, self.execution.uuid, "completed", result, None)
            deliver(self.organization.id, self.execution.uuid, "completed", result, None)

        assert open_iterations(self.source_run) == []
        (completed,) = [
            call.args[0]
            for call in record.call_args_list
            if isinstance(call.args[0], AiAutofixPrIterationFeedbackBatchCompletedEvent)
        ]
        assert completed.iteration_type == "ad_hoc"
        assert completed.iteration_id == iteration.id
        assert completed.outcome == PrIterationOutcome.ALREADY_PUSHED.value
        assert completed.head_shas == ["fix-push"]
