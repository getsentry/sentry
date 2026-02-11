from django.test import override_settings
from rest_framework import status

from sentry import audit_log
from sentry.models.apitoken import ApiToken
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SentryInternalAppTokenCreationTest(APITestCase):
    endpoint = "sentry-api-0-sentry-internal-app-token-details"
    method = "delete"

    def setUp(self) -> None:
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user, name="My Org")
        self.project = self.create_project(organization=self.org)

        self.internal_sentry_app = self.create_internal_integration(
            name="My Internal App", organization=self.org
        )
        self.api_token = self.create_internal_integration_token(
            user=self.user, internal_integration=self.internal_sentry_app
        )

        self.superuser = self.create_user(is_superuser=True)

    def test_delete_token(self) -> None:
        self.login_as(user=self.user)
        token_id = self.api_token.id
        self.get_success_response(
            self.internal_sentry_app.slug,
            token_id,
            status_code=status.HTTP_204_NO_CONTENT,
        )
        assert not ApiToken.objects.filter(pk=token_id).exists()

        assert_org_audit_log_exists(
            organization=self.org,
            event=audit_log.get_event_id("INTERNAL_INTEGRATION_REMOVE_TOKEN"),
            target_object=token_id,
            actor=self.user,
        )

    def test_delete_invalid_token(self) -> None:
        self.login_as(user=self.user)

        self.get_error_response(
            self.internal_sentry_app.slug,
            "random",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    def test_delete_token_another_app(self) -> None:
        another_app = self.create_internal_integration(name="Another app", organization=self.org)
        api_token = self.create_internal_integration_token(
            user=self.user, internal_integration=another_app
        )

        self.login_as(user=self.user)
        self.get_error_response(
            self.internal_sentry_app.slug,
            api_token.id,
            status_code=status.HTTP_404_NOT_FOUND,
        )

    def test_non_internal_app(self) -> None:
        sentry_app = self.create_sentry_app(name="My External App", organization=self.org)

        install = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.org, user=self.user
        )

        self.login_as(user=self.user)

        response = self.get_error_response(
            install.sentry_app.slug,
            install.api_token.id,
            status_code=status.HTTP_403_FORBIDDEN,
        )
        assert response.data == "This route is limited to internal integrations only"

    def test_sentry_app_not_found(self) -> None:
        self.login_as(user=self.user)

        self.get_error_response(
            "not_a_slug",
            self.api_token.id,
            status_code=status.HTTP_404_NOT_FOUND,
        )

    def test_cannot_delete_partner_app_token(self) -> None:
        self.login_as(user=self.user)
        self.internal_sentry_app.update(metadata={"partnership_restricted": True})
        self.get_error_response(
            self.internal_sentry_app.slug,
            self.api_token.id,
            status_code=status.HTTP_403_FORBIDDEN,
        )

    def test_superuser_can_delete(self) -> None:
        self.login_as(self.superuser, superuser=True)
        self.get_success_response(
            self.internal_sentry_app.slug,
            self.api_token.id,
            status_code=status.HTTP_204_NO_CONTENT,
        )
        assert not ApiToken.objects.filter(pk=self.api_token.id).exists()

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_read_write_delete(self) -> None:
        self.login_as(self.superuser, superuser=True)

        # superuser read cannot delete
        self.get_error_response(
            self.internal_sentry_app.slug,
            self.api_token.id,
            status_code=status.HTTP_403_FORBIDDEN,
        )
        assert ApiToken.objects.filter(pk=self.api_token.id).exists()

        # superuser write can delete
        self.add_user_permission(self.superuser, "superuser.write")

        self.get_success_response(
            self.internal_sentry_app.slug,
            self.api_token.id,
            status_code=status.HTTP_204_NO_CONTENT,
        )
        assert not ApiToken.objects.filter(pk=self.api_token.id).exists()
