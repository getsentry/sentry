import pytest
from django.contrib.auth.models import AnonymousUser
from django.test.utils import override_settings
from rest_framework.views import APIView

from sentry.sentry_apps.api.bases.sentryapps import (
    SentryAppAndStaffPermission,
    SentryAppBaseEndpoint,
    SentryAppInstallationBaseEndpoint,
    SentryAppInstallationPermission,
    SentryAppPermission,
)
from sentry.sentry_apps.utils.errors import SentryAppError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.requests import drf_request_from_request
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SentryAppPermissionTest(TestCase):
    def setUp(self):
        self.permission = SentryAppPermission()

        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)
        self.request = drf_request_from_request(self.make_request(user=self.user, method="GET"))

        self.superuser = self.create_user(is_superuser=True)

    def test_request_user_is_app_owner_succeeds(self):
        assert self.permission.has_object_permission(self.request, APIView(), self.sentry_app)

    def test_request_user_is_not_app_owner_fails(self):
        non_owner = self.create_user()
        self.request = drf_request_from_request(self.make_request(user=non_owner, method="GET"))

        with pytest.raises(SentryAppError):
            self.permission.has_object_permission(self.request, APIView(), self.sentry_app)

    def test_has_permission(self):
        from sentry.models.apitoken import ApiToken

        token: ApiToken = ApiToken.objects.create(
            user=self.user, scope_list=["event:read", "org:read"]
        )
        request = self.make_request(user=None, auth=token, method="GET")

        # Need to set token here, else UserAuthTokenAuthentication won't be able to find it & fail auth
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token.plaintext_token}"
        self.request = drf_request_from_request(request)

        assert self.permission.has_permission(self.request, APIView())

    def test_superuser_has_permission(self):
        request = drf_request_from_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

        request._request.method = "POST"
        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_read_only(self):
        request = drf_request_from_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

        request._request.method = "POST"

        with pytest.raises(SentryAppError):
            self.permission.has_object_permission(request, APIView(), self.sentry_app)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_write(self):
        self.add_user_permission(self.superuser, "superuser.write")
        request = drf_request_from_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

        self.request._request.method = "POST"

        self.permission.has_object_permission(request, APIView(), self.sentry_app)


@control_silo_test
class SentryAppAndStaffPermissionTest(TestCase):
    def setUp(self):
        self.permission = SentryAppAndStaffPermission()
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)

    def test_superuser_has_permission(self):
        superuser = self.create_user(is_superuser=True)
        request = drf_request_from_request(
            self.make_request(user=superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

        request.method = "POST"
        assert self.permission.has_object_permission(request, APIView(), self.sentry_app)

    def test_staff_has_permission(self):
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
    def setUp(self):
        self.endpoint = SentryAppBaseEndpoint()
        self.request = drf_request_from_request(self.make_request(user=self.user, method="GET"))
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)

    def test_retrieves_sentry_app(self):
        args, kwargs = self.endpoint.convert_args(self.request, self.sentry_app.slug)
        assert kwargs["sentry_app"].id == self.sentry_app.id

    def test_raises_when_sentry_app_not_found(self):
        with pytest.raises(SentryAppError):
            self.endpoint.convert_args(self.request, "notanapp")


@control_silo_test
class SentryAppInstallationPermissionTest(TestCase):
    def setUp(self):
        self.permission = SentryAppInstallationPermission()

        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

        self.superuser = self.create_user(is_superuser=True)

    def test_missing_request_user(self):
        request = drf_request_from_request(self.make_request(user=AnonymousUser(), method="GET"))

        assert not self.permission.has_object_permission(request, APIView(), self.installation)

    def test_request_user_in_organization(self):
        request = drf_request_from_request(self.make_request(user=self.user, method="GET"))

        assert self.permission.has_object_permission(request, APIView(), self.installation)

    def test_request_user_not_in_organization(self):
        user = self.create_user()
        request = drf_request_from_request(self.make_request(user=user, method="GET"))

        with pytest.raises(SentryAppError):
            self.permission.has_object_permission(request, APIView(), self.installation)

    def test_superuser_has_permission(self):
        request = drf_request_from_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.installation)

        request._request.method = "POST"
        assert self.permission.has_object_permission(request, APIView(), self.installation)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_read_only(self):
        request = drf_request_from_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.installation)

        request._request.method = "POST"
        with pytest.raises(SentryAppError):
            self.permission.has_object_permission(request, APIView(), self.installation)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_write(self):
        self.add_user_permission(self.superuser, "superuser.write")
        request = drf_request_from_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True)
        )

        assert self.permission.has_object_permission(request, APIView(), self.installation)

        request._request.method = "POST"
        self.permission.has_object_permission(request, APIView(), self.installation)


@control_silo_test
class SentryAppInstallationBaseEndpointTest(TestCase):
    def setUp(self):
        self.endpoint = SentryAppInstallationBaseEndpoint()

        self.request = drf_request_from_request(self.make_request(user=self.user, method="GET"))
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

    def test_retrieves_installation(self):
        args, kwargs = self.endpoint.convert_args(self.request, self.installation.uuid)
        assert kwargs["installation"].id == self.installation.id

    def test_raises_when_sentry_app_not_found(self):
        with pytest.raises(SentryAppError):
            self.endpoint.convert_args(self.request, "1234")
