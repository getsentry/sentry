from __future__ import absolute_import

from rest_framework.permissions import IsAuthenticated

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import ScopedPermission
from sentry.app import raven
from sentry.models import SentryApp, SentryAppInstallation


class SentryAppDetailsPermission(ScopedPermission):
    def has_object_permission(self, request, view, sentry_app):
        return sentry_app.owner == request.user.get_orgs() or request.user.is_superuser



class SentryAppDetailsEndpoint(Endpoint):
    authentication_classes = (IsAuthenticated, )
    permission_classes = (SentryAppDetailsPermission, )

    def convert_args(self, request, sentry_app_slug, *args, **kwargs):
        try:
            sentry_app = SentryApp.objects.get_from_cache(slug=sentry_app_slug)
        except SentryApp.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, sentry_app)

        raven.tags_context({
            'sentry_app': sentry_app.id,
        })

        kwargs['sentry_app'] = sentry_app
        return (args, kwargs)


class SentryAppInstallationDetailsPermission(ScopedPermission):
    def has_object_permission(self, request, view, install):
        if not request.user:
            return False
        return install.organization in request.user.get_orgs()


class SentryAppInstallationDetailsEndpoint(Endpoint):
    authentication_classes = (IsAuthenticated, )
    permission_classes = (SentryAppInstallationDetailsPermission, )

    def convert_args(self, request, uuid, *args, **kwargs):
        try:
            install = SentryAppInstallation.objects.get_from_cache(uuid=uuid)
        except SentryAppInstallation.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, install)

        raven.tags_context({
            'sentry_app_installation': install.id,
        })

        kwargs['install'] = install
        return (args, kwargs)


class SentryAppInstallationAuthorizationPermission(ScopedPermission):
    def has_object_permission(self, request, view, install):
        if not request.user.is_sentry_app:
            return False
        return request.user == install.sentry_app.proxy_user


class SentryAppInstallationAuthorizationEndpoint(SentryAppInstallationDetailsEndpoint):
    permission_classes = (SentryAppInstallationAuthorizationPermission, )
