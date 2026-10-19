from django.urls import reverse

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
        self.get_error_response(self.organization.slug, status_code=404)

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
        with assume_test_silo_mode(SiloMode.CELL):
            project = self.create_project(
                organization=self.organization,
                teams=[self.create_team(organization=self.organization)],
            )

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(
                self.organization.slug,
                method="post",
                name="nightly-triage",
                scopes=["event:read"],
                projectIds=[project.id],
                status_code=201,
            )

        assert response.data["projectIds"] == [str(project.id)]
