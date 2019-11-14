from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.utils.dates import to_timestamp


class SentryAppStatsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email="superuser@example.com", is_superuser=True)
        self.user = self.create_user(email="user@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

        self.published_app = self.create_sentry_app(
            name="Published App", organization=self.org, published=True
        )
        self.unowned_published_app = self.create_sentry_app(
            name="Unowned Published App", organization=self.create_organization(), published=True
        )

        self.unpublished_app = self.create_sentry_app(name="Unpublished App", organization=self.org)
        self.unowned_unpublished_app = self.create_sentry_app(
            name="Unowned Unpublished App", organization=self.create_organization()
        )

        self.internal_app = self.create_internal_integration(organization=self.org)

        self.published_app_install = self.create_sentry_app_installation(
            slug=self.published_app.slug, organization=self.create_organization()
        )
        self.unowned_published_app_install = self.create_sentry_app_installation(
            slug=self.unowned_published_app.slug, organization=self.create_organization()
        )


class GetSentryAppStatsTest(SentryAppStatsTest):
    def test_superuser_sees_unowned_published_stats(self):
        self.login_as(user=self.superuser, superuser=True)

        url = reverse("sentry-api-0-sentry-app-stats", args=[self.unowned_published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["totalInstalls"] == 1
        assert response.data["totalUninstalls"] == 0
        install_epoch = int(
            to_timestamp(
                self.unowned_published_app_install.date_added.replace(
                    microsecond=0, second=0, minute=0
                )
            )
        )
        assert (install_epoch, 1) in response.data["installStats"]

    def test_superuser_sees_unowned_unpublished_stats(self):
        self.login_as(user=self.superuser, superuser=True)

        url = reverse("sentry-api-0-sentry-app-stats", args=[self.unowned_unpublished_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["totalInstalls"] == 0
        assert response.data["totalUninstalls"] == 0

    def test_user_sees_owned_published_stats(self):
        self.login_as(self.user)

        url = reverse("sentry-api-0-sentry-app-stats", args=[self.published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["totalInstalls"] == 1
        assert response.data["totalUninstalls"] == 0
        install_epoch = int(
            to_timestamp(
                self.published_app_install.date_added.replace(microsecond=0, second=0, minute=0)
            )
        )
        assert (install_epoch, 1) in response.data["installStats"]

    def test_user_does_not_see_unowned_published_stats(self):
        self.login_as(self.user)

        url = reverse("sentry-api-0-sentry-app-stats", args=[self.unowned_published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 403
        assert response.data["detail"] == "You do not have permission to perform this action."

    def test_user_sees_owned_unpublished_stats(self):
        self.login_as(self.user)

        url = reverse("sentry-api-0-sentry-app-stats", args=[self.unpublished_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["totalInstalls"] == 0
        assert response.data["totalUninstalls"] == 0

    def test_user_sees_internal_stats(self):
        self.login_as(self.user)

        url = reverse("sentry-api-0-sentry-app-stats", args=[self.internal_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["totalInstalls"] == 1
        assert response.data["totalUninstalls"] == 0

    def test_invalid_startend_throws_error(self):
        self.login_as(self.user)

        url = "%s?since=1569523068&until=1566931068" % reverse(
            "sentry-api-0-sentry-app-stats", args=[self.published_app.slug]
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 500
