from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import iso_format, before_now

from sentry.utils.sentryappwebhookrequests import SentryAppWebhookRequestsBuffer


class SentryAppRequestsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email="superuser@example.com", is_superuser=True)
        self.user = self.create_user(email="user@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.event_id = "d5111da2c28645c5889d072017e3445d"

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

        self.internal_app = self.create_internal_integration(
            name="Internal app", organization=self.org
        )


class GetSentryAppRequestsTest(SentryAppRequestsTest):
    def test_superuser_sees_unowned_published_requests(self):
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

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.unowned_published_app.slug])
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

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.unowned_unpublished_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["sentryAppSlug"] == self.unowned_unpublished_app.slug

    def test_user_sees_owned_published_requests(self):
        self.login_as(user=self.user)

        buffer = SentryAppWebhookRequestsBuffer(self.published_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.published_app.webhook_url,
        )

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["organization"]["slug"] == self.org.slug
        assert response.data[0]["sentryAppSlug"] == self.published_app.slug
        assert response.data[0]["responseCode"] == 200

    def test_user_does_not_see_unowned_published_requests(self):
        self.login_as(user=self.user)

        buffer = SentryAppWebhookRequestsBuffer(self.unowned_published_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.unowned_published_app.webhook_url,
        )

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.unowned_published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 403
        assert response.data["detail"] == "You do not have permission to perform this action."

    def test_user_sees_owned_unpublished_requests(self):
        self.login_as(user=self.user)

        buffer = SentryAppWebhookRequestsBuffer(self.unpublished_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.unpublished_app.webhook_url,
        )

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.unpublished_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_internal_app_requests_does_not_have_organization_field(self):
        self.login_as(user=self.user)
        buffer = SentryAppWebhookRequestsBuffer(self.internal_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.internal_app.webhook_url,
        )

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.internal_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert "organization" not in response.data[0]
        assert response.data[0]["sentryAppSlug"] == self.internal_app.slug
        assert response.data[0]["responseCode"] == 200

    def test_event_type_filter(self):
        self.login_as(user=self.user)
        buffer = SentryAppWebhookRequestsBuffer(self.published_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.published_app.webhook_url,
        )

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.published_app.slug])
        response1 = self.client.get("{}?eventType=issue.created".format(url), format="json")
        assert response1.status_code == 200
        assert len(response1.data) == 0

        response2 = self.client.get("{}?eventType=issue.assigned".format(url), format="json")
        assert response2.status_code == 200
        assert len(response2.data) == 1

    def test_invalid_event_type(self):
        self.login_as(user=self.user)

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.published_app.slug])
        response = self.client.get("{}?eventType=invalid_type".format(url), format="json")

        assert response.status_code == 400

    def test_errors_only_filter(self):
        self.login_as(user=self.user)
        buffer = SentryAppWebhookRequestsBuffer(self.published_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.published_app.webhook_url,
        )
        buffer.add_request(
            response_code=500,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.published_app.webhook_url,
        )

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.published_app.slug])
        errors_only_response = self.client.get("{}?errorsOnly=true".format(url), format="json")
        assert errors_only_response.status_code == 200
        assert len(errors_only_response.data) == 1

        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 2

    def test_linked_error_id_converts_to_url(self):
        self.login_as(user=self.user)

        event = self.store_event(
            data={"event_id": self.event_id, "timestamp": iso_format(before_now(minutes=1))},
            project_id=self.project.id,
        )

        buffer = SentryAppWebhookRequestsBuffer(self.published_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.unpublished_app.webhook_url,
            error_id=self.event_id,
            project_id=self.project.id,
        )

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["organization"]["slug"] == self.org.slug
        assert response.data[0]["sentryAppSlug"] == self.published_app.slug
        assert response.data[0]["errorUrl"] == reverse(
            "sentry-organization-event-detail", args=[self.org.slug, event.group_id, event.event_id]
        )

    def test_linked_error_not_returned_if_project_does_not_exist(self):
        self.login_as(user=self.user)

        self.store_event(
            data={"event_id": self.event_id, "timestamp": iso_format(before_now(minutes=1))},
            project_id=self.project.id,
        )

        buffer = SentryAppWebhookRequestsBuffer(self.published_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.unpublished_app.webhook_url,
            error_id=self.event_id,
            project_id="1000",
        )

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["organization"]["slug"] == self.org.slug
        assert response.data[0]["sentryAppSlug"] == self.published_app.slug
        assert "errorUrl" not in response.data[0]

    def test_linked_error_not_returned_if_event_does_not_exist(self):
        self.login_as(user=self.user)

        # event_id doesn't correspond to an existing event because we didn't call store_event

        buffer = SentryAppWebhookRequestsBuffer(self.published_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.unpublished_app.webhook_url,
            error_id=self.event_id,
            project_id=self.project.id,
        )

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["organization"]["slug"] == self.org.slug
        assert response.data[0]["sentryAppSlug"] == self.published_app.slug
        assert "errorUrl" not in response.data[0]

    def test_linked_error_not_returned_if_project_doesnt_belong_to_org(self):
        self.login_as(user=self.user)
        unowned_project = self.create_project(organization=self.create_organization())

        buffer = SentryAppWebhookRequestsBuffer(self.published_app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.unpublished_app.webhook_url,
            error_id=self.event_id,
            project_id=unowned_project.id,
        )

        url = reverse("sentry-api-0-sentry-app-requests", args=[self.published_app.slug])
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["organization"]["slug"] == self.org.slug
        assert response.data[0]["sentryAppSlug"] == self.published_app.slug
        assert "errorUrl" not in response.data[0]
