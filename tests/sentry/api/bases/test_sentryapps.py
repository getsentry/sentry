from __future__ import absolute_import

from django.http import HttpRequest

from sentry.testutils import TestCase
from sentry.api.bases.sentryapps import (
    SentryAppDetailsPermission,
    SentryAppDetailsEndpoint,
    SentryAppInstallationDetailsPermission,
    SentryAppInstallationDetailsEndpoint,
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.mediators.sentry_app_installations import Creator as SentryAppInstallationCreator


class SentryAppDetailsPermissionTest(TestCase):
    def setUp(self):
        self.permission = SentryAppDetailsPermission()
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)

        self.sentry_app = self.create_sentry_app(
            name='foo',
            organization=self.org,
        )

        self.request = HttpRequest()
        self.request.user = self.user

    def test_request_user_is_app_owner_succeeds(self):
        assert self.permission.has_object_permission(self.request, None, self.sentry_app)

    def test_request_user_is_not_app_owner_fails(self):
        self.request.user = self.create_user()
        assert not self.permission.has_object_permission(self.request, None, self.sentry_app)


class SentryAppDetailsEndpointTest(TestCase):
    def setUp(self):
        self.endpoint = SentryAppDetailsEndpoint()

        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)

        self.request = HttpRequest()
        self.request.user = self.user
        self.request.successful_authenticator = True

        self.sentry_app = self.create_sentry_app(
            name='foo',
            organization=self.org,
        )

    def test_retrieves_sentry_app(self):
        args, kwargs = self.endpoint.convert_args(self.request, self.sentry_app.slug)
        assert kwargs['sentry_app'] == self.sentry_app

    def test_raises_when_sentry_app_not_found(self):
        with self.assertRaises(ResourceDoesNotExist):
            self.endpoint.convert_args(self.request, 'notanapp')


class SentryAppInstallationDetailsPermissionTest(TestCase):
    def setUp(self):
        self.permission = SentryAppInstallationDetailsPermission()

        self.user = self.create_user()
        self.member = self.create_user()
        self.org = self.create_organization(owner=self.member)

        self.sentry_app = self.create_sentry_app(
            name='foo',
            organization=self.org,
        )
        self.installation, _ = SentryAppInstallationCreator.run(
            slug=self.sentry_app.slug,
            organization=self.org,
        )

        self.request = HttpRequest()
        self.request.user = self.user

    def test_missing_request_user(self):
        self.request.user = None

        assert not self.permission.has_object_permission(
            self.request,
            None,
            self.installation,
        )

    def test_request_user_in_organization(self):
        self.request.user = self.member

        assert self.permission.has_object_permission(
            self.request,
            None,
            self.installation,
        )

    def test_request_user_not_in_organization(self):
        assert not self.permission.has_object_permission(
            self.request,
            None,
            self.installation,
        )


class SentryAppInstallationDetailsEndpointTest(TestCase):
    def setUp(self):
        self.endpoint = SentryAppInstallationDetailsEndpoint()

        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)

        self.request = HttpRequest()
        self.request.user = self.user
        self.request.successful_authenticator = True

        self.sentry_app = self.create_sentry_app(
            name='foo',
            organization=self.org,
        )

        self.installation, _ = SentryAppInstallationCreator.run(
            slug=self.sentry_app.slug,
            organization=self.org,
        )

    def test_retrieves_installation(self):
        args, kwargs = self.endpoint.convert_args(self.request, self.installation.uuid)
        assert kwargs['install'] == self.installation

    def test_raises_when_sentry_app_not_found(self):
        with self.assertRaises(ResourceDoesNotExist):
            self.endpoint.convert_args(self.request, '1234')
