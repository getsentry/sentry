from sentry.models import ExternalActor, Integration
from sentry.testutils import APITestCase
from sentry.types.integrations import get_provider_string


class ExternalTeamTest(APITestCase):
    endpoint = "sentry-api-0-external-team"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_basic_post(self):
        data = {"externalName": "@getsentry/ecosystem", "provider": "github"}
        with self.feature({"organizations:import-codeowners": True}):
            response = self.get_success_response(
                self.organization.slug, self.team.slug, status_code=201, **data
            )
        assert response.data == {
            "id": str(response.data["id"]),
            "teamId": str(self.team.id),
            **data,
        }

    def test_without_feature_flag(self):
        data = {"externalName": "@getsentry/ecosystem", "provider": "github"}
        response = self.get_error_response(
            self.organization.slug, self.team.slug, status_code=403, **data
        )
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_missing_provider(self):
        data = {"externalName": "@getsentry/ecosystem"}
        with self.feature({"organizations:import-codeowners": True}):
            response = self.get_error_response(
                self.organization.slug, self.team.slug, status_code=400, **data
            )
        assert response.data == {"provider": ["This field is required."]}

    def test_missing_externalName(self):
        data = {"provider": "gitlab"}
        with self.feature({"organizations:import-codeowners": True}):
            response = self.get_error_response(
                self.organization.slug, self.team.slug, status_code=400, **data
            )
        assert response.data == {"externalName": ["This field is required."]}

    def test_invalid_provider(self):
        data = {"externalName": "@getsentry/ecosystem", "provider": "git"}
        with self.feature({"organizations:import-codeowners": True}):
            response = self.get_error_response(
                self.organization.slug, self.team.slug, status_code=400, **data
            )
        assert response.data == {"provider": ['"git" is not a valid choice.']}

    def test_create_existing_association(self):
        self.external_team = self.create_external_team(
            self.team, external_name="@getsentry/ecosystem"
        )
        data = {
            "externalName": self.external_team.external_name,
            "provider": get_provider_string(self.external_team.provider),
        }
        with self.feature({"organizations:import-codeowners": True}):
            response = self.get_success_response(self.organization.slug, self.team.slug, **data)
        assert response.data == {
            "id": str(self.external_team.id),
            "teamId": str(self.team.id),
            **data,
        }

    def test_create_with_integration(self):
        self.integration = Integration.objects.create(
            provider="gitlab", name="Gitlab", external_id="gitlab:1"
        )

        self.integration.add_organization(self.organization, self.user)

        data = {
            "externalName": "@getsentry/ecosystem",
            "provider": "github",
            "integrationId": self.integration.id,
        }
        with self.feature({"organizations:import-codeowners": True}):
            response = self.get_success_response(
                self.organization.slug, self.team.slug, status_code=201, **data
            )
        assert response.data == {
            "id": str(response.data["id"]),
            "teamId": str(self.team.id),
            "externalName": data["externalName"],
            "provider": data["provider"],
        }
        assert (
            ExternalActor.objects.get(id=response.data["id"]).integration_id == self.integration.id
        )

    def test_create_with_invalid_integration_id(self):
        self.org2 = self.create_organization(owner=self.user, name="org2")
        self.integration = Integration.objects.create(
            provider="gitlab", name="Gitlab", external_id="gitlab:1"
        )

        self.integration.add_organization(self.org2, self.user)

        data = {
            "externalName": "@getsentry/ecosystem",
            "provider": "github",
            "integrationId": self.integration.id,
        }
        with self.feature({"organizations:import-codeowners": True}):
            response = self.get_error_response(
                self.organization.slug, self.team.slug, status_code=400, **data
            )
        assert response.data == {
            "integrationId": ["Integration does not exist for this organization"]
        }

    def test_create_with_external_id(self):
        data = {
            "externalId": "YU287RFO30",
            "externalName": "@getsentry/ecosystem",
            "provider": "slack",
        }
        with self.feature({"organizations:import-codeowners": True}):
            response = self.get_success_response(self.organization.slug, self.team.slug, **data)
        assert response.data == {
            "id": str(response.data["id"]),
            "teamId": str(self.team.id),
            "externalName": data["externalName"],
            "externalId": data["externalId"],
            "provider": data["provider"],
        }
        assert ExternalActor.objects.get(id=response.data["id"]).external_id == "YU287RFO30"

    def test_create_with_invalid_external_id(self):
        data = {
            "externalId": "",
            "externalName": "@getsentry/ecosystem",
            "provider": "slack",
        }
        with self.feature({"organizations:import-codeowners": True}):
            self.get_error_response(self.organization.slug, self.team.slug, **data)
