from django.core.urlresolvers import reverse
from sentry.models import ExternalTeam
from sentry.testutils import APITestCase


class ExternalTeamDetailsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.external_team = ExternalTeam.objects.create(
            team_id=str(self.team.id),
            provider=ExternalTeam.get_provider_enum("github"),
            external_name="@getsentry/ecosystem",
        )
        self.url = reverse(
            "sentry-api-0-external-team-details",
            args=[self.org.slug, self.team.slug, self.external_team.id],
        )

    def test_basic_delete(self):
        with self.feature({"organizations:external-team-associations": True}):
            resp = self.client.delete(self.url)
        assert resp.status_code == 204
        assert not ExternalTeam.objects.filter(id=str(self.external_team.id)).exists()

    def test_basic_update(self):
        with self.feature({"organizations:external-team-associations": True}):
            resp = self.client.put(self.url, {"externalName": "@getsentry/growth"})
        assert resp.status_code == 200
        assert resp.data["id"] == str(self.external_team.id)
        assert resp.data["externalName"] == "@getsentry/growth"

    def test_invalid_provider_update(self):
        with self.feature({"organizations:external-team-associations": True}):
            resp = self.client.put(self.url, {"provider": "git"})
        assert resp.status_code == 400
        assert resp.data == {"provider": ['"git" is not a valid choice.']}
