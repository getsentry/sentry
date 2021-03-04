from django.core.urlresolvers import reverse
from sentry.models import ExternalUser
from sentry.testutils import APITestCase


class ExternalUserDetailsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.external_user = self.create_external_user(
            self.user, self.organization, external_name="@NisanthanNanthakumar"
        )
        self.url = reverse(
            "sentry-api-0-organization-external-user-details",
            args=[self.organization.slug, self.external_user.id],
        )

    def test_basic_delete(self):
        with self.feature({"organizations:external-user-associations": True}):
            resp = self.client.delete(self.url)
        assert resp.status_code == 204
        assert not ExternalUser.objects.filter(id=str(self.external_user.id)).exists()

    def test_basic_update(self):
        with self.feature({"organizations:external-user-associations": True}):
            resp = self.client.put(self.url, {"externalName": "@new_username"})
        assert resp.status_code == 200
        assert resp.data["id"] == str(self.external_user.id)
        assert resp.data["externalName"] == "@new_username"

    def test_invalid_provider_update(self):
        with self.feature({"organizations:external-user-associations": True}):
            resp = self.client.put(self.url, {"provider": "unknown"})
        assert resp.status_code == 400
        assert resp.data == {"provider": ['"unknown" is not a valid choice.']}
