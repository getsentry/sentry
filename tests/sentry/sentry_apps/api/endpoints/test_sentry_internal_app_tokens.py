from django.test import override_settings
from rest_framework import status

from sentry import audit_log
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.models.sentry_app import MASKED_VALUE
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test


class SentryInternalAppTokenTest(APITestCase):
    endpoint = "sentry-api-0-sentry-internal-app-tokens"

    def setUp(self) -> None:
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user, name="My Org")
        self.project = self.create_project(organization=self.org)

        self.internal_sentry_app = self.create_internal_integration(
            name="My Internal App", organization=self.org
        )
        self.token = self.create_internal_integration_token(
            user=self.user, internal_integration=self.internal_sentry_app
        )
        self.superuser = self.create_user(is_superuser=True)


@control_silo_test
class PostSentryInternalAppTokenTest(SentryInternalAppTokenTest):
    method = "post"

    def test_create_token(self) -> None:
        self.login_as(user=self.user)
        response = self.get_success_response(
            self.internal_sentry_app.slug, status_code=status.HTTP_201_CREATED
        )

        api_token = ApiToken.objects.get(token=response.data["token"])
        assert api_token

        assert_org_audit_log_exists(
            organization=self.org,
            event=audit_log.get_event_id("INTERNAL_INTEGRATION_ADD_TOKEN"),
            target_object=api_token.id,
            actor=self.user,
        )

    def test_non_internal_app(self) -> None:
        sentry_app = self.create_sentry_app(name="My External App", organization=self.org)

        self.login_as(user=self.user)
        response = self.get_error_response(sentry_app.slug, status_code=status.HTTP_403_FORBIDDEN)

        assert response.data == "This route is limited to internal integrations only"

    def test_sentry_app_not_found(self) -> None:
        self.login_as(user=self.user)
        self.get_error_response("not_a_slug", status_code=status.HTTP_404_NOT_FOUND)

    def test_token_limit(self) -> None:
        self.login_as(user=self.user)

        # we already have one token created so just need to make 19 more first
        for _ in range(19):
            self.get_success_response(
                self.internal_sentry_app.slug, status_code=status.HTTP_201_CREATED
            )

        response = self.get_error_response(
            self.internal_sentry_app.slug, status_code=status.HTTP_403_FORBIDDEN
        )
        assert response.data == "Cannot generate more than 20 tokens for a single integration"

    def test_cannot_create_partner_app_token(self) -> None:
        self.login_as(user=self.user)
        self.internal_sentry_app.update(metadata={"partnership_restricted": True})

        self.get_error_response(
            self.internal_sentry_app.slug, status_code=status.HTTP_403_FORBIDDEN
        )

    def test_superuser_post(self) -> None:
        self.login_as(self.superuser, superuser=True)
        self.get_success_response(
            self.internal_sentry_app.slug, status_code=status.HTTP_201_CREATED
        )

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_read_write_post(self) -> None:
        # only superuser write can hit post
        self.login_as(self.superuser, superuser=True)
        self.get_error_response(
            self.internal_sentry_app.slug, status_code=status.HTTP_403_FORBIDDEN
        )

        self.add_user_permission(self.superuser, "superuser.write")
        self.get_success_response(
            self.internal_sentry_app.slug, status_code=status.HTTP_201_CREATED
        )


@control_silo_test
class GetSentryInternalAppTokenTest(SentryInternalAppTokenTest):
    method = "get"

    def test_get_tokens(self) -> None:
        self.login_as(self.user)

        other_internal_app = self.create_internal_integration(
            name="OtherInternal", organization=self.org
        )
        self.create_internal_integration_token(
            user=self.user, internal_integration=other_internal_app
        )

        response = self.get_success_response(self.internal_sentry_app.slug)

        # should not include tokens from other internal app
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.token.id)

    def no_access_for_members(self) -> None:
        user = self.create_user(email="meep@example.com")
        self.create_member(organization=self.org, user=user)
        self.login_as(user)

        self.get_error_response(
            self.internal_sentry_app.slug, status_code=status.HTTP_403_FORBIDDEN
        )

    def test_token_is_masked(self) -> None:
        user = self.create_user(email="meep@example.com")
        self.create_member(organization=self.org, user=user, role="manager")
        # create an app with scopes higher than what a member role has
        sentry_app = self.create_internal_integration(
            name="AnothaOne", organization=self.org, scopes=("org:admin",)
        )
        self.create_internal_integration_token(user=self.user, internal_integration=sentry_app)

        self.login_as(user)

        response = self.get_success_response(sentry_app.slug)

        assert response.data[0]["token"] == MASKED_VALUE
        assert response.data[0]["refreshToken"] == MASKED_VALUE

    def test_deny_token_access(self) -> None:
        self.login_as(self.user)
        token = ApiToken.objects.create(user=self.user, scope_list=["org:write"])

        sentry_app = self.create_internal_integration(name="OtherInternal", organization=self.org)
        self.create_internal_integration_token(user=self.user, internal_integration=sentry_app)

        self.get_error_response(
            sentry_app.slug,
            status_code=status.HTTP_403_FORBIDDEN,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
        )

    def test_superuser_get(self) -> None:
        self.login_as(self.superuser, superuser=True)
        self.get_success_response(self.internal_sentry_app.slug)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_read_write_get(self) -> None:
        self.login_as(self.superuser, superuser=True)
        self.get_success_response(self.internal_sentry_app.slug)

        self.add_user_permission(self.superuser, "superuser.write")
        self.get_success_response(self.internal_sentry_app.slug)
