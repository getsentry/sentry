from dataclasses import replace
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from django.urls import reverse
from django.utils import timezone
from rest_framework.response import Response

from sentry.onboarding.agentic_progress.model import (
    ConnectExtra,
    ProgressUpdate,
    RunOrigin,
    RunStatus,
    Stage,
    StageStatus,
    apply_update,
)
from sentry.onboarding.agentic_progress.service import OnboardingProgressService
from sentry.testutils.cases import APITestCase


class OrganizationAgenticOnboardingEndpointTest(APITestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(self.user)
        self.service = OnboardingProgressService()

    def test_initialize_without_reporting_code(self) -> None:
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-run-index",
            args=[self.organization.slug],
        )
        payload = {"clientRunId": str(uuid4()), "origin": "onboarding"}
        response = self.client.post(path, payload)
        assert response.status_code == 201, response.content
        assert "onboardingCode" not in response.data
        run = self.service.get(
            run_id=response.data["runId"],
            user_id=self.user.id,
            organization_id=self.organization.id,
        )
        assert run is not None
        assert run.token_hash is None
        resumed = self.client.post(path, payload)
        assert resumed.status_code == 201
        assert resumed.data["runId"] == run.run_id

    def test_run_origin(self) -> None:
        index_path = reverse(
            "sentry-api-0-organization-agentic-onboarding-run-index",
            args=[self.organization.slug],
        )
        payload = {
            "clientRunId": str(uuid4()),
            "onboardingCode": "a1B2c3D4e5",
            "origin": "project_creation",
        }

        with patch(
            "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service",
            return_value=self.service,
        ):
            response = self.client.post(index_path, payload)
            assert response.status_code == 201, response.content
            resumed = self.client.post(index_path, {**payload, "origin": "onboarding"})

        assert resumed.data["runId"] == response.data["runId"]
        run = self.service.get(
            run_id=response.data["runId"],
            user_id=self.user.id,
            organization_id=self.organization.id,
        )
        assert run is not None
        assert run.origin == RunOrigin.PROJECT_CREATION

    def test_rejects_unknown_origin(self) -> None:
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-run-index",
            args=[self.organization.slug],
        )
        response = self.client.post(
            path,
            {"clientRunId": str(uuid4()), "onboardingCode": "a1B2c3D4e5", "origin": "unknown"},
        )
        assert response.status_code == 400
        assert "origin" in response.data

    def test_create_and_update_run(self) -> None:
        index_path = reverse(
            "sentry-api-0-organization-agentic-onboarding-run-index",
            args=[self.organization.slug],
        )
        service_path = (
            "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service"
        )
        with patch(service_path, return_value=self.service):
            response = self.client.post(
                index_path,
                {"clientRunId": str(uuid4()), "onboardingCode": "a1B2c3D4e5"},
            )

        assert response.status_code == 201, response.content
        assert response.data["onboardingCode"] == "a1B2c3D4e5"
        assert response.data["sequence"] == 0

        status_path = reverse(
            "sentry-api-0-organization-agentic-onboarding-status",
            args=[self.organization.slug],
        )
        with patch(service_path, return_value=self.service):
            response = self.client.post(
                status_path,
                {
                    "schemaVersion": 1,
                    "runToken": "a1B2c3D4e5",
                    "stage": "create_project",
                    "status": "completed",
                    "eventNote": "Project already existed.",
                    "extra": {"projectSlugs": ["frontend", "backend"]},
                },
            )

        assert response.status_code == 200, response.content
        assert response.data["sequence"] == 1
        assert response.data["stages"][0]["status"] == "bypassed"
        assert response.data["stages"][1]["status"] == "bypassed"
        assert response.data["stages"][2]["status"] == "completed"
        assert response.data["stages"][2]["extra"] == {"projectSlugs": ["frontend", "backend"]}

    def test_status_rejects_unknown_run(self) -> None:
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-status",
            args=[self.organization.slug],
        )
        with patch(
            "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service",
            return_value=self.service,
        ):
            response = self.client.post(
                path,
                {
                    "schemaVersion": 1,
                    "runToken": "abcdefghij",
                    "stage": "connect_mcp",
                    "status": "completed",
                },
            )

        assert response.status_code == 404
        assert response.data == {"detail": "Onboarding run not found"}

    def test_registration_rejects_mismatched_code(self) -> None:
        client_run_id = str(uuid4())
        self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=client_run_id,
            onboarding_code="abcdefghij",
        )
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-run-index",
            args=[self.organization.slug],
        )

        with patch(
            "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service",
            return_value=self.service,
        ):
            response = self.client.post(
                path,
                {"clientRunId": client_run_id, "onboardingCode": "klmnopqrst"},
            )

        assert response.status_code == 404
        assert response.data == {"detail": "Onboarding run not found"}

    def test_registration_rejects_code_reserved_by_another_run(self) -> None:
        self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="abcdefghij",
        )
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-run-index",
            args=[self.organization.slug],
        )

        with patch(
            "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service",
            return_value=self.service,
        ):
            response = self.client.post(
                path,
                {"clientRunId": str(uuid4()), "onboardingCode": "abcdefghij"},
            )

        assert response.status_code == 409
        assert response.data == {"detail": "Onboarding code is unavailable"}

    def test_status_requires_event_note_for_failure(self) -> None:
        _, token = self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="abcdefghij",
        )
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-status",
            args=[self.organization.slug],
        )
        with patch(
            "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service",
            return_value=self.service,
        ):
            response = self.client.post(
                path,
                {
                    "schemaVersion": 1,
                    "runToken": token,
                    "stage": "create_project",
                    "status": "failed",
                },
            )

        assert response.status_code == 400
        assert response.data == {"eventNote": ["Failed stages require an event note"]}

    def test_status_returns_conflict_for_terminal_run(self) -> None:
        _, token = self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="abcdefghij",
        )
        assert token == "abcdefghij"
        self.service.update(
            token=token,
            user_id=self.user.id,
            organization_id=self.organization.id,
            update=ProgressUpdate(
                stage=Stage.CHECK_STACK_TRACE_QUALITY,
                status=StageStatus.SKIPPED,
                run_status=RunStatus.COMPLETED,
            ),
        )

        response = self._post_status(token)

        assert response.status_code == 409
        assert response.data == {"detail": "Onboarding run is terminal"}

    def test_status_returns_gone_for_expired_run(self) -> None:
        run, token = self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="abcdefghij",
        )
        assert token == "abcdefghij"
        expired = replace(run, expires_at=timezone.now() - timedelta(seconds=1))
        self.service.redis.set(
            self.service._state_key(run.run_id),
            self.service._serialize(expired),
            ex=60,
        )

        response = self._post_status(token)

        assert response.status_code == 410
        assert response.data == {"detail": "Onboarding run has expired"}

    def _post_status(self, token: str, **overrides: object) -> Response:
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-status",
            args=[self.organization.slug],
        )
        with patch(
            "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service",
            return_value=self.service,
        ):
            response: Response = self.client.post(
                path,
                {
                    "schemaVersion": 1,
                    "runToken": token,
                    "stage": "connect_mcp",
                    "status": "completed",
                    **overrides,
                },
            )
            return response

    def test_status_rejects_backend_derived_bypassed_status(self) -> None:
        _, token = self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="abcdefghij",
        )
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-status",
            args=[self.organization.slug],
        )

        with patch(
            "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service",
            return_value=self.service,
        ):
            response = self.client.post(
                path,
                {
                    "schemaVersion": 1,
                    "runToken": token,
                    "stage": "analyze_project",
                    "status": "bypassed",
                },
            )

        assert response.status_code == 400
        assert "status" in response.data

    def test_status_does_not_expose_domain_validation_details(self) -> None:
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-status",
            args=[self.organization.slug],
        )
        with patch(
            "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service"
        ) as get_service:
            get_service.return_value.update.side_effect = ValueError("sensitive internal context")
            response = self.client.post(
                path,
                {
                    "schemaVersion": 1,
                    "runToken": "abcdefghij",
                    "stage": "connect_mcp",
                    "status": "completed",
                },
            )

        assert response.status_code == 400
        assert response.data == {"detail": "Invalid onboarding progress update"}

    def test_records_each_stage_status_once(self) -> None:
        run, token = self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="abcdefghij",
            origin=RunOrigin.PROJECT_CREATION,
        )
        skipped_run, skipped_token = self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="klmnopqrst",
        )
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-status",
            args=[self.organization.slug],
        )
        service_path = (
            "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service"
        )
        payloads = [
            {"schemaVersion": 1, "runToken": token, "stage": "create_project", "status": "active"},
            {"schemaVersion": 1, "runToken": token, "stage": "create_project", "status": "active"},
            {"schemaVersion": 1, "runToken": token, "stage": "create_project", "status": "waiting"},
            {
                "schemaVersion": 1,
                "runToken": token,
                "stage": "create_project",
                "status": "failed",
                "eventNote": "The stage failed.",
            },
            {
                "schemaVersion": 1,
                "runToken": token,
                "stage": "create_project",
                "status": "completed",
                "extra": {"projectSlugs": ["frontend"]},
            },
            {
                "schemaVersion": 1,
                "runToken": token,
                "stage": "create_project",
                "status": "completed",
                "extra": {"projectSlugs": ["backend"]},
            },
            {
                "schemaVersion": 1,
                "runToken": skipped_token,
                "stage": "check_stack_trace_quality",
                "status": "skipped",
            },
        ]

        with (
            patch(service_path, return_value=self.service),
            patch("sentry.analytics.record") as record_analytics,
        ):
            responses = [self.client.post(path, payload) for payload in payloads]

        assert [response.status_code for response in responses] == [200] * 7
        assert [response.data["sequence"] for response in responses] == [1, 1, 2, 3, 4, 5, 1]
        assert [call.args[0].type for call in record_analytics.call_args_list] == [
            "agentic_onboarding.stage_status_changed",
            "agentic_onboarding.stage_status_changed",
            "agentic_onboarding.stage_status_changed",
            "agentic_onboarding.stage_status_changed",
            "agentic_onboarding.stage_completed",
            "agentic_onboarding.stage_status_changed",
        ]
        assert [call.args[0].serialize() for call in record_analytics.call_args_list] == [
            {
                "user_id": self.user.id,
                "organization_id": self.organization.id,
                "run_id": run.run_id,
                "origin": run.origin,
                "stage": "create_project",
                "status": status_value,
                "connection_method": None,
            }
            for status_value in ["active", "waiting", "failed", "completed", "completed"]
        ] + [
            {
                "user_id": self.user.id,
                "organization_id": self.organization.id,
                "run_id": skipped_run.run_id,
                "origin": skipped_run.origin,
                "stage": "check_stack_trace_quality",
                "status": "skipped",
                "connection_method": None,
            }
        ]

    def test_records_completed_run_once(self) -> None:
        run, token = self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="abcdefghij",
            origin=RunOrigin.ONBOARDING,
        )
        assert token == "abcdefghij"
        self.service.update(
            token=token,
            user_id=self.user.id,
            organization_id=self.organization.id,
            update=ProgressUpdate(
                stage=Stage.CHECK_STACK_TRACE_QUALITY,
                status=StageStatus.COMPLETED,
            ),
        )
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-status",
            args=[self.organization.slug],
        )
        payload = {
            "schemaVersion": 1,
            "runToken": token,
            "stage": "check_stack_trace_quality",
            "status": "completed",
            "runStatus": "completed",
        }

        with (
            patch(
                "sentry.api.endpoints.organization_agentic_onboarding."
                "get_onboarding_progress_service",
                return_value=self.service,
            ),
            patch("sentry.analytics.record") as record_analytics,
        ):
            response = self.client.post(path, payload)
            duplicate_response = self.client.post(path, payload)

        assert response.status_code == 200
        assert duplicate_response.status_code == 200
        record_analytics.assert_called_once()
        event = record_analytics.call_args.args[0]
        assert event.type == "agentic_onboarding.run_completed"
        assert event.serialize() == {
            "user_id": self.user.id,
            "organization_id": self.organization.id,
            "run_id": run.run_id,
            "origin": run.origin,
            "status": "completed",
            "connection_method": None,
        }

    def _assert_connect_stage_records_method(self, stage_name: str, expected_method: str) -> None:
        _, token = self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="abcdefghij",
        )
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-status",
            args=[self.organization.slug],
        )
        with (
            patch(
                "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service",
                return_value=self.service,
            ),
            patch("sentry.api.endpoints.organization_agentic_onboarding.metrics") as mock_metrics,
        ):
            response = self.client.post(
                path,
                {
                    "schemaVersion": 1,
                    "runToken": token,
                    "stage": stage_name,
                    "status": "completed",
                    "extra": {"method": expected_method},
                },
            )

        assert response.status_code == 200, response.content
        assert response.data["stages"][0]["status"] == "completed"
        assert response.data["stages"][0]["extra"] == {"method": expected_method}
        mock_metrics.incr.assert_called_once_with(
            "agentic_onboarding.connect_stage_input",
            tags={"input": stage_name},
        )

    def test_connect_agent_alias_records_cli_method(self) -> None:
        self._assert_connect_stage_records_method("connect_agent", "cli")

    def test_connect_mcp_records_mcp_method(self) -> None:
        self._assert_connect_stage_records_method("connect_mcp", "mcp")

    def test_connect_stage_rejects_unknown_method(self) -> None:
        _, token = self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="abcdefghij",
        )
        assert token is not None
        response = self._post_status(token, stage="connect_mcp", extra={"method": "browser"})

        assert response.status_code == 400

    def test_connect_stage_rejects_unknown_extra_fields(self) -> None:
        _, token = self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="abcdefghij",
        )
        assert token is not None
        response = self._post_status(
            token, stage="connect_mcp", extra={"method": "cli", "unknown": True}
        )

        assert response.status_code == 400

    def test_reader_handles_stored_connect_extra(self) -> None:
        # Seed a run with ConnectExtra directly in Redis to verify deserialization
        # works independently of what the endpoint currently accepts on write.
        run, token = self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="abcdefghij",
        )
        seeded_run = apply_update(
            run,
            ProgressUpdate(
                stage=Stage.CONNECT_MCP,
                status=StageStatus.COMPLETED,
                extra=ConnectExtra(method="cli"),
            ),
            timezone.now(),
        )
        self.service.redis.set(
            self.service._state_key(run.run_id),
            self.service._serialize(seeded_run),
            ex=300,
        )

        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-status",
            args=[self.organization.slug],
        )
        service_path = (
            "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service"
        )
        with (
            patch(service_path, return_value=self.service),
            patch("sentry.analytics.record") as record_analytics,
        ):
            response = self.client.post(
                path,
                {
                    "schemaVersion": 1,
                    "runToken": token,
                    "stage": "check_stack_trace_quality",
                    "status": "completed",
                    "runStatus": "completed",
                },
            )

        assert response.status_code == 200, response.content
        connection_methods = [
            call.args[0].serialize().get("connection_method")
            for call in record_analytics.call_args_list
        ]
        assert all(method == "cli" for method in connection_methods)
