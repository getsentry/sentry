from dataclasses import replace
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from django.urls import reverse
from django.utils import timezone
from rest_framework.response import Response

from sentry.onboarding.agentic_progress.model import ProgressUpdate, RunStatus, Stage, StageStatus
from sentry.onboarding.agentic_progress.service import OnboardingProgressService
from sentry.testutils.cases import APITestCase


class OrganizationAgenticOnboardingEndpointTest(APITestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(self.user)
        self.service = OnboardingProgressService()

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
                    "projectSlugs": ["frontend", "backend"],
                },
            )

        assert response.status_code == 200, response.content
        assert response.data["sequence"] == 1
        assert response.data["stages"][0]["status"] == "bypassed"
        assert response.data["stages"][1]["status"] == "bypassed"
        assert response.data["stages"][2]["status"] == "completed"
        assert response.data["projectSlugs"] == ["frontend", "backend"]
        assert response.data["issueIds"] == []

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
        expired = replace(run, expires_at=timezone.now() - timedelta(seconds=1))
        self.service.redis.set(
            self.service._state_key(run.run_id),
            self.service._serialize(expired),
            ex=60,
        )

        response = self._post_status(token)

        assert response.status_code == 410
        assert response.data == {"detail": "Onboarding run has expired"}

    def _post_status(self, token: str) -> Response:
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-status",
            args=[self.organization.slug],
        )
        with patch(
            "sentry.api.endpoints.organization_agentic_onboarding.get_onboarding_progress_service",
            return_value=self.service,
        ):
            return self.client.post(
                path,
                {
                    "schemaVersion": 1,
                    "runToken": token,
                    "stage": "connect_mcp",
                    "status": "completed",
                },
            )

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
