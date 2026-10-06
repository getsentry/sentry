from unittest.mock import patch
from uuid import uuid4

from django.urls import reverse

from sentry.api.serializers import serialize
from sentry.api.serializers.models.agentic_onboarding import AgenticOnboardingRunSerializer
from sentry.onboarding.agentic_progress.model import ProgressUpdate, RunStatus, Stage, StageStatus
from sentry.onboarding.agentic_progress.service import OnboardingProgressService
from sentry.testutils.cases import APITestCase


class OrganizationAgenticOnboardingRunDetailsEndpointTest(APITestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(self.user)
        self.service = OnboardingProgressService()

    def test_get_and_cancel_run(self) -> None:
        run, _ = self.service.create_or_resume(
            user_id=self.user.id,
            organization_id=self.organization.id,
            client_run_id=str(uuid4()),
            onboarding_code="abcdefghij",
        )
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-run-details",
            args=[self.organization.slug, run.run_id],
        )
        service_path = (
            "sentry.api.endpoints.organization_agentic_onboarding_run_details."
            "get_onboarding_progress_service"
        )
        with patch(service_path, return_value=self.service):
            expected_fetched = serialize(
                run,
                self.user,
                AgenticOnboardingRunSerializer(),
            )
            fetched = self.client.get(path)
            cancelled = self.client.delete(path)

        cancelled_run = self.service.get(
            run_id=run.run_id,
            user_id=self.user.id,
            organization_id=self.organization.id,
        )
        assert cancelled_run is not None
        expected_cancelled = serialize(
            cancelled_run,
            self.user,
            AgenticOnboardingRunSerializer(),
        )

        assert fetched.status_code == 200
        assert fetched.data == expected_fetched
        assert cancelled.status_code == 200
        assert cancelled.data == expected_cancelled

    def test_get_unknown_run(self) -> None:
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-run-details",
            args=[self.organization.slug, "0" * 32],
        )
        with patch(
            "sentry.api.endpoints.organization_agentic_onboarding_run_details."
            "get_onboarding_progress_service",
            return_value=self.service,
        ):
            response = self.client.get(path)

        assert response.status_code == 404
        assert response.data == {"detail": "Onboarding run not found"}

    def test_cancel_unknown_run(self) -> None:
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-run-details",
            args=[self.organization.slug, "0" * 32],
        )
        with patch(
            "sentry.api.endpoints.organization_agentic_onboarding_run_details."
            "get_onboarding_progress_service",
            return_value=self.service,
        ):
            response = self.client.delete(path)

        assert response.status_code == 404
        assert response.data == {"detail": "Onboarding run not found"}

    def test_cancel_terminal_run_is_invalid(self) -> None:
        run, token = self.service.create_or_resume(
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
        path = reverse(
            "sentry-api-0-organization-agentic-onboarding-run-details",
            args=[self.organization.slug, run.run_id],
        )
        with patch(
            "sentry.api.endpoints.organization_agentic_onboarding_run_details."
            "get_onboarding_progress_service",
            return_value=self.service,
        ):
            response = self.client.delete(path)

        assert response.status_code == 409
        assert response.data == {"detail": "Onboarding run is terminal"}
