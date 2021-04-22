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
