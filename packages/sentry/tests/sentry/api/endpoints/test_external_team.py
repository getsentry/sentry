from sentry.models import ExternalActor, Integration
from sentry.testutils import APITestCase
from sentry.types.integrations import get_provider_string


class ExternalTeamTest(APITestCase):
    endpoint = "sentry-api-0-external-team"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.integration = Integration.objects.create(
            provider="github", name="GitHub", external_id="github:1"
        )

        self.integration.add_organization(self.organization, self.user)

        self.slack_integration = Integration.objects.create(
            provider="slack", name="Slack", external_id="slack:2"
        )

        self.slack_integration.add_organization(self.organization, self.user)

    def test_basic_post(self):
        data = {
            "externalName": "@getsentry/ecosystem",
            "provider": "github",
            "integrationId": self.integration.id,
        }
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_success_response(
                self.organization.slug, self.team.slug, status_code=201, **data
            )
        assert response.data == {
            **data,
            "id": str(response.data["id"]),
            "teamId": str(self.team.id),
            "integrationId": str(self.integration.id),
        }

    def test_without_feature_flag(self):
        data = {
            "externalName": "@getsentry/ecosystem",
            "provider": "github",
            "integrationId": self.integration.id,
        }
        response = self.get_error_response(
            self.organization.slug, self.team.slug, status_code=403, **data
        )
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_missing_provider(self):
        data = {
            "externalName": "@getsentry/ecosystem",
            "integrationId": self.integration.id,
        }
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_error_response(
                self.organization.slug, self.team.slug, status_code=400, **data
            )
        assert response.data == {"provider": ["This field is required."]}

    def test_missing_externalName(self):
        data = {
            "provider": "github",
            "integrationId": self.integration.id,
        }
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_error_response(
                self.organization.slug, self.team.slug, status_code=400, **data
            )
        assert response.data == {"externalName": ["This field is required."]}

    def test_missing_integrationId(self):
        data = {
            "externalName": "@getsentry/ecosystem",
            "provider": "github",
        }
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_error_response(
                self.organization.slug, self.team.slug, status_code=400, **data
            )
        assert response.data == {"integrationId": ["This field is required."]}

    def test_invalid_provider(self):
        data = {
            "externalName": "@getsentry/ecosystem",
            "provider": "git",
            "integrationId": self.integration.id,
        }
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_error_response(
                self.organization.slug, self.team.slug, status_code=400, **data
            )
        assert response.data == {"provider": ['"git" is not a valid choice.']}

    def test_create_existing_association(self):
        self.external_team = self.create_external_team(
            self.team, external_name="@getsentry/ecosystem", integration=self.integration
        )

        data = {
            "externalName": self.external_team.external_name,
            "provider": get_provider_string(self.external_team.provider),
            "integrationId": self.integration.id,
        }
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_success_response(
                self.organization.slug, self.team.slug, status_code=200, **data
            )
        assert response.data == {
            **data,
            "id": str(self.external_team.id),
            "teamId": str(self.team.id),
            "integrationId": str(self.integration.id),
        }

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
        with self.feature({"organizations:integrations-codeowners": True}):
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
            "integrationId": self.slack_integration.id,
        }
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_success_response(self.organization.slug, self.team.slug, **data)
        assert response.data == {
            **data,
            "id": str(response.data["id"]),
            "teamId": str(self.team.id),
            "integrationId": str(self.slack_integration.id),
        }
        assert ExternalActor.objects.get(id=response.data["id"]).external_id == "YU287RFO30"

    def test_create_with_invalid_external_id(self):
        data = {
            "externalId": "",
            "externalName": "@getsentry/ecosystem",
            "provider": "slack",
            "integrationId": self.slack_integration.id,
        }
        with self.feature({"organizations:integrations-codeowners": True}):
            self.get_error_response(self.organization.slug, self.team.slug, **data)
