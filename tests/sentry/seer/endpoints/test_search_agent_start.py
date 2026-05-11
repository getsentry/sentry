from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.seer.endpoints.search_agent_start import send_search_agent_start_request
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.testutils.cases import TestCase


class SendSearchAgentStartRequestTest(TestCase):
    def test_outbox_path_creates_run_and_enqueues_outbox(self) -> None:
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id, user_id=self.user.id
        )

        with self.feature("organizations:seer-run-mirror"):
            result = send_search_agent_start_request(
                organization=self.organization,
                user_id=self.user.id,
                project_ids=[self.project.id],
                natural_language_query="errors today",
                strategy="Issues",
                viewer_context=viewer_context,
            )

        assert isinstance(result, SeerRun)
        assert result.type == SeerRunType.ASSISTED_QUERY
        assert result.mirror_status == SeerRunMirrorStatus.PENDING
        assert result.seer_run_state_id is None
        assert result.user_id == self.user.id

        outbox = CellOutbox.objects.get(
            category=OutboxCategory.SEER_RUN_CREATE,
            object_identifier=result.id,
        )
        assert outbox.shard_scope == OutboxScope.SEER_SCOPE
        assert outbox.shard_identifier == result.id
        assert outbox.payload["body"]["natural_language_query"] == "errors today"
