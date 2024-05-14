import unittest
from unittest.mock import Mock, patch

import pytest
from django.http import Http404
from django.test.utils import override_settings

from sentry.api.bases.sentryapps import (
    SentryAppAndStaffPermission,
    SentryAppBaseEndpoint,
    SentryAppInstallationBaseEndpoint,
    SentryAppInstallationPermission,
    SentryAppPermission,
    add_integration_platform_metric_tag,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SentryAppPermissionTest(TestCase):
    def setUp(self):
        self.permission = SentryAppPermission()
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)
        self.request = self.make_request(user=self.user, method="GET")

        self.superuser = self.create_user(is_superuser=True)

    def test_request_user_is_app_owner_succeeds(self):
        assert self.permission.has_object_permission(self.request, None, self.sentry_app)

    def test_request_user_is_not_app_owner_fails(self):
        self.request.user = self.create_user()

        with pytest.raises(Http404):
            self.permission.has_object_permission(self.request, None, self.sentry_app)

    def test_has_permission(self):
        from sentry.models.apitoken import ApiToken

        token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
        self.request = self.make_request(user=None, auth=token, method="GET")
        assert self.permission.has_permission(self.request, None)

    def test_superuser_has_permission(self):
        request = self.make_request(user=self.superuser, method="GET", is_superuser=True)

        assert self.permission.has_object_permission(request, None, self.sentry_app)

        request.method = "POST"
        assert self.permission.has_object_permission(request, None, self.sentry_app)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_read_only(self):
        request = self.make_request(user=self.superuser, method="GET", is_superuser=True)

        assert self.permission.has_object_permission(request, None, self.sentry_app)

        request.method = "POST"

        with pytest.raises(Http404):
            self.permission.has_object_permission(request, None, self.sentry_app)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_write(self):
        self.add_user_permission(self.superuser, "superuser.write")
        request = self.make_request(user=self.superuser, method="GET", is_superuser=True)

        assert self.permission.has_object_permission(request, None, self.sentry_app)

        request.method = "POST"

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
        self.request = self.make_request(user=self.user, method="GET")
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)

    def test_retrieves_sentry_app(self):
        args, kwargs = self.endpoint.convert_args(self.request, self.sentry_app.slug)
        assert kwargs["sentry_app"].id == self.sentry_app.id

    def test_raises_when_sentry_app_not_found(self):
        with pytest.raises(Http404):
            self.endpoint.convert_args(self.request, "notanapp")


@control_silo_test
class SentryAppInstallationPermissionTest(TestCase):
    def setUp(self):
        self.permission = SentryAppInstallationPermission()
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )
        self.request = self.make_request(user=self.user, method="GET")

        self.superuser = self.create_user(is_superuser=True)

    def test_missing_request_user(self):
        self.request.user = None

        assert not self.permission.has_object_permission(self.request, None, self.installation)

    def test_request_user_in_organization(self):
        assert self.permission.has_object_permission(self.request, None, self.installation)

    def test_request_user_not_in_organization(self):
        request = self.make_request(user=self.create_user(), method="GET")
        with pytest.raises(Http404):
            self.permission.has_object_permission(request, None, self.installation)

    def test_superuser_has_permission(self):
        request = self.make_request(user=self.superuser, method="GET", is_superuser=True)

        assert self.permission.has_object_permission(request, None, self.installation)

        request.method = "POST"
        assert self.permission.has_object_permission(request, None, self.installation)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_read_only(self):
        request = self.make_request(user=self.superuser, method="GET", is_superuser=True)

        assert self.permission.has_object_permission(request, None, self.installation)

        request.method = "POST"
        with pytest.raises(Http404):
            self.permission.has_object_permission(request, None, self.installation)

    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission_write(self):
        self.add_user_permission(self.superuser, "superuser.write")
        request = self.make_request(user=self.superuser, method="GET", is_superuser=True)

        assert self.permission.has_object_permission(request, None, self.installation)

        request.method = "POST"
        self.permission.has_object_permission(request, None, self.installation)


@control_silo_test
class SentryAppInstallationBaseEndpointTest(TestCase):
    def setUp(self):
        self.endpoint = SentryAppInstallationBaseEndpoint()

        self.request = self.make_request(user=self.user, method="GET")
        self.sentry_app = self.create_sentry_app(name="foo", organization=self.organization)
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

    def test_retrieves_installation(self):
        args, kwargs = self.endpoint.convert_args(self.request, self.installation.uuid)
        assert kwargs["installation"].id == self.installation.id

    def test_raises_when_sentry_app_not_found(self):
        with pytest.raises(Http404):
            self.endpoint.convert_args(self.request, "1234")


@control_silo_test
class AddIntegrationPlatformMetricTagTest(unittest.TestCase):
    @patch("sentry.api.bases.sentryapps.add_request_metric_tags")
    def test_record_platform_integration_metric(self, add_request_metric_tags):
        @add_integration_platform_metric_tag
        def get(self, request, *args, **kwargs):
            pass

        request = Mock()
        endpoint = Mock(request=request)

        get(endpoint, request)

        add_request_metric_tags.assert_called_with(request, integration_platform=True)
