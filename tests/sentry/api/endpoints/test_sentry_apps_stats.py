from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.utils import json
from sentry.testutils import APITestCase


class SentryAppsStatsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.super_org = self.create_organization(owner=self.superuser)

        self.app_1 = self.create_sentry_app(
            name="Test", organization=self.super_org, published=True
        )

        self.app_2 = self.create_sentry_app(name="Testin", organization=self.org)

        self.create_sentry_app_installation(slug=self.app_1.slug, organization=self.org)
        self.create_sentry_app_installation(slug=self.app_2.slug, organization=self.org)

        self.url = reverse("sentry-api-0-sentry-apps-stats")

    def test_superuser_has_access(self):
        self.login_as(user=self.superuser, superuser=True)

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200
        assert {
            "id": self.app_2.id,
            "slug": self.app_2.slug,
            "name": self.app_2.name,
            "installs": 1,
        } in json.loads(response.content)

        assert {
            "id": self.app_1.id,
            "slug": self.app_1.slug,
            "name": self.app_1.name,
            "installs": 1,
        } in json.loads(response.content)

    def test_nonsuperusers_have_no_access(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format="json")

        assert response.status_code == 403

    def test_per_page(self):
        self.login_as(user=self.superuser, superuser=True)

        self.create_sentry_app_installation(
            slug=self.app_1.slug, organization=self.create_organization()
        )

        for i in range(15):
            app = self.create_sentry_app(
                name="Test {}".format(i), organization=self.super_org, published=True
            )

            self.create_sentry_app_installation(slug=app.slug, organization=self.org)

        response = self.client.get(self.url + "?per_page=10", format="json")
        integrations = json.loads(response.content)

        assert len(integrations) == 10  # honors per_page
        assert integrations[0]["installs"] == 2  # sorted by installs
