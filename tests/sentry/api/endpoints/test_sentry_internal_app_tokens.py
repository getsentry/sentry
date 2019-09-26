from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.utils import json
from sentry.models import ApiToken
from sentry.models.sentryapp import MASKED_VALUE


class SentryInternalAppTokenTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user, name="My Org")
        self.project = self.create_project(organization=self.org)

        self.internal_sentry_app = self.create_internal_integration(
            name="My Internal App", organization=self.org
        )

        self.url = reverse(
            "sentry-api-0-sentry-internal-app-tokens", args=[self.internal_sentry_app.slug]
        )


class PostSentryInternalAppTokenTest(SentryInternalAppTokenTest):
    def test_create_token(self):
        self.login_as(user=self.user)
        response = self.client.post(self.url, format="json")
        assert response.status_code == 201

        assert ApiToken.objects.get(token=response.data["token"])

    def test_non_internal_app(self):
        sentry_app = self.create_sentry_app(name="My External App", organization=self.org)

        url = reverse("sentry-api-0-sentry-internal-app-tokens", args=[sentry_app.slug])

        self.login_as(user=self.user)
        response = self.client.post(url, format="json")

        assert response.status_code == 403
        assert response.data == "This route is limited to internal integrations only"

    def test_sentry_app_not_found(self):

        url = reverse("sentry-api-0-sentry-internal-app-tokens", args=["not_a_slug"])

        self.login_as(user=self.user)
        response = self.client.post(url, format="json")

        assert response.status_code == 404

    def test_token_limit(self):
        self.login_as(user=self.user)

        # we already have one token created so just need to make 19 more first
        for i in range(19):
            response = self.client.post(self.url, format="json")
            assert response.status_code == 201

        response = self.client.post(self.url, format="json")
        assert response.status_code == 403
        assert response.data == "Cannot generate more than 20 tokens for a single integration"


class GetSentryInternalAppTokenTest(SentryInternalAppTokenTest):
    def test_get_tokens(self):
        self.login_as(self.user)

        self.create_internal_integration(name="OtherInternal", organization=self.org)

        token = ApiToken.objects.get(application_id=self.internal_sentry_app.application_id)

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200
        response_content = json.loads(response.content)

        # should not include tokens from other internal app
        assert len(response_content) == 1

        assert response_content[0]["id"] == six.text_type(token.id)
        assert response_content[0]["token"] == token.token

    def test_token_is_masked(self):
        user = self.create_user(email="meep@example.com")
        self.create_member(organization=self.org, user=user)
        # create an app with scopes higher than what a member role has
        sentry_app = self.create_internal_integration(
            name="AnothaOne", organization=self.org, scopes=("project:write",)
        )

        self.login_as(user)

        url = reverse("sentry-api-0-sentry-internal-app-tokens", args=[sentry_app.slug])
        response = self.client.get(url, format="json")
        response_content = json.loads(response.content)

        assert response_content[0]["token"] == MASKED_VALUE
        assert response_content[0]["refreshToken"] == MASKED_VALUE
