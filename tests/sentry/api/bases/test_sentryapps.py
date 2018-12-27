from __future__ import absolute_import

from django.http import Http404

from sentry.testutils import TestCase
from sentry.api.bases.sentryapps import (
    SentryAppPermission,
    SentryAppBaseEndpoint,
    SentryAppInstallationPermission,
    SentryAppInstallationBaseEndpoint,
)
from sentry.mediators.sentry_app_installations import Creator as SentryAppInstallationCreator


class SentryAppPermissionTest(TestCase):
    def setUp(self):
        self.permission = SentryAppPermission()
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)

        self.sentry_app = self.create_sentry_app(
            name='foo',
            organization=self.org,
        )

        self.request = self.make_request(user=self.user, method='GET')

    def test_request_user_is_app_owner_succeeds(self):
        assert self.permission.has_object_permission(self.request, None, self.sentry_app)

    def test_request_user_is_not_app_owner_fails(self):
        self.request.user = self.create_user()

        with self.assertRaises(Http404):
            self.permission.has_object_permission(self.request, None, self.sentry_app)


class SentryAppBaseEndpointTest(TestCase):
    def setUp(self):
        self.endpoint = SentryAppBaseEndpoint()

        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)

        self.request = self.make_request(user=self.user, method='GET')

        self.sentry_app = self.create_sentry_app(
            name='foo',
            organization=self.org,
        )

    def test_retrieves_sentry_app(self):
        args, kwargs = self.endpoint.convert_args(self.request, self.sentry_app.slug)
        assert kwargs['sentry_app'] == self.sentry_app

    def test_raises_when_sentry_app_not_found(self):
        with self.assertRaises(Http404):
            self.endpoint.convert_args(self.request, 'notanapp')


class SentryAppInstallationPermissionTest(TestCase):
    def setUp(self):
        self.permission = SentryAppInstallationPermission()

        self.user = self.create_user()
        self.member = self.create_user()
        self.org = self.create_organization(owner=self.member)

        self.sentry_app = self.create_sentry_app(
            name='foo',
            organization=self.org,
        )

        self.installation = SentryAppInstallationCreator.run(
            slug=self.sentry_app.slug,
            organization=self.org,
            user=self.user,
        )

        self.request = self.make_request(user=self.user, method='GET')

    def test_missing_request_user(self):
        self.request.user = None

        assert not self.permission.has_object_permission(
            self.request,
            None,
            self.installation,
        )

    def test_request_user_in_organization(self):
        self.request = self.make_request(user=self.member, method='GET')

        assert self.permission.has_object_permission(
            self.request,
            None,
            self.installation,
        )

    def test_request_user_not_in_organization(self):
        with self.assertRaises(Http404):
            self.permission.has_object_permission(
                self.request,
                None,
                self.installation,
            )


class SentryAppInstallationBaseEndpointTest(TestCase):
    def setUp(self):
        self.endpoint = SentryAppInstallationBaseEndpoint()

        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)

        self.request = self.make_request(user=self.user, method='GET')

        self.sentry_app = self.create_sentry_app(
            name='foo',
            organization=self.org,
        )

        self.installation = SentryAppInstallationCreator.run(
            slug=self.sentry_app.slug,
            organization=self.org,
            user=self.user,
        )

    def test_retrieves_installation(self):
        args, kwargs = self.endpoint.convert_args(self.request, self.installation.uuid)
        assert kwargs['installation'] == self.installation

    def test_raises_when_sentry_app_not_found(self):
        with self.assertRaises(Http404):
            self.endpoint.convert_args(self.request, '1234')
