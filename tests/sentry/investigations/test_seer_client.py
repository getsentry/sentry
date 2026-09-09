from __future__ import annotations

from unittest import mock
from uuid import UUID, uuid4

import orjson
import pytest
from django.test import override_settings

from sentry.investigations.seer_client import (
    create_investigation_orchestration_run,
    dispatch_investigation_orchestration_command,
    get_investigation_orchestration_run,
)
from sentry.investigations.services.orchestration import create_agentic_manual_investigation
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerRunType
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.testutils.cases import TestCase


class InvestigationOrchestrationSeerClientTest(TestCase):
    @override_settings(SEER_API_SHARED_SECRET="investigation-protocol-test-secret")
    @mock.patch("sentry.investigations.seer_client.investigation_connection_pool")
    @mock.patch("sentry.investigations.seer_client.get_monitoring_provider_connections")
    def test_create_and_command_use_the_protocol_contract(
        self,
        get_connections: mock.Mock,
        pool: mock.Mock,
    ) -> None:
        investigation, run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[self.project.id],
            filters={},
        )
        provider = mock.Mock()
        provider.dict.return_value = {
            "type": "header_auth",
            "provider_key": "example",
            "url": "https://example.invalid",
        }
        get_connections.return_value = [provider]
        run.update(
            seer_run=self.create_seer_run(
                organization=self.organization,
                type=SeerRunType.INVESTIGATION,
                seer_run_state_id=8128,
            )
        )
        run.refresh_from_db()
        command = self.create_investigation_orchestration_command(
            orchestration_run=run,
            request_id=uuid4(),
            actor_id=self.user.id,
            expected_workflow_version=1,
            type="retry",
            payload={"target": "run"},
        )
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id,
            user_id=self.user.id,
        )
        pool.host = "seer"
        pool.port = 9091
        pool.scheme = "http"
        pool.urlopen.side_effect = [
            mock.Mock(
                status=200,
                data=b'{"runId":8128,"created":true,"projection":{}}',
            ),
            mock.Mock(
                status=200,
                data=b'{"runId":8128,"created":false,"projection":{}}',
            ),
            mock.Mock(
                status=200,
                data=orjson.dumps(
                    {
                        "runId": 8128,
                        "requestId": str(command.request_id),
                        "accepted": True,
                        "duplicate": False,
                        "workflowVersion": 2,
                        "projection": {},
                    }
                ),
            ),
        ]

        created = create_investigation_orchestration_run(
            run,
            viewer_context=viewer_context,
        )
        replayed = create_investigation_orchestration_run(
            run,
            viewer_context=viewer_context,
        )
        accepted = dispatch_investigation_orchestration_command(
            command,
            viewer_context=viewer_context,
        )

        assert created == {"runId": 8128, "created": True, "projection": {}}
        assert replayed == {"runId": 8128, "created": False, "projection": {}}
        create_request = pool.urlopen.call_args_list[0]
        replay_request = pool.urlopen.call_args_list[1]
        assert create_request.args[:2] == ("POST", "/v1/automation/investigations")
        assert replay_request.args[:2] == ("POST", "/v1/automation/investigations")
        create_body = orjson.loads(create_request.kwargs["body"])
        replay_body = orjson.loads(replay_request.kwargs["body"])
        assert create_body["requestId"] == replay_body["requestId"]
        assert str(UUID(create_body["requestId"])) == create_body["requestId"]
        assert create_body["investigationId"] == investigation.id
        assert create_body["source"] == run.source
        assert create_body["activeTimeBudgetSeconds"] == 1800
        assert create_body["monitoringProviders"] == [provider.dict.return_value]
        assert "Authorization" in create_request.kwargs["headers"]
        assert "X-Viewer-Context" in create_request.kwargs["headers"]

        assert accepted["runId"] == 8128
        command_request = pool.urlopen.call_args_list[2]
        assert command_request.args[:2] == (
            "POST",
            "/v1/automation/investigations/8128/commands",
        )
        command_body = orjson.loads(command_request.kwargs["body"])
        assert command_body == {
            "requestId": str(command.request_id),
            "expectedWorkflowVersion": 1,
            "command": {"type": "retry", "target": "run"},
            "monitoringProviders": [provider.dict.return_value],
        }
        assert "Authorization" in command_request.kwargs["headers"]
        assert "X-Viewer-Context" in command_request.kwargs["headers"]

        pool.urlopen.side_effect = None
        pool.urlopen.return_value = mock.Mock(
            status=200,
            data=orjson.dumps(
                {
                    "runId": 8128,
                    "requestId": str(command.request_id),
                    "duplicate": False,
                    "workflowVersion": 2,
                    "projection": {},
                }
            ),
        )
        with pytest.raises(SeerApiError):
            dispatch_investigation_orchestration_command(
                command,
                viewer_context=viewer_context,
            )

    def test_create_rejects_a_mismatched_viewer_organization(self) -> None:
        _, run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[],
            filters={},
        )

        with pytest.raises(SeerApiError):
            create_investigation_orchestration_run(
                run,
                viewer_context=SeerViewerContext(
                    organization_id=self.create_organization().id,
                    user_id=self.user.id,
                ),
            )

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_get_uses_signed_viewer_context_and_validates_the_response(
        self,
        make_request: mock.Mock,
    ) -> None:
        make_request.return_value = mock.Mock(
            status=200,
            data=b'{"runId":8128,"created":false,"projection":{}}',
        )
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id,
            user_id=self.user.id,
        )
        _, run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[],
            filters={},
        )
        run.update(
            seer_run=self.create_seer_run(
                organization=self.organization,
                type=SeerRunType.INVESTIGATION,
                seer_run_state_id=8128,
            )
        )

        result = get_investigation_orchestration_run(run, viewer_context=viewer_context)

        assert result == {"runId": 8128, "created": False, "projection": {}}
        assert make_request.call_args.args[1] == "/v1/automation/investigations/8128"
        assert make_request.call_args.kwargs == {
            "body": b"",
            "method": "GET",
            "viewer_context": viewer_context,
        }

        make_request.return_value = mock.Mock(status=200, data=b"[]")
        with pytest.raises(SeerApiError):
            get_investigation_orchestration_run(run, viewer_context=viewer_context)

        make_request.return_value = mock.Mock(status=503, data=b"{}")
        with pytest.raises(SeerApiError):
            get_investigation_orchestration_run(run, viewer_context=viewer_context)

    @mock.patch("sentry.investigations.seer_client.make_signed_seer_api_request")
    def test_get_rejects_a_mismatched_viewer_organization(self, make_request: mock.Mock) -> None:
        _, run = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[],
            filters={},
        )

        with pytest.raises(SeerApiError):
            get_investigation_orchestration_run(
                run,
                viewer_context=SeerViewerContext(
                    organization_id=self.create_organization().id,
                    user_id=self.user.id,
                ),
            )

        assert make_request.call_count == 0
