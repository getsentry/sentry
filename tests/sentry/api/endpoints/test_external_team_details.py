from sentry.models import ExternalActor
from sentry.testutils import APITestCase


class ExternalTeamDetailsTest(APITestCase):
    endpoint = "sentry-api-0-external-team-details"
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        self.external_team = self.create_external_team(
            self.team, external_name="@getsentry/ecosystem"
        )

    def test_basic_delete(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            self.get_success_response(
                self.organization.slug, self.team.slug, self.external_team.id, method="delete"
            )
        assert not ExternalActor.objects.filter(id=str(self.external_team.id)).exists()

    def test_basic_update(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            data = {"externalName": "@getsentry/growth"}
            response = self.get_success_response(
                self.organization.slug, self.team.slug, self.external_team.id, **data
            )

        assert response.data["id"] == str(self.external_team.id)
        assert response.data["externalName"] == "@getsentry/growth"

    def test_invalid_provider_update(self):
        data = {"provider": "git"}
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_error_response(
                self.organization.slug,
                self.team.slug,
                self.external_team.id,
                status_code=400,
                **data,
            )
        assert response.data == {"provider": ['"git" is not a valid choice.']}
