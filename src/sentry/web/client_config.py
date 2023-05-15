from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.messages import get_messages
from django.core.cache import cache
from packaging.version import parse as parse_version

import sentry
from sentry import features, options
from sentry.api.utils import generate_organization_url, generate_region_url
from sentry.auth import superuser
from sentry.auth.superuser import is_active_superuser
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.services.hybrid_cloud.project_key import ProjectKeyRole, project_key_service
from sentry.services.hybrid_cloud.user import UserSerializeType
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.utils import auth
from sentry.utils.assets import get_frontend_dist_prefix
from sentry.utils.email import is_smtp_enabled
from sentry.utils.http import is_using_customer_domain
from sentry.utils.settings import is_self_hosted
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


def _get_public_dsn():

    if settings.SENTRY_FRONTEND_DSN:
        return settings.SENTRY_FRONTEND_DSN

    if settings.IS_DEV and not settings.SENTRY_USE_RELAY:
        return ""

    project_id = settings.SENTRY_FRONTEND_PROJECT or settings.SENTRY_PROJECT
    if project_id is None:
        return None

    cache_key = f"dsn:{project_id}"

    result = cache.get(cache_key)
    if result is None:
        key = project_key_service.get_project_key(project_id=project_id, role=ProjectKeyRole.store)
        if key:
            result = key.dsn_public
        else:
            result = ""
        cache.set(cache_key, result, 60)
    return result


def _delete_activeorg(session):
    if session and "activeorg" in session:
        del session["activeorg"]


def _resolve_last_org(session, user):
    last_org_slug = session["activeorg"] if session and "activeorg" in session else None
    if not last_org_slug:
        return None
    if user is not None and not isinstance(user, AnonymousUser):
        org_context = organization_service.get_organization_by_slug(
            slug=last_org_slug, only_visible=False, user_id=user.id
        )
        if org_context and org_context.member:
            return org_context.organization
    return None


