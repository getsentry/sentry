from rest_framework.test import APIClient

from sentry.models.apitoken import ApiToken
from sentry.models.organizationmember import OrganizationMember
from sentry.models.serviceaccount import ServiceAccount
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode

FEATURE = "organizations:service-account-principals-poc"


class OrganizationServiceAccountPrincipalPocTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/service-account-principal-poc/"

    def test_create_and_authenticate_as_typed_principal(self) -> None:
        team = self.create_team(organization=self.organization, slug="deploys")

        with self.feature(FEATURE):
            created = self.client.post(
                self.url,
                data={
                    "name": "Deploy bot",
                    "role": "member",
                    "teams": [team.slug],
                    "scopes": ["org:read", "project:read"],
                },
                format="json",
            )

        assert created.status_code == 201, created.content
        assert created.data["identifier"].startswith("service_account:")
        assert created.data["principal"]["type"] == "service_account"
        assert created.data["member"]["teams"] == [team.slug]
        assert created.data["token"].startswith("sntryu_")

        account_id = int(created.data["principal"]["id"])
        with assume_test_silo_mode(SiloMode.CONTROL):
            account = ServiceAccount.objects.get(id=account_id)
            token = ApiToken.objects.get(service_account=account)
        member = OrganizationMember.objects.get(
            organization=self.organization,
            service_account_id=account_id,
        )

        assert member.user_id is None
        assert token.user_id is None

        with self.feature(FEATURE):
            inspected = APIClient().get(
                self.url,
                HTTP_AUTHORIZATION=f"Bearer {created.data['token']}",
            )

        assert inspected.status_code == 200, inspected.content
        assert inspected.data["identifier"] == f"service_account:{account_id}"
        assert inspected.data["principal"] == {
            "type": "service_account",
            "id": str(account_id),
            "name": "Deploy bot",
        }
        assert inspected.data["member"]["role"] == "member"
        assert inspected.data["member"]["teams"] == [team.slug]
        assert inspected.data["tokenScopes"] == ["org:read", "project:read"]
        assert set(inspected.data["effectiveScopes"]) <= set(inspected.data["memberScopes"])
        assert inspected.data["viewerContext"] == {
            "actorIdentifier": f"service_account:{account_id}",
            "userId": None,
        }

    def test_service_account_token_is_rejected_by_unrelated_endpoints(self) -> None:
        with self.feature(FEATURE):
            created = self.client.post(
                self.url,
                data={"name": "Deploy bot", "scopes": ["org:read"]},
                format="json",
            )

        response = APIClient().get(
            f"/api/0/organizations/{self.organization.slug}/projects/",
            HTTP_AUTHORIZATION=f"Bearer {created.data['token']}",
        )

        assert response.status_code == 401

    def test_feature_flag_is_required(self) -> None:
        response = self.client.post(self.url, data={"name": "Deploy bot"}, format="json")

        assert response.status_code == 404
