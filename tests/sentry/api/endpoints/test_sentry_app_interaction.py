from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class SentryAppInteractionTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email="superuser@example.com", is_superuser=True)
        self.user = self.create_user(email="user@example.com")
        self.org = self.create_organization(owner=self.user)

        self.published_app = self.create_sentry_app(
            name="Published App",
            organization=self.org,
            published=True,
            schema={"elements": [self.create_issue_link_schema()]},
        )
        self.unowned_published_app = self.create_sentry_app(
            name="Unowned Published App", organization=self.create_organization(), published=True
        )
        self.owned_url = reverse(
            "sentry-api-0-sentry-app-interaction", args=[self.published_app.slug]
        )
        self.unowned_url = reverse(
            "sentry-api-0-sentry-app-interaction", args=[self.unowned_published_app.slug]
        )


class GetSentryAppInteractionTest(SentryAppInteractionTest):
    def test_superuser_sees_unowned_interactions(self):
        self.login_as(user=self.superuser, superuser=True)

        response = self.client.get(self.unowned_url, format="json")
        assert response.status_code == 200
        assert len(response.data["views"]) > 0
        assert response.data["componentInteractions"] == {}

    def test_user_sees_owned_interactions(self):
        self.login_as(user=self.user)

        response = self.client.get(self.owned_url, format="json")
        assert response.status_code == 200
        assert len(response.data["views"]) > 0
        assert "issue-link" in response.data["componentInteractions"]

    def test_user_does_not_see_unowned_interactions(self):
        self.login_as(user=self.user)

        response = self.client.get(self.unowned_url, format="json")
        assert response.status_code == 403
        assert response.data["detail"] == "You do not have permission to perform this action."

    def test_invalid_startend_throws_error(self):
        self.login_as(self.user)

        url = "%s?since=1569523068&until=1566931068" % self.owned_url
        response = self.client.get(url, format="json")
        assert response.status_code == 500


class PostSentryAppInteractionTest(SentryAppInteractionTest):
    def test_not_logged_in_not_allowed(self):
        body = {"tsdbField": "sentry_app_viewed"}
        response = self.client.post(
            self.owned_url, body, headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401
        assert response.data["detail"] == "Authentication credentials were not provided."

    def test_missing_tsdb_field(self):
        self.login_as(self.user)
        body = {}
        response = self.client.post(
            self.owned_url, body, headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        assert (
            response.data["detail"]
            == "The tsdbField must be one of: sentry_app_viewed, sentry_app_component_interacted"
        )

    def test_incorrect_tsdb_field(self):
        self.login_as(self.user)
        body = {"tsdbField": "wrong"}
        response = self.client.post(
            self.owned_url, body, headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        assert (
            response.data["detail"]
            == "The tsdbField must be one of: sentry_app_viewed, sentry_app_component_interacted"
        )

    def test_missing_component_type(self):
        self.login_as(self.user)
        body = {"tsdbField": "sentry_app_component_interacted"}
        response = self.client.post(
            self.owned_url, body, headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        assert response.data[
            "detail"
        ] == "The field componentType is required and must be one of %s" % [
            "stacktrace-link",
            "issue-link",
        ]

    def test_incorrect_component_type(self):
        self.login_as(self.user)
        body = {"tsdbField": "sentry_app_component_interacted", "componentType": "wrong"}
        response = self.client.post(
            self.owned_url, body, headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        assert response.data[
            "detail"
        ] == "The field componentType is required and must be one of %s" % [
            "stacktrace-link",
            "issue-link",
        ]

    def test_allows_logged_in_user_who_doesnt_own_app(self):
        self.login_as(self.user)
        body = {"tsdbField": "sentry_app_component_interacted", "componentType": "issue-link"}
        response = self.client.post(
            self.unowned_url, body, headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201

        body = {"tsdbField": "sentry_app_viewed"}
        response = self.client.post(
            self.unowned_url, body, headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201

    def test_allows_logged_in_user_who_does_own_app(self):
        self.login_as(self.user)
        body = {"tsdbField": "sentry_app_component_interacted", "componentType": "issue-link"}
        response = self.client.post(
            self.owned_url, body, headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201

        body = {"tsdbField": "sentry_app_viewed"}
        response = self.client.post(
            self.owned_url, body, headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201
