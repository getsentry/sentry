from functools import wraps

from django.http import Http404
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.serializers import ValidationError

from sentry.api.authentication import ClientIdSecretAuthentication
from sentry.api.base import Endpoint
from sentry.api.permissions import SentryPermission
from sentry.auth.superuser import is_active_superuser
from sentry.coreapi import APIError
from sentry.middleware.stats import add_request_metric_tags
from sentry.models import Organization, SentryApp, SentryAppInstallation
from sentry.utils.sdk import configure_scope
from sentry.utils.strings import to_single_line_str


def catch_raised_errors(func):
    @wraps(func)
    def wrapped(self, *args, **kwargs):
        try:
            return func(self, *args, **kwargs)
        except APIError as e:
            return Response({"detail": e.msg}, status=400)

    return wrapped


def ensure_scoped_permission(request, allowed_scopes):
    """
    Verifies the User making the request has at least one required scope for
    the endpoint being requested.

    If no scopes were specified in a ``scope_map``, it means the endpoint should
    not be accessible. That is, this function expects every accessible endpoint
    to have a list of scopes.

    That list of scopes may be empty, implying that the User does not need any
    specific scope and the endpoint is public.
    """
    # If no scopes were found at all, the endpoint should not be accessible.
    if allowed_scopes is None:
        return False

    # If there are no scopes listed, it implies a public endpoint.
    if len(allowed_scopes) == 0:
        return True

    return any(request.access.has_scope(s) for s in set(allowed_scopes))


def add_integration_platform_metric_tag(func):
    @wraps(func)
    def wrapped(self, *args, **kwargs):
        add_request_metric_tags(self.request, integration_platform=True)
        return func(self, *args, **kwargs)

    return wrapped


class SentryAppsPermission(SentryPermission):
    scope_map = {
        # GET is ideally a public endpoint but for now we are allowing for
        # anyone who has member permissions or above.
        "GET": (
            "event:read",
            "event:write",
            "event:admin",
            "project:releases",
            "project:read",
            "org:read",
            "member:read",
            "team:read",
        ),
        "POST": ("org:read", "org:integrations", "org:write", "org:admin"),
    }

    def has_object_permission(self, request, view, organization):
        if not hasattr(request, "user") or not request.user:
            return False

        self.determine_access(request, organization)

        if is_active_superuser(request):
            return True

        # User must be a part of the Org they're trying to create the app in.
        if organization not in request.user.get_orgs():
            raise Http404

        return ensure_scoped_permission(request, self.scope_map.get(request.method))


class IntegrationPlatformEndpoint(Endpoint):
    def dispatch(self, request, *args, **kwargs):
        add_request_metric_tags(request, integration_platform=True)
        return super().dispatch(request, *args, **kwargs)


class SentryAppsBaseEndpoint(IntegrationPlatformEndpoint):
    permission_classes = (SentryAppsPermission,)

    def _get_organization_slug(self, request):
        organization_slug = request.json_body.get("organization")
        if not organization_slug or not isinstance(organization_slug, str):
            error_message = """
                Please provide a valid value for the 'organization' field.
            """
            raise ValidationError({"organization": to_single_line_str(error_message)})
        return organization_slug

    def _get_organization_for_superuser(self, organization_slug):
        try:
            return Organization.objects.get(slug=organization_slug)
        except Organization.DoesNotExist:
            error_message = f"""
                Organization '{organization_slug}' does not exist.
            """
            raise ValidationError({"organization": to_single_line_str(error_message)})

    def _get_organization_for_user(self, user, organization_slug):
        try:
            return user.get_orgs().get(slug=organization_slug)
        except Organization.DoesNotExist:
            error_message = f"""
                User does not belong to the '{organization_slug}' organization.
            """
            raise PermissionDenied(to_single_line_str(error_message))

    def _get_organization(self, request):
        organization_slug = self._get_organization_slug(request)
        if is_active_superuser(request):
            return self._get_organization_for_superuser(organization_slug)
        else:
            user = request.user
            return self._get_organization_for_user(user, organization_slug)

    def convert_args(self, request, *args, **kwargs):
        # This baseclass is the the SentryApp collection endpoints:
        #
        #       [GET, POST] /sentry-apps
        #
        # The GET endpoint is public and doesn't require (or handle) any query
        # params or request body.
        #
        # The POST endpoint is for creating a Sentry App. Part of that creation
        # is associating it with the Organization that it's created within.
        #
        # So in the case of POST requests, we want to pull the Organization out
        # of the request body so that we can ensure the User making the request
        # has access to it.
        #
        # Since ``convert_args`` is conventionally where you materialize model
        # objects from URI params, we're applying the same logic for a param in
        # the request body.
        #
        if not request.json_body:
            return (args, kwargs)

        organization = self._get_organization(request)
        self.check_object_permissions(request, organization)
        kwargs["organization"] = organization

        return (args, kwargs)


