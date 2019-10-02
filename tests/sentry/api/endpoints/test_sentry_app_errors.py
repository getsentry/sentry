from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class SentryAppErrorsTest(APITestCase):
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

        self.webhook_error1 = self.create_sentry_app_webhook_error(sentry_app=self.published_app)
        self.webhook_error2 = self.create_sentry_app_webhook_error(
            sentry_app=self.unowned_published_app
        )


class GetSentryAppErrorsTest(SentryAppErrorsTest):
    def test_superuser_sees_unowned_published_errors(self):
        self.login_as(user=self.superuser, superuser=True)

        url = reverse("sentry-api-0-sentry-app-errors", args=[self.unowned_published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["organization"]["slug"] == self.webhook_error2.organization.slug
        assert response.data[0]["app"]["slug"] == self.unowned_published_app.slug

    def test_superuser_does_not_see_unpublished_stats(self):
        self.login_as(user=self.superuser, superuser=True)

        url = reverse("sentry-api-0-sentry-app-errors", args=[self.unowned_unpublished_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 403
        assert response.data["detail"] == "You do not have permission to perform this action."

    def test_user_sees_owned_published_errors(self):
        self.login_as(user=self.user)

        url = reverse("sentry-api-0-sentry-app-errors", args=[self.published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["organization"]["slug"] == self.webhook_error1.organization.slug
        assert response.data[0]["app"]["slug"] == self.published_app.slug

    def test_user_does_not_see_unowned_published_errors(self):
        self.login_as(user=self.user)

        url = reverse("sentry-api-0-sentry-app-errors", args=[self.unowned_published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 403
        assert response.data["detail"] == "You do not have permission to perform this action."

    def test_user_does_not_see_owned_unpublished_errors(self):
        self.login_as(user=self.user)

        url = reverse("sentry-api-0-sentry-app-errors", args=[self.unpublished_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 403
        assert response.data["detail"] == "You do not have permission to perform this action."
