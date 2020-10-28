from __future__ import absolute_import

import sentry

from django.core.cache import cache
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.messages import get_messages
from django.db.models import F
from pkg_resources import parse_version

from sentry import features, options
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.user import DetailedUserSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.models import ProjectKey
from sentry.utils import auth
from sentry.utils.email import is_smtp_enabled
from sentry.utils.assets import get_asset_url
from sentry.utils.support import get_support_mail


def _get_version_info():
    current = sentry.VERSION

    latest = options.get("sentry:latest_version") or current
    upgrade_available = parse_version(latest) > parse_version(current)
    build = sentry.__build__ or current

    return {
        "current": current,
        "latest": latest,
        "build": build,
        "upgradeAvailable": upgrade_available,
    }


def _needs_upgrade():
    version_configured = options.get("sentry:version-configured")
    if not version_configured:
        # If we were never previously upgraded (being a new install)
        # we want to force an upgrade, even if the values are set.
        return True

    smtp_disabled = not is_smtp_enabled()

    # Check all required options to see if they've been set
    for key in options.filter(flag=options.FLAG_REQUIRED):
        # ignore required flags which can be empty
        if key.flags & options.FLAG_ALLOW_EMPTY:
            continue
        # Ignore mail.* keys if smtp is disabled
        if smtp_disabled and key.name[:5] == "mail.":
            continue
        if not options.isset(key.name):
            return True

    if version_configured != sentry.get_version():
        # Everything looks good, but version changed, so let's bump it
        options.set("sentry:version-configured", sentry.get_version())

    return False


def _get_statuspage():
    id = settings.STATUS_PAGE_ID
    if id is None:
        return None
    return {"id": id, "api_host": settings.STATUS_PAGE_API_HOST}


def _get_project_key(project_id):
    try:
        return ProjectKey.objects.filter(
            project=project_id, roles=F("roles").bitor(ProjectKey.roles.store)
        )[0]
    except IndexError:
        return None


def _get_public_dsn():
    if settings.SENTRY_FRONTEND_DSN:
        return settings.SENTRY_FRONTEND_DSN

    project_id = settings.SENTRY_FRONTEND_PROJECT or settings.SENTRY_PROJECT
    cache_key = "dsn:%s" % (project_id,)

    result = cache.get(cache_key)
    if result is None:
        key = _get_project_key(project_id)
        if key:
            result = key.dsn_public
        else:
            result = ""
        cache.set(cache_key, result, 60)
    return result


def _get_dsn_requests():
    if settings.SENTRY_FRONTEND_REQUESTS_DSN:
        return settings.SENTRY_FRONTEND_REQUESTS_DSN

    return ""


def get_client_config(request=None):
    """
    Provides initial bootstrap data needed to boot the frontend application.
    """
    if request is not None:
        user = getattr(request, "user", None) or AnonymousUser()
        messages = get_messages(request)
        session = getattr(request, "session", None)
        is_superuser = is_active_superuser(request)
        language_code = getattr(request, "LANGUAGE_CODE", "en")

        # User identity is used by the sentry SDK
        user_identity = {"ip_address": request.META["REMOTE_ADDR"]}
        if user and user.is_authenticated():
            user_identity.update({"email": user.email, "id": user.id, "isStaff": user.is_staff})
            if user.name:
                user_identity["name"] = user.name
    else:
        user = None
        user_identity = {}
        messages = []
        session = None
        is_superuser = False
        language_code = "en"

    enabled_features = []
    if features.has("organizations:create", actor=user):
        enabled_features.append("organizations:create")
    if auth.has_user_registration():
        enabled_features.append("auth:register")

    version_info = _get_version_info()

    needs_upgrade = False

    if is_superuser:
        needs_upgrade = _needs_upgrade()

    public_dsn = _get_public_dsn()

    context = {
        "singleOrganization": settings.SENTRY_SINGLE_ORGANIZATION,
        "supportEmail": get_support_mail(),
        "urlPrefix": options.get("system.url-prefix"),
        "version": version_info,
        "features": enabled_features,
        "distPrefix": get_asset_url("sentry", "dist/"),
        "needsUpgrade": needs_upgrade,
        "dsn": public_dsn,
        "dsn_requests": _get_dsn_requests(),
        "statuspage": _get_statuspage(),
        "messages": [{"message": msg.message, "level": msg.tags} for msg in messages],
        "apmSampling": float(settings.SENTRY_APM_SAMPLING or 0),
        "isOnPremise": settings.SENTRY_ONPREMISE,
        "invitesEnabled": settings.SENTRY_ENABLE_INVITES,
        "gravatarBaseUrl": settings.SENTRY_GRAVATAR_BASE_URL,
        "termsUrl": settings.TERMS_URL,
        "privacyUrl": settings.PRIVACY_URL,
        # Note `lastOrganization` should not be expected to update throughout frontend app lifecycle
        # It should only be used on a fresh browser nav to a path where an
        # organization is not in context
        "lastOrganization": session["activeorg"] if session and "activeorg" in session else None,
        "languageCode": language_code,
        "userIdentity": user_identity,
        "csrfCookieName": settings.CSRF_COOKIE_NAME,
        "sentryConfig": {
            "dsn": public_dsn,
            "release": settings.SENTRY_SDK_CONFIG["release"],
            "environment": settings.SENTRY_SDK_CONFIG["environment"],
            # By default `ALLOWED_HOSTS` is [*], however the JS SDK does not support globbing
            "whitelistUrls": (
                settings.SENTRY_FRONTEND_WHITELIST_URLS
                if settings.SENTRY_FRONTEND_WHITELIST_URLS
                else list("" if settings.ALLOWED_HOSTS == ["*"] else settings.ALLOWED_HOSTS)
            ),
        },
    }
    if user and user.is_authenticated():
        context.update(
            {"isAuthenticated": True, "user": serialize(user, user, DetailedUserSerializer())}
        )

        if request.user.is_superuser:
            # Note: This intentionally does not use the "active" superuser flag as
            # the frontend should only ever use this flag as a hint that the user can be a superuser
            # the API will always need to check for active superuser.
            #
            # This is needed in the case where you access a different org and get denied, but the UI
            # can open the sudo dialog if you are an "inactive" superuser
            context["user"]["isSuperuser"] = request.user.is_superuser
    else:
        context.update({"isAuthenticated": False, "user": None})

    return context
