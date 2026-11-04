from uuid import uuid4

from sentry.hybridcloud.rpc.service import dispatch_to_local_service
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmember import InviteStatus
from sentry.onboarding.agentic_progress.service import get_onboarding_progress_service
from sentry.organizations.services.organization.service import organization_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode_of


@all_silo_test
class AgentOnboardingRunTest(TestCase):
    def test_retries_resume_the_same_cell_owned_run(self) -> None:
        organization = self.create_organization(owner=self.user)
        client_run_id = str(uuid4())
        first = organization_service.create_agent_onboarding_run(
            user_id=self.user.id,
            organization_id=organization.id,
            client_run_id=client_run_id,
            onboarding_code="a1B2c3D4e5",
        )
        replay = organization_service.create_agent_onboarding_run(
            user_id=self.user.id,
            organization_id=organization.id,
            client_run_id=client_run_id,
            onboarding_code="a1B2c3D4e5",
        )
        assert first is not None
        assert first == replay
        assert first.onboarding_run_code == "a1B2c3D4e5"
        assert first.onboarding_run_code not in repr(first)
        with assume_test_silo_mode_of(Organization):
            run = get_onboarding_progress_service().get(
                run_id=first.run_id, user_id=self.user.id, organization_id=organization.id
            )
        assert run is not None
        assert run.client_run_id == client_run_id
        assert run.origin is None

    def test_rejects_a_nonmember(self) -> None:
        organization = self.create_organization()
        assert (
            organization_service.create_agent_onboarding_run(
                user_id=self.user.id,
                organization_id=organization.id,
                client_run_id=str(uuid4()),
                onboarding_code="a1B2c3D4e5",
            )
            is None
        )

    def test_rejects_inactive_organization(self) -> None:
        organization = self.create_organization(
            owner=self.user, status=OrganizationStatus.PENDING_DELETION
        )
        assert (
            organization_service.create_agent_onboarding_run(
                user_id=self.user.id,
                organization_id=organization.id,
                client_run_id=str(uuid4()),
                onboarding_code="a1B2c3D4e5",
            )
            is None
        )

    def test_rejects_unapproved_membership(self) -> None:
        organization = self.create_organization()
        self.create_member(
            organization=organization,
            user=self.user,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )
        assert (
            organization_service.create_agent_onboarding_run(
                user_id=self.user.id,
                organization_id=organization.id,
                client_run_id=str(uuid4()),
                onboarding_code="a1B2c3D4e5",
            )
            is None
        )

    def test_rpc_serialization_preserves_the_correlation_code(self) -> None:
        organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode_of(Organization):
            response = dispatch_to_local_service(
                "organization",
                "create_agent_onboarding_run",
                {
                    "user_id": self.user.id,
                    "organization_id": organization.id,
                    "client_run_id": str(uuid4()),
                    "onboarding_code": "a1B2c3D4e5",
                },
            )
        assert response["value"]["run_id"]
        assert response["value"]["onboarding_run_code"] == "a1B2c3D4e5"
