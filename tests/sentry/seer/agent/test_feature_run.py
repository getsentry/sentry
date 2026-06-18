from unittest.mock import Mock, patch

import pytest

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.feature_run import start_feature_run
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.testutils.cases import TestCase


class StartFeatureRunTest(TestCase):
    def _outbox_for(self, run: SeerRun) -> CellOutbox | None:
        return CellOutbox.objects.filter(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=run.id
        ).first()

    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_flush_false_enqueues_without_dispatch(self, mock_request: Mock) -> None:
        run = start_feature_run(
            organization=self.organization,
            feature_id="night_shift",
            payload={"candidates": [1, 2]},
            viewer_context=SeerViewerContext(organization_id=self.organization.id),
            flush=False,
        )

        mock_request.assert_not_called()
        assert run.type == SeerRunType.FEATURE_RUN
        assert run.mirror_status == SeerRunMirrorStatus.PENDING
        assert run.seer_run_state_id is None

        outbox = self._outbox_for(run)
        assert outbox is not None
        body = outbox.payload["body"]
        assert body["feature_id"] == "night_shift"
        assert body["ref"] == str(run.uuid)
        assert outbox.payload["viewer_context"] == {"organization_id": self.organization.id}

    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_flush_true_dispatches_inline_and_mirrors(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 4242}))

        run = start_feature_run(
            organization=self.organization,
            feature_id="night_shift",
            payload={},
            flush=True,
        )

        assert run.mirror_status == SeerRunMirrorStatus.LIVE
        assert run.seer_run_state_id == 4242
        sent_body = mock_request.call_args.args[0]
        assert sent_body["feature_id"] == "night_shift"
        assert sent_body["external_idempotency_key"] == str(run.uuid)
        # Drained inline, so the row is consumed.
        assert self._outbox_for(run) is None

    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_flush_true_dispatch_failure_marks_failed_and_raises(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=400)

        with pytest.raises(SeerApiError):
            start_feature_run(
                organization=self.organization,
                feature_id="night_shift",
                payload={},
                flush=True,
            )

        run = SeerRun.objects.get(organization=self.organization, type=SeerRunType.FEATURE_RUN)
        assert run.mirror_status == SeerRunMirrorStatus.FAILED
        assert run.seer_run_state_id is None

    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_seer_agent_client_method_delegates(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 7}))

        with self.feature("organizations:gen-ai-features"):
            client = SeerAgentClient(self.organization, self.user)
            run = client.start_feature_run(feature_id="night_shift", payload={})

        assert run.type == SeerRunType.FEATURE_RUN
        assert run.mirror_status == SeerRunMirrorStatus.LIVE
        assert run.seer_run_state_id == 7
        assert run.user_id == self.user.id
