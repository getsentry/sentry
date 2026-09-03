from unittest.mock import patch
from uuid import UUID

from django.db import connections, router
from django.test.utils import CaptureQueriesContext

from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.autofix_rca.delivery import deliver_autofix_rca_result
from sentry.seer.models.run import SeerAgentRun
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all

# Seer delivers the root cause artifact itself as the result.
VALID_RESULT: dict[str, object] = {
    "one_line_description": "null deref in handler",
    "five_whys": ["a", "b", "c"],
    "reproduction_steps": ["do x"],
    "relevant_repo": "owner/repo",
    "fixability": {"assessment": "fixable", "reason": "matches the stacktrace"},
}


@django_db_all
class TestDeliverAutofixRCAResult(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        seer_run = self.create_seer_run(
            organization=self.organization,
            type="feature_run",
            seer_run_state_id=123,
        )
        self.agent_run = self.create_seer_agent_run(
            run=seer_run,
            source="autofix_rca",
            group=self.group,
            project=self.project,
            extras={"referrer": AutofixReferrer.WEB.value},
        )

    def test_missing_run_logs_warning(self) -> None:
        with patch("sentry.seer.autofix_rca.delivery.logger") as mock_logger:
            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=UUID("00000000-0000-0000-0000-000000000000"),
                status="completed",
                result=VALID_RESULT,
                error=None,
            )

        mock_logger.warning.assert_called_once()
        assert "autofix_rca.delivery.missing_run" in mock_logger.warning.call_args.args[0]

    def test_completed_result_is_persisted(self) -> None:
        self.agent_run.extras = {
            **self.agent_run.extras,
            "stopping_point": AutofixStoppingPoint.OPEN_PR.value,
        }
        self.agent_run.save(update_fields=["extras"])

        deliver_autofix_rca_result(
            organization_id=self.organization.id,
            run_uuid=self.agent_run.run.uuid,
            status="completed",
            result=VALID_RESULT,
            error=None,
        )

        self.agent_run.refresh_from_db()
        assert self.agent_run.extras["status"] == "completed"
        assert self.agent_run.extras["result"] == VALID_RESULT
        assert self.agent_run.extras["referrer"] == AutofixReferrer.WEB.value
        assert self.agent_run.extras["stopping_point"] == AutofixStoppingPoint.OPEN_PR.value

    def test_completed_result_matches_run_with_autofix_source(self) -> None:
        self.agent_run.source = "autofix"
        self.agent_run.save(update_fields=["source"])

        deliver_autofix_rca_result(
            organization_id=self.organization.id,
            run_uuid=self.agent_run.run.uuid,
            status="completed",
            result=VALID_RESULT,
            error=None,
        )

        self.agent_run.refresh_from_db()
        assert self.agent_run.extras["status"] == "completed"

    def test_error_status_recorded(self) -> None:
        with patch("sentry.seer.autofix_rca.delivery.logger") as mock_logger:
            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=self.agent_run.run.uuid,
                status="error",
                result=None,
                error="seer exploded",
            )

        mock_logger.warning.assert_called()
        assert "autofix_rca.delivery.no_result" in mock_logger.warning.call_args.args[0]

        self.agent_run.refresh_from_db()
        assert self.agent_run.extras["status"] == "error"
        assert self.agent_run.extras["error_message"] == "seer exploded"
        assert "result" not in self.agent_run.extras

    def test_redelivery_is_idempotent(self) -> None:
        for _ in range(2):
            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=self.agent_run.run.uuid,
                status="completed",
                result=VALID_RESULT,
                error=None,
            )

        self.agent_run.refresh_from_db()
        assert self.agent_run.extras["status"] == "completed"
        assert self.agent_run.extras["result"] == VALID_RESULT

    def test_delivery_claim_uses_row_lock(self) -> None:
        using = router.db_for_write(SeerAgentRun)

        with CaptureQueriesContext(connections[using]) as queries:
            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=self.agent_run.run.uuid,
                status="completed",
                result=VALID_RESULT,
                error=None,
            )

        assert any("FOR UPDATE" in query["sql"] for query in queries)

    def test_completed_status_is_not_overwritten_by_late_error(self) -> None:
        deliver_autofix_rca_result(
            organization_id=self.organization.id,
            run_uuid=self.agent_run.run.uuid,
            status="completed",
            result=VALID_RESULT,
            error=None,
        )
        deliver_autofix_rca_result(
            organization_id=self.organization.id,
            run_uuid=self.agent_run.run.uuid,
            status="error",
            result=None,
            error="late error",
        )

        self.agent_run.refresh_from_db()
        assert self.agent_run.extras["status"] == "completed"
        assert "error_message" not in self.agent_run.extras

    def test_success_after_error_clears_error_message(self) -> None:
        deliver_autofix_rca_result(
            organization_id=self.organization.id,
            run_uuid=self.agent_run.run.uuid,
            status="error",
            result=None,
            error="temporary error",
        )
        deliver_autofix_rca_result(
            organization_id=self.organization.id,
            run_uuid=self.agent_run.run.uuid,
            status="completed",
            result=VALID_RESULT,
            error=None,
        )

        self.agent_run.refresh_from_db()
        assert self.agent_run.extras["status"] == "completed"
        assert "error_message" not in self.agent_run.extras
        assert self.agent_run.extras["result"] == VALID_RESULT

    def test_night_shift_run_is_not_matched(self) -> None:
        seer_run = self.create_seer_run(organization=self.organization, type="feature_run")
        self.create_seer_agent_run(run=seer_run, source="night_shift", group=self.group)

        with patch("sentry.seer.autofix_rca.delivery.logger") as mock_logger:
            deliver_autofix_rca_result(
                organization_id=self.organization.id,
                run_uuid=seer_run.uuid,
                status="completed",
                result=VALID_RESULT,
                error=None,
            )

        mock_logger.warning.assert_called_once()
        assert "autofix_rca.delivery.missing_run" in mock_logger.warning.call_args.args[0]
