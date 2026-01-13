import pytest
from django.contrib.auth.models import AnonymousUser
from django.test.utils import override_settings
from rest_framework.views import APIView

from sentry.sentry_apps.api.bases.sentryapps import (
    IntegrationPlatformEndpoint,
    SentryAppAndStaffPermission,
    SentryAppBaseEndpoint,
    SentryAppInstallationBaseEndpoint,
    SentryAppInstallationPermission,
    SentryAppPermission,
    handle_sentry_app_exception,
)
from sentry.sentry_apps.utils.errors import (
    SentryAppError,
    SentryAppIntegratorError,
    SentryAppSentryError,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.requests import drf_request_from_request
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SentryAppPermissionTest(TestCase):
    def setUp(self) -> None:
        self.permission = SentryAppPermission()

        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)
        self.request = drf_request_from_request(self.make_request(user=self.user, method="GET"))

        self.superuser = self.create_user(is_superuser=True)

    def test_request_user_is_app_owner_succeeds(self) -> None:
        assert self.permission.has_object_permission(self.request, APIView(), self.sentry_app)

    def test_request_user_is_not_app_owner_fails(self) -> None:
        non_owner = self.create_user()
        self.request = drf_request_from_request(self.make_request(user=non_owner, method="GET"))

        with pytest.raises(SentryAppError):
            self.permission.has_object_permission(self.request, APIView(), self.sentry_app)

    def test_has_permission(self) -> None:
        from sentry.models.apitoken import ApiToken

        token: ApiToken = ApiToken.objects.create(
            user=self.user, scope_list=["event:read", "org:read"]
        )
        request = self.make_request(user=None, auth=token, method="GET")

        # Need to set token here, else UserAuthTokenAuthentication won't be able to find it & fail auth
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token.plaintext_token}"
        self.request = drf_request_from_request(request)

        assert self.permission.has_permission(self.request, APIView())

    def test_superuser_has_permission(self) -> None:
        request = drf_request_from_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

        request._request.method = "POST"
        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_read_only(self) -> None:
        request = drf_request_from_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

        request._request.method = "POST"

        with pytest.raises(SentryAppError):
            self.permission.has_object_permission(request, APIView(), self.sentry_app)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_write(self) -> None:
        self.add_user_permission(self.superuser, "superuser.write")
        request = drf_request_from_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

        self.request._request.method = "POST"

        self.permission.has_object_permission(request, APIView(), self.sentry_app)


@control_silo_test
class SentryAppAndStaffPermissionTest(TestCase):
    def setUp(self) -> None:
        self.permission = SentryAppAndStaffPermission()
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)

    def test_superuser_has_permission(self) -> None:
        superuser = self.create_user(is_superuser=True)
        request = drf_request_from_request(
            self.make_request(user=superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

        request.method = "POST"
        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

    def test_staff_has_permission(self) -> None:
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

        request = drf_request_from_request(
            self.make_request(user=staff_user, method="GET", is_staff=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

        request.method = "POST"
        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)


@control_silo_test
class SentryAppBaseEndpointTest(TestCase):
    def setUp(self) -> None:
        self.endpoint = SentryAppBaseEndpoint()
        self.request = drf_request_from_request(self.make_request(user=self.user, method="GET"))
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)

    def test_retrieves_sentry_app(self) -> None:
        args, kwargs = self.endpoint.convert_args(self.request, self.sentry_app.slug)
        assert kwargs["sentry_app"].id == self.sentry_app.id

    def test_raises_when_sentry_app_not_found(self) -> None:
        with pytest.raises(SentryAppError):
            self.endpoint.convert_args(self.request, "notanapp")


@control_silo_test
class SentryAppInstallationPermissionTest(TestCase):
    def setUp(self) -> None:
        self.permission = SentryAppInstallationPermission()

        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

        self.superuser = self.create_user(is_superuser=True)

    def test_missing_request_user(self) -> None:
        request = drf_request_from_request(self.make_request(user=AnonymousUser(), method="GET"))

        assert not self.permission.has_object_permission(request, APIView(), self.installation)

    def test_request_user_in_organization(self) -> None:
        request = drf_request_from_request(self.make_request(user=self.user, method="GET"))

        assert self.permission.has_object_permission(request, APIView(), self.installation)

    def test_request_user_not_in_organization(self) -> None:
        user = self.create_user()
        request = drf_request_from_request(self.make_request(user=user, method="GET"))

        with pytest.raises(SentryAppError):
            self.permission.has_object_permission(request, APIView(), self.installation)

    def test_superuser_has_permission(self) -> None:
        request = drf_request_from_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.installation)

        request._request.method = "POST"
        assert self.permission.has_object_permission(request, APIView(), self.installation)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_read_only(self) -> None:
        request = drf_request_from_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.installation)

        request._request.method = "POST"
        with pytest.raises(SentryAppError):
            self.permission.has_object_permission(request, APIView(), self.installation)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_write(self) -> None:
        self.add_user_permission(self.superuser, "superuser.write")
        request = drf_request_from_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.installation)

        request._request.method = "POST"
        self.permission.has_object_permission(request, APIView(), self.installation)


@control_silo_test
class SentryAppInstallationBaseEndpointTest(TestCase):
    def setUp(self) -> None:
        self.endpoint = SentryAppInstallationBaseEndpoint()

        self.request = drf_request_from_request(self.make_request(user=self.user, method="GET"))
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

    def test_retrieves_installation(self) -> None:
        args, kwargs = self.endpoint.convert_args(self.request, self.installation.uuid)
        assert kwargs["installation"].id == self.installation.id

    def test_raises_when_sentry_app_not_found(self) -> None:
        with pytest.raises(SentryAppError):
            self.endpoint.convert_args(self.request, "1234")


@control_silo_test
class IntegrationPlatformEndpointTest(TestCase):
    def setUp(self) -> None:
        self.endpoint = IntegrationPlatformEndpoint()

    def test_handle_sentry_app_error(self) -> None:
        error = SentryAppError(message="cool", status_code=400)
        response = handle_sentry_app_exception(error)

        assert response.status_code == 400
        assert response.exception is True
        assert response.data == {"detail": error.message}

    def test_handle_sentry_app_integrator_error(self) -> None:
        public_context = {"help": "123423123"}
        error = SentryAppIntegratorError(
            message="yep",
            webhook_context={"hi": "bye!"},
            public_context=public_context,
            status_code=400,
        )
        response = handle_sentry_app_exception(error)

        assert response.status_code == 400
        assert response.exception is True
        assert response.data == {"detail": error.message, "context": public_context}

    def test_handle_sentry_app_sentry_error(self) -> None:
        public_context = {"help": "123423123"}
        error = SentryAppSentryError(
            message="bruh", webhook_context={"bruh": "bruhhh"}, public_context=public_context
        )
        response = handle_sentry_app_exception(error)

        assert response.status_code == 500
        assert response.data == {
            "detail": f"An issue occured during the integration platform process. Sentry error ID: {None}"
        }
