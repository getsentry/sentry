from unittest.mock import patch

from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.organizations.services.organization import organization_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

FEATURE_FLAG = "organizations:service-accounts"


@control_silo_test
class OrganizationServiceAccountIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-service-accounts"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_flag_off_returns_404(self) -> None:
        self.create_project(organization=self.organization, teams=[self.team])
        with (
            patch(
                "sentry.organizations.services.organization.serial.serialize_project"
            ) as serialize_project,
            patch(
                "sentry.organizations.services.organization.serial.serialize_rpc_team"
            ) as serialize_team,
            patch.object(organization_service, "get_active_project_ids") as project_ids,
        ):
            self.get_error_response(self.organization.slug, status_code=404)

        serialize_project.assert_not_called()
        serialize_team.assert_not_called()
        project_ids.assert_not_called()

    def test_list_does_not_load_projects_or_teams(self) -> None:
        self.create_project(organization=self.organization, teams=[self.team])
        with (
            self.feature(FEATURE_FLAG),
            patch(
                "sentry.organizations.services.organization.serial.serialize_project"
            ) as serialize_project,
            patch(
                "sentry.organizations.services.organization.serial.serialize_rpc_team"
            ) as serialize_team,
            patch.object(organization_service, "get_active_project_ids") as project_ids,
        ):
            self.get_success_response(self.organization.slug)

        serialize_project.assert_not_called()
        serialize_team.assert_not_called()
        project_ids.assert_not_called()

    def test_create_requires_org_admin(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        with self.feature(FEATURE_FLAG):
            self.get_error_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                status_code=403,
            )

    def test_create_rejects_scopes_caller_lacks(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = self.create_user_auth_token(user=self.user, scope_list=["org:admin"])
        url = reverse(self.endpoint, args=[self.organization.slug])

        with self.feature(FEATURE_FLAG):
            response = self.client.post(
                url,
                data={"name": "nightly-triage", "scopes": ["event:read"]},
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
            )

        assert response.status_code == 400
        assert "event:read" in str(response.data["detail"])

    def test_create_rejects_projects_from_other_orgs(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            other_project = self.create_project(organization=self.create_organization())

        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                projectIds=[other_project.id],
                status_code=400,
            )

        assert str(other_project.id) in str(response.data["detail"])

    def test_owner_can_grant_projects_outside_their_teams(self) -> None:
        self.assert_owner_can_grant_projects(self.organization.slug)

    def test_owner_can_grant_projects_by_organization_id(self) -> None:
        self.assert_owner_can_grant_projects(self.organization.id)

    def assert_owner_can_grant_projects(self, organization_id_or_slug: int | str) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            project = self.create_project(
                organization=self.organization,
                teams=[self.create_team(organization=self.organization)],
            )

        with (
            self.feature(FEATURE_FLAG),
            patch(
                "sentry.organizations.services.organization.serial.serialize_project"
            ) as serialize_project,
            patch(
                "sentry.organizations.services.organization.serial.serialize_rpc_team"
            ) as serialize_team,
        ):
            response = self.get_success_response(
                organization_id_or_slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                projectIds=[project.id],
                status_code=201,
            )

        assert response.data["projectIds"] == [str(project.id)]
        serialize_project.assert_not_called()
        serialize_team.assert_not_called()

    def test_create_rejects_inactive_projects(self) -> None:
        inactive_projects = [
            self.create_project(organization=self.organization, status=status)
            for status in (
                ObjectStatus.PENDING_DELETION,
                ObjectStatus.DELETION_IN_PROGRESS,
                ObjectStatus.DISABLED,
            )
        ]

        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                projectIds=[project.id for project in inactive_projects],
                status_code=400,
            )

        for project in inactive_projects:
            assert str(project.id) in str(response.data["detail"]["projectIds"])


@control_silo_test
class OrganizationServiceAccountDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-service-account-details"

    def test_owner_can_grant_projects_outside_their_teams(self) -> None:
        self.assert_owner_can_grant_projects(self.organization.slug)

    def test_owner_can_grant_projects_by_organization_id(self) -> None:
        self.assert_owner_can_grant_projects(self.organization.id)

    def assert_owner_can_grant_projects(self, organization_id_or_slug: int | str) -> None:
        self.login_as(self.user)
        project = self.create_project(
            organization=self.organization,
            teams=[self.create_team(organization=self.organization)],
        )

        with (
            self.feature(FEATURE_FLAG),
            patch(
                "sentry.organizations.services.organization.serial.serialize_project"
            ) as serialize_project,
            patch(
                "sentry.organizations.services.organization.serial.serialize_rpc_team"
            ) as serialize_team,
        ):
            response = self.get_success_response(
                organization_id_or_slug,
                "1",
                method="put",
                projectIds=[project.id],
            )

        assert response.data["projectIds"] == [str(project.id)]
        serialize_project.assert_not_called()
        serialize_team.assert_not_called()

    def test_update_rejects_inactive_projects(self) -> None:
        self.login_as(self.user)
        inactive_projects = [
            self.create_project(organization=self.organization, status=status)
            for status in (
                ObjectStatus.PENDING_DELETION,
                ObjectStatus.DELETION_IN_PROGRESS,
                ObjectStatus.DISABLED,
            )
        ]

        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                "1",
                method="put",
                projectIds=[project.id for project in inactive_projects],
                status_code=400,
            )

        for project in inactive_projects:
            assert str(project.id) in str(response.data["detail"]["projectIds"])
