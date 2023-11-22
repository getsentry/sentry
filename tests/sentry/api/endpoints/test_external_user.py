from sentry.models.integrations.integration import Integration
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class ExternalUserTest(APITestCase):
    endpoint = "sentry-api-0-organization-external-user"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        self.org_slug = self.organization.slug  # force creation
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = Integration.objects.create(
                provider="github", name="GitHub", external_id="github:1"
            )

            self.integration.add_organization(self.organization, self.user)
        self.data = {
            "externalName": "@NisanthanNanthakumar",
            "provider": "github",
            "userId": self.user.id,
            "integrationId": self.integration.id,
        }

    def test_basic_post(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_success_response(self.org_slug, status_code=201, **self.data)
        assert response.data == {
            **self.data,
            "id": str(response.data["id"]),
            "userId": str(self.user.id),
            "integrationId": str(self.integration.id),
        }

    def test_without_feature_flag(self):
        response = self.get_error_response(self.org_slug, status_code=403, **self.data)
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_missing_provider(self):
        self.data.pop("provider")
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_error_response(self.org_slug, status_code=400, **self.data)
        assert response.data == {"provider": ["This field is required."]}

    def test_missing_externalName(self):
        self.data.pop("externalName")
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_error_response(self.org_slug, status_code=400, **self.data)
        assert response.data == {"externalName": ["This field is required."]}

    def test_missing_userId(self):
        self.data.pop("userId")
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_error_response(self.org_slug, status_code=400, **self.data)
        assert response.data == {"userId": ["This field is required."]}

    def test_missing_integrationId(self):
        self.data.pop("integrationId")
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_error_response(self.org_slug, status_code=400, **self.data)
        assert response.data == {"integrationId": ["This field is required."]}

    def test_invalid_provider(self):
        self.data.update(provider="unknown")
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_error_response(self.org_slug, status_code=400, **self.data)
        assert response.data == {"provider": ['"unknown" is not a valid choice.']}

    def test_create_existing_association(self):
        self.external_user = self.create_external_user(
            self.user, self.organization, self.integration, external_name=self.data["externalName"]
        )

        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_success_response(self.org_slug, status_code=200, **self.data)
        assert response.data == {
            **self.data,
            "id": str(self.external_user.id),
            "userId": str(self.user.id),
            "integrationId": str(self.integration.id),
        }