class SentryAppPermission(SentryPermission):
    unpublished_scope_map = {
        "GET": ("org:read", "org:integrations", "org:write", "org:admin"),
        "PUT": ("org:read", "org:integrations", "org:write", "org:admin"),
        "POST": ("org:write", "org:admin"),  # used for publishing an app
        "DELETE": ("org:write", "org:admin"),
    }

    published_scope_map = {
        # GET is ideally a public endpoint but for now we are allowing for
        # anyone who has member permissions or above.
        "GET": (
            "event:read",
            "event:write",
            "event:admin",
            "project:releases",
            "project:read",
            "org:read",
            "member:read",
            "team:read",
        ),
        "PUT": ("org:write", "org:admin"),
        "POST": ("org:write", "org:admin"),
        "DELETE": ("org:admin"),
    }

    @property
    def scope_map(self):
        return self.published_scope_map

    def has_object_permission(self, request, view, sentry_app):
        if not hasattr(request, "user") or not request.user:
            return False

        self.determine_access(request, sentry_app.owner)

        if is_active_superuser(request):
            return True

        # if app is unpublished, user must be in the Org who owns the app.
        if not sentry_app.is_published:
            if sentry_app.owner not in request.user.get_orgs():
                raise Http404

        # TODO(meredith): make a better way to allow for public
        # endpoints. we can't use ensure_scoped_permission now
        # that the public endpoint isn't denoted by '()'
        if sentry_app.is_published and request.method == "GET":
            return True

        return ensure_scoped_permission(
            request, self._scopes_for_sentry_app(sentry_app).get(request.method)
        )

    def _scopes_for_sentry_app(self, sentry_app):
        if sentry_app.is_published:
            return self.published_scope_map
        else:
            return self.unpublished_scope_map


class SentryAppBaseEndpoint(IntegrationPlatformEndpoint):
    permission_classes = (SentryAppPermission,)

    def convert_args(self, request, sentry_app_slug, *args, **kwargs):
        try:
            sentry_app = SentryApp.objects.get(slug=sentry_app_slug)
        except SentryApp.DoesNotExist:
            raise Http404

        self.check_object_permissions(request, sentry_app)

        with configure_scope() as scope:
            scope.set_tag("sentry_app", sentry_app.slug)

        kwargs["sentry_app"] = sentry_app
        return (args, kwargs)


class SentryAppInstallationsPermission(SentryPermission):
    scope_map = {
        "GET": ("org:read", "org:integrations", "org:write", "org:admin"),
        "POST": ("org:integrations", "org:write", "org:admin"),
    }

    def has_object_permission(self, request, view, organization):
        if not hasattr(request, "user") or not request.user:
            return False

        self.determine_access(request, organization)

        if is_active_superuser(request):
            return True

        if organization not in request.user.get_orgs():
            raise Http404

        return ensure_scoped_permission(request, self.scope_map.get(request.method))


class SentryAppInstallationsBaseEndpoint(IntegrationPlatformEndpoint):
    permission_classes = (SentryAppInstallationsPermission,)

    def convert_args(self, request, organization_slug, *args, **kwargs):
        if is_active_superuser(request):
            organizations = Organization.objects.all()
        else:
            organizations = request.user.get_orgs()

        try:
            organization = organizations.get(slug=organization_slug)
        except Organization.DoesNotExist:
            raise Http404
        self.check_object_permissions(request, organization)

        kwargs["organization"] = organization
        return (args, kwargs)


