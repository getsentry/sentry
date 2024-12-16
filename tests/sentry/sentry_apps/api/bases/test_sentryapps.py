import unittest
from unittest.mock import Mock, patch

import pytest
from django.contrib.auth.models import AnonymousUser
from django.test.utils import override_settings
from rest_framework.request import Request

from sentry.sentry_apps.api.bases.sentryapps import (
    SentryAppAndStaffPermission,
    SentryAppBaseEndpoint,
    SentryAppInstallationBaseEndpoint,
    SentryAppInstallationPermission,
    SentryAppPermission,
    add_integration_platform_metric_tag,
)
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user import User


@control_silo_test
class SentryAppPermissionTest(TestCase):
    def setUp(self):
        self.endpoint = SentryAppBaseEndpoint()
        self.permission = SentryAppPermission()

        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)
        self.request = self.endpoint.initialize_request(
            request=self.make_request(user=self.user, method="GET"), endpoint=self.endpoint
        )

        self.superuser = self.create_user(is_superuser=True)

    def test_request_user_is_app_owner_succeeds(self):
        assert self.permission.has_object_permission(self.request, None, self.sentry_app)

    def test_request_user_is_not_app_owner_fails(self):
        non_owner: User = self.create_user()
        self.request = self.endpoint.initialize_request(
            request=self.make_request(user=non_owner, method="GET"), endpoint=self.endpoint
        )

        with pytest.raises(SentryAppIntegratorError):
            self.permission.has_object_permission(self.request, None, self.sentry_app)

    def test_has_permission(self):
        from sentry.models.apitoken import ApiToken

        token: ApiToken = ApiToken.objects.create(
            user=self.user, scope_list=["event:read", "org:read"]
        )
        request = self.make_request(user=None, auth=token, method="GET")

        # Need to set token here, else UserAuthTokenAuthentication won't be able to find it & fail auth
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token.plaintext_token}"
        self.request = self.endpoint.initialize_request(request=request, endpoint=self.endpoint)

        assert self.permission.has_permission(self.request, None)

    def test_superuser_has_permission(self):
        request = self.endpoint.initialize_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True),
            endpoint=self.endpoint,
        )

        assert self.permission.has_object_permission(request, None, self.sentry_app)

        request._request.method = "POST"
        assert self.permission.has_object_permission(request, None, self.sentry_app)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_read_only(self):
        request = self.endpoint.initialize_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True),
            endpoint=self.endpoint,
        )

        assert self.permission.has_object_permission(request, None, self.sentry_app)

        request._request.method = "POST"

        with pytest.raises(SentryAppIntegratorError):
            self.permission.has_object_permission(request, None, self.sentry_app)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_write(self):
        self.add_user_permission(self.superuser, "superuser.write")
        request = self.endpoint.initialize_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True),
            endpoint=self.endpoint,
        )

        assert self.permission.has_object_permission(request, None, self.sentry_app)

        self.request._request.method = "POST"

        self.permission.has_object_permission(request, None, self.sentry_app)


@control_silo_test
class SentryAppAndStaffPermissionTest(TestCase):
    def setUp(self):
        self.permission = SentryAppAndStaffPermission()
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)

    def test_superuser_has_permission(self):
        superuser = self.create_user(is_superuser=True)
        request = self.make_request(user=superuser, method="GET", is_superuser=True)

        assert self.permission.has_object_permission(request, None, self.sentry_app)

        request.method = "POST"
        assert self.permission.has_object_permission(request, None, self.sentry_app)

    def test_staff_has_permission(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

        request = self.make_request(user=staff_user, method="GET", is_staff=True)

        assert self.permission.has_object_permission(request, None, self.sentry_app)

        request.method = "POST"
        assert self.permission.has_object_permission(request, None, self.sentry_app)


@control_silo_test
class SentryAppBaseEndpointTest(TestCase):
    def setUp(self):
        self.endpoint = SentryAppBaseEndpoint()
        self.request = self.endpoint.initialize_request(
            self.make_request(user=self.user, method="GET")
        )
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)

    def test_retrieves_sentry_app(self):
        args, kwargs = self.endpoint.convert_args(self.request, self.sentry_app.slug)
        assert kwargs["sentry_app"].id == self.sentry_app.id

    def test_raises_when_sentry_app_not_found(self):
        with pytest.raises(SentryAppIntegratorError):
            self.endpoint.convert_args(self.request, "notanapp")


@control_silo_test
class SentryAppInstallationPermissionTest(TestCase):
    def setUp(self):
        self.request: Request
        self.endpoint = SentryAppInstallationBaseEndpoint()
        self.permission = SentryAppInstallationPermission()

        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

        self.superuser = self.create_user(is_superuser=True)

    def test_missing_request_user(self):
        self.request = self.endpoint.initialize_request(
            self.make_request(user=AnonymousUser(), method="GET"), endpoint=self.endpoint
        )

        assert not self.permission.has_object_permission(self.request, None, self.installation)

    def test_request_user_in_organization(self):
        self.request = self.endpoint.initialize_request(
            self.make_request(user=self.user, method="GET"), endpoint=self.endpoint
        )

        assert self.permission.has_object_permission(self.request, None, self.installation)

    def test_request_user_not_in_organization(self):
        user = self.create_user()
        request = self.endpoint.initialize_request(
            self.make_request(user=user, method="GET"), endpoint=self.endpoint
        )

        with pytest.raises(SentryAppIntegratorError):
            self.permission.has_object_permission(request, None, self.installation)

    def test_superuser_has_permission(self):
        request = self.endpoint.initialize_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True),
            endpoint=self.endpoint,
        )

        assert self.permission.has_object_permission(request, None, self.installation)

        request._request.method = "POST"
        assert self.permission.has_object_permission(request, None, self.installation)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_read_only(self):
        request = self.endpoint.initialize_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True),
            endpoint=self.endpoint,
        )

        assert self.permission.has_object_permission(request, None, self.installation)

        request._request.method = "POST"
        with pytest.raises(SentryAppIntegratorError):
            self.permission.has_object_permission(request, None, self.installation)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_write(self):
        self.add_user_permission(self.superuser, "superuser.write")
        request = self.endpoint.initialize_request(
            self.make_request(user=self.superuser, method="GET", is_superuser=True),
            endpoint=self.endpoint,
        )

        assert self.permission.has_object_permission(request, None, self.installation)

        request._request.method = "POST"
        self.permission.has_object_permission(request, None, self.installation)


@control_silo_test
class SentryAppInstallationBaseEndpointTest(TestCase):
    def setUp(self):
        self.endpoint = SentryAppInstallationBaseEndpoint()

        self.request = self.endpoint.initialize_request(
            self.make_request(user=self.user, method="GET")
        )
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

    def test_retrieves_installation(self):
        args, kwargs = self.endpoint.convert_args(self.request, self.installation.uuid)
        assert kwargs["installation"].id == self.installation.id

    def test_raises_when_sentry_app_not_found(self):
        with pytest.raises(SentryAppIntegratorError):
            self.endpoint.convert_args(self.request, "1234")


@control_silo_test
class AddIntegrationPlatformMetricTagTest(unittest.TestCase):
    @patch("sentry.sentry_apps.api.bases.sentryapps.add_request_metric_tags")
    def test_record_platform_integration_metric(self, add_request_metric_tags):
        @add_integration_platform_metric_tag
        def get(self, request, *args, **kwargs):
            pass

        request = Mock()
        endpoint = Mock(request=request)

        get(endpoint, request)

        add_request_metric_tags.assert_called_with(request, integration_platform=True)
