from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase

from sentry.utils.sentryappwebhookrequests import SentryAppWebhookRequestsBuffer


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

        buffer = SentryAppWebhookRequestsBuffer(self.unowned_published_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.unowned_published_app.webhook_url,
        )
        buffer.add_request(
            response_code=500,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.unowned_published_app.webhook_url,
        )

        url = reverse("sentry-api-0-sentry-app-errors", args=[self.unowned_published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["organization"]["slug"] == self.org.slug
        assert response.data[0]["sentryAppSlug"] == self.unowned_published_app.slug
        assert response.data[0]["responseCode"] == 500

    def test_superuser_sees_unpublished_stats(self):
        self.login_as(user=self.superuser, superuser=True)

        buffer = SentryAppWebhookRequestsBuffer(self.unowned_unpublished_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.unowned_unpublished_app.webhook_url,
        )

        url = reverse("sentry-api-0-sentry-app-errors", args=[self.unowned_unpublished_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["sentryAppSlug"] == self.unowned_unpublished_app.slug

    def test_user_sees_owned_published_errors(self):
        self.login_as(user=self.user)

        buffer = SentryAppWebhookRequestsBuffer(self.published_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.published_app.webhook_url,
        )

        url = reverse("sentry-api-0-sentry-app-errors", args=[self.published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["organization"]["slug"] == self.org.slug
        assert response.data[0]["sentryAppSlug"] == self.published_app.slug
        assert response.data[0]["responseCode"] == 200

    def test_user_does_not_see_unowned_published_errors(self):
        self.login_as(user=self.user)

        buffer = SentryAppWebhookRequestsBuffer(self.unowned_published_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.unowned_published_app.webhook_url,
        )

        url = reverse("sentry-api-0-sentry-app-errors", args=[self.unowned_published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 403
        assert response.data["detail"] == "You do not have permission to perform this action."

    def test_user_sees_owned_unpublished_errors(self):
        self.login_as(user=self.user)

        buffer = SentryAppWebhookRequestsBuffer(self.unpublished_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.unpublished_app.webhook_url,
        )

        url = reverse("sentry-api-0-sentry-app-errors", args=[self.unpublished_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_invalid_date_params(self):
        self.login_as(self.user)

        url = "%s?start=1570489554&end=1562365872" % reverse(
            "sentry-api-0-sentry-app-errors", args=[self.published_app.slug]
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 400
        assert response.data["detail"] == "start must be before end"