class SentryAppInstallationPermission(SentryPermission):
    scope_map = {
        "GET": ("org:read", "org:integrations", "org:write", "org:admin"),
        "DELETE": ("org:integrations", "org:write", "org:admin"),
        # NOTE(mn): The only POST endpoint right now is to create External
        # Issues, which uses this baseclass since it's nested under an
        # installation.
        #
        # The scopes below really only make sense for that endpoint. Any other
        # nested endpoints will probably need different scopes - figure out how
        # to deal with that when it happens.
        "POST": ("org:integrations", "event:write", "event:admin"),
    }

    def has_permission(self, request, *args, **kwargs):
        # To let the app mark the installation as installed, we don't care about permissions
        if (
            hasattr(request, "user")
            and hasattr(request.user, "is_sentry_app")
            and request.user.is_sentry_app
            and request.method == "PUT"
        ):
            return True
        return super().has_permission(request, *args, **kwargs)

    def has_object_permission(self, request, view, installation):
        if not hasattr(request, "user") or not request.user:
            return False

        self.determine_access(request, installation.organization)

        if is_active_superuser(request):
            return True

        # if user is an app, make sure it's for that same app
        if request.user.is_sentry_app:
            return request.user == installation.sentry_app.proxy_user

        if installation.organization not in request.user.get_orgs():
            raise Http404

        return ensure_scoped_permission(request, self.scope_map.get(request.method))


class SentryAppInstallationBaseEndpoint(IntegrationPlatformEndpoint):
    permission_classes = (SentryAppInstallationPermission,)

    def convert_args(self, request, uuid, *args, **kwargs):
        try:
            installation = SentryAppInstallation.objects.get(uuid=uuid)
        except SentryAppInstallation.DoesNotExist:
            raise Http404

        self.check_object_permissions(request, installation)

        with configure_scope() as scope:
            scope.set_tag("sentry_app_installation", installation.uuid)

        kwargs["installation"] = installation
        return (args, kwargs)


class SentryAppInstallationExternalIssuePermission(SentryAppInstallationPermission):
    scope_map = {
        "POST": ("event:read", "event:write", "event:admin"),
        "DELETE": ("event:admin",),
    }


class SentryAppInstallationExternalIssueBaseEndpoint(SentryAppInstallationBaseEndpoint):
    permission_classes = (SentryAppInstallationExternalIssuePermission,)


class SentryAppAuthorizationsPermission(SentryPermission):
    def has_object_permission(self, request, view, installation):
        if not hasattr(request, "user") or not request.user:
            return False

        self.determine_access(request, installation.organization)

        if not request.user.is_sentry_app:
            return False

        # Request must be made as the app's Proxy User, using their Client ID
        # and Secret.
        return request.user == installation.sentry_app.proxy_user


class SentryAppAuthorizationsBaseEndpoint(SentryAppInstallationBaseEndpoint):
    authentication_classes = (ClientIdSecretAuthentication,)
    permission_classes = (SentryAppAuthorizationsPermission,)


class SentryInternalAppTokenPermission(SentryPermission):
    scope_map = {
        "GET": ("org:read", "org:integrations", "org:write", "org:admin"),
        "POST": ("org:read", "org:integrations", "org:write", "org:admin"),
        "DELETE": ("org:write", "org:admin"),
    }

    def has_object_permission(self, request, view, sentry_app):
        if not hasattr(request, "user") or not request.user:
            return False

        self.determine_access(request, sentry_app.owner)

        if is_active_superuser(request):
            return True

        return ensure_scoped_permission(request, self.scope_map.get(request.method))


class SentryAppStatsPermission(SentryPermission):
    scope_map = {
        "GET": ("org:read", "org:integrations", "org:write", "org:admin"),
        # Anyone logged in can increment the stats, so leave the scopes empty
        # Note: this only works for session-based auth so you cannot increment stats through API
        "POST": (),
    }

    def has_object_permission(self, request, view, sentry_app):
        if not hasattr(request, "user") or not request.user:
            return False

        self.determine_access(request, sentry_app.owner)

        if is_active_superuser(request):
            return True

        return ensure_scoped_permission(request, self.scope_map.get(request.method))
