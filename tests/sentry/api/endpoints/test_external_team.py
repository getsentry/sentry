from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.models import ExternalTeam


class ExternalTeamTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")

        self.url = reverse(
            "sentry-api-0-external-team",
            args=[self.org.slug, self.team.slug],
        )

    def test_basic_post(self):
        data = {"externalId": "@getsentry/ecosystem", "provider": "github"}
        response = self.client.post(self.url, data)
        assert response.status_code == 201, response.content
        assert response.data == {
            "id": str(response.data["id"]),
            "teamId": str(self.team.id),
            **data,
        }

    def test_missing_provider(self):
        response = self.client.post(self.url, {"externalId": "@getsentry/ecosystem"})
        assert response.status_code == 400
        assert response.data == {"provider": ["This field is required."]}

    def test_missing_externalId(self):
        response = self.client.post(self.url, {"provider": "gitlab"})
        assert response.status_code == 400
        assert response.data == {"externalId": ["This field is required."]}

    def test_invalid_provider(self):
        data = {"externalId": "@getsentry/ecosystem", "provider": "git"}
        response = self.client.post(self.url, data)
        assert response.status_code == 400
        assert response.data == {"provider": ['"git" is not a valid choice.']}

    def test_create_existing_association(self):
        self.external_team = ExternalTeam.objects.create(
            team_id=str(self.team.id),
            provider=ExternalTeam.get_provider_enum("github"),
            external_id="@getsentry/ecosystem",
        )
        data = {
            "externalId": self.external_team.external_id,
            "provider": ExternalTeam.get_provider_string(self.external_team.provider),
        }
        response = self.client.post(self.url, data)
        assert response.status_code == 200
        assert response.data == {
            "id": str(self.external_team.id),
            "teamId": str(self.external_team.team_id),
            **data,
        }