def get_client_config(request=None):
    """
    Provides initial bootstrap data needed to boot the frontend application.
    """
    if request is not None:
        customer_domain = None
        if is_using_customer_domain(request):
            customer_domain = {
                "subdomain": request.subdomain,
                "organizationUrl": generate_organization_url(request.subdomain),
                "sentryUrl": options.get("system.url-prefix"),
            }
        user = getattr(request, "user", None) or AnonymousUser()
        messages = get_messages(request)
        session = getattr(request, "session", None)
        active_superuser = is_active_superuser(request)
        language_code = getattr(request, "LANGUAGE_CODE", "en")

        # User identity is used by the sentry SDK
        user_identity = {"ip_address": request.META["REMOTE_ADDR"]}
        if user and user.is_authenticated:
            user_identity.update({"email": user.email, "id": user.id, "isStaff": user.is_staff})
            if user.name:
                user_identity["name"] = user.name
    else:
        customer_domain = None
        user = None
        user_identity = {}
        messages = []
        session = None
        active_superuser = False
        language_code = "en"

    enabled_features = []
    if features.has("organizations:create", actor=user):
        enabled_features.append("organizations:create")
    if auth.has_user_registration():
        enabled_features.append("auth:register")

    version_info = _get_version_info()

    needs_upgrade = False

    if active_superuser:
        needs_upgrade = _needs_upgrade()

    public_dsn = _get_public_dsn()

    last_org_slug = None
    last_org = _resolve_last_org(session, user)
    if last_org:
        last_org_slug = last_org.slug
    if last_org is None:
        _delete_activeorg(session)

    inject_customer_domain_feature = bool(customer_domain)
    if last_org is not None and features.has("organizations:customer-domains", last_org):
        inject_customer_domain_feature = True
    if inject_customer_domain_feature:
        enabled_features.append("organizations:customer-domains")

    context = {
        "customerDomain": customer_domain,
        "singleOrganization": settings.SENTRY_SINGLE_ORGANIZATION,
        "supportEmail": get_support_mail(),
        "urlPrefix": options.get("system.url-prefix"),
        "version": version_info,
        "features": enabled_features,
        "distPrefix": get_frontend_dist_prefix(),
        "needsUpgrade": needs_upgrade,
        "dsn": public_dsn,
        "statuspage": _get_statuspage(),
        "messages": [{"message": msg.message, "level": msg.tags} for msg in messages],
        "apmSampling": float(settings.SENTRY_FRONTEND_APM_SAMPLING or 0),
        # Maintain isOnPremise key for backcompat (plugins?).
        "isOnPremise": is_self_hosted(),
        "isSelfHosted": is_self_hosted(),
        "invitesEnabled": settings.SENTRY_ENABLE_INVITES,
        "gravatarBaseUrl": settings.SENTRY_GRAVATAR_BASE_URL,
        "termsUrl": settings.TERMS_URL,
        "privacyUrl": settings.PRIVACY_URL,
        # Note `lastOrganization` should not be expected to update throughout frontend app lifecycle
        # It should only be used on a fresh browser nav to a path where an
        # organization is not in context
        "lastOrganization": last_org_slug,
        "languageCode": language_code,
        "userIdentity": user_identity,
        "csrfCookieName": settings.CSRF_COOKIE_NAME,
        "superUserCookieName": superuser.COOKIE_NAME,
        "superUserCookieDomain": superuser.COOKIE_DOMAIN,
        "sentryConfig": {
            "dsn": public_dsn,
            # XXX: In the world of frontend / backend deploys being separated,
            # this is likely incorrect, since the backend version may not
            # match the frontend build version.
            #
            # This is likely to be removed sometime in the future.
            "release": f"frontend@{settings.SENTRY_SDK_CONFIG['release']}",
            "environment": settings.SENTRY_SDK_CONFIG["environment"],
            # By default `ALLOWED_HOSTS` is [*], however the JS SDK does not support globbing
            "whitelistUrls": (
                settings.SENTRY_FRONTEND_WHITELIST_URLS
                if settings.SENTRY_FRONTEND_WHITELIST_URLS
                else list("" if settings.ALLOWED_HOSTS == ["*"] else settings.ALLOWED_HOSTS)
            ),
        },
        "demoMode": settings.DEMO_MODE,
        "enableAnalytics": settings.ENABLE_ANALYTICS,
        "validateSUForm": getattr(settings, "VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON", False),
        "disableU2FForSUForm": getattr(settings, "DISABLE_SU_FORM_U2F_CHECK_FOR_LOCAL", False),
        "links": {
            "organizationUrl": generate_organization_url(last_org_slug) if last_org_slug else None,
            "regionUrl": generate_region_url() if last_org_slug else None,
            "sentryUrl": options.get("system.url-prefix"),
        },
    }
    if user and user.is_authenticated:
        (serialized_user,) = user_service.serialize_many(
            filter={"user_ids": [user.id]},
            serializer=UserSerializeType.SELF_DETAILED,
            auth_context=AuthenticationContext(
                auth=getattr(request, "auth", None),
                user=request.user,
            ),
        )
        context.update(
            {
                "isAuthenticated": True,
                "user": serialized_user,
            }
        )

        if request.user.is_superuser:
            # Note: This intentionally does not use the "active" superuser flag as
            # the frontend should only ever use this flag as a hint that the user can be a superuser
            # the API will always need to check for active superuser.
            #
            # This is needed in the case where you access a different org and get denied, but the UI
            # can open the sudo dialog if you are an "inactive" superuser
            context["user"]["isSuperuser"] = request.user.is_superuser
            if superuser.ORG_ID is not None:
                org_context = organization_service.get_organization_by_id(
                    id=superuser.ORG_ID, user_id=None
                )
                if org_context and org_context.organization:
                    context["links"]["superuserUrl"] = generate_organization_url(
                        org_context.organization.slug
                    )
    else:
        context.update({"isAuthenticated": False, "user": None})

    return context
