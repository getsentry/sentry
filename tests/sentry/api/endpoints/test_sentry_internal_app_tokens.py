from django.urls import reverse

from sentry.models import ApiToken
from sentry.models.integrations.sentry_app import MASKED_VALUE
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


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


@control_silo_test(stable=True)
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


@control_silo_test(stable=True)
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

        assert response_content[0]["id"] == str(token.id)
        assert response_content[0]["token"] == token.token

    def no_access_for_members(self):
        user = self.create_user(email="meep@example.com")
        self.create_member(organization=self.org, user=user)
        self.login_as(user)

        response = self.client.get(self.url, format="json")
        assert response.status_code == 403

    def test_token_is_masked(self):
        user = self.create_user(email="meep@example.com")
        self.create_member(organization=self.org, user=user, role="manager")
        # create an app with scopes higher than what a member role has
        sentry_app = self.create_internal_integration(
            name="AnothaOne", organization=self.org, scopes=("org:admin",)
        )

        self.login_as(user)

        url = reverse("sentry-api-0-sentry-internal-app-tokens", args=[sentry_app.slug])
        response = self.client.get(url, format="json")
        response_content = json.loads(response.content)

        assert len(response_content) == 1
        assert response_content[0]["token"] == MASKED_VALUE
        assert response_content[0]["refreshToken"] == MASKED_VALUE

    def test_no_scope_api_token(self):
        user = self.create_user(email="meep@example.com")
        self.create_member(organization=self.org, user=user, role="owner")
        sentry_app = self.create_internal_integration(
            name="sentry_app_1",
            organization=self.org,
            scopes=(
                "project:read",
                "project:write",
                "project:admin",
                "project:releases",
                "team:read",
                "team:write",
                "team:admin",
                "event:read",
                "event:write",
                "event:admin",
                "org:read",
                "org:write",
                "org:admin",
                "member:read",
                "member:write",
                "member:admin",
            ),
        )
        sentry_app_api_token_2 = ApiToken.objects.create(
            application_id=sentry_app.application_id,
            user=user,
            scope_list=[],
        )

        url = reverse("sentry-api-0-sentry-internal-app-tokens", args=[sentry_app.slug])
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {sentry_app_api_token_2.token}"
        )
        response_content = json.loads(response.content)

        assert response_content == {"detail": "You do not have permission to perform this action."}
