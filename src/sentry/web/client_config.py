from __future__ import annotations

from functools import cached_property
from typing import Any, Iterable, List, Mapping, MutableMapping, Tuple

import sentry_sdk
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
from sentry.models.organizationmapping import OrganizationMapping
from sentry.services.hybrid_cloud.auth import AuthenticatedToken, AuthenticationContext
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.services.hybrid_cloud.project_key import ProjectKeyRole, project_key_service
from sentry.services.hybrid_cloud.user import UserSerializeType
from sentry.services.hybrid_cloud.user.serial import serialize_generic_user
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.silo.base import SiloMode
from sentry.types.region import find_all_multitenant_region_names, get_region_by_name
from sentry.utils import auth, json
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


def _get_public_dsn() -> str | None:
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
        key = project_key_service.get_project_key_by_region(
            region_name=settings.SENTRY_MONOLITH_REGION,
            project_id=project_id,
            role=ProjectKeyRole.store,
        )
        if key:
            result = key.dsn_public
        else:
            result = ""
        cache.set(cache_key, result, 60)
    return result


def _delete_activeorg(session):
    if session and "activeorg" in session:
        del session["activeorg"]


def _resolve_last_org(session, user, org_context=None):
    if org_context is None:
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


class _ClientConfig:
    def __init__(self, request=None, org_context=None) -> None:
        self.request = request
        if request is not None:
            self.user = getattr(request, "user", None) or AnonymousUser()
            self.session = getattr(request, "session", None)
        else:
            self.user = None
            self.session = None

        self.last_org = _resolve_last_org(self.session, self.user, org_context)

    @property
    def last_org_slug(self) -> str | None:
        if self.last_org is None:
            return None
        return self.last_org.slug

    @cached_property
    def customer_domain(self) -> Mapping[str, str] | None:
        if self.request is None or not is_using_customer_domain(self.request):
            return None
        return {
            "subdomain": self.request.subdomain,
            "organizationUrl": generate_organization_url(self.request.subdomain),
            "sentryUrl": options.get("system.url-prefix"),
        }

    @cached_property
    def tracing_data(self) -> Mapping[str, str]:
        return {
            "sentry_trace": sentry_sdk.get_traceparent() or "",
            "baggage": sentry_sdk.get_baggage() or "",
        }

    @property
    def enabled_features(self) -> Iterable[str]:
        if features.has("organizations:create", actor=self.user):
            yield "organizations:create"
        if auth.has_user_registration():
            yield "auth:register"
        if features.has("relocation:enabled", actor=self.user):
            yield "relocation:enabled"
        if self.customer_domain or (
            self.last_org and features.has("organizations:customer-domains", self.last_org)
        ):
            yield "organizations:customer-domains"
        # TODO (Gabe): Remove selector option check once GetSentry side lands
        if options.get("hybrid_cloud.multi-region-selector") or features.has(
            "organizations:multi-region-selector", actor=self.user
        ):
            yield "organizations:multi-region-selector"

    @property
    def needs_upgrade(self) -> bool:
        return self.request is not None and is_active_superuser(self.request) and _needs_upgrade()

    @cached_property
    def public_dsn(self) -> str | None:
        return _get_public_dsn()

    @property
    def messages(self):
        if self.request is None:
            return []
        return get_messages(self.request)

    @property
    def language_code(self) -> str:
        default_language_code = "en"
        if self.request is None:
            return default_language_code
        return getattr(self.request, "LANGUAGE_CODE", default_language_code)

    @property
    def user_identity(self) -> Iterable[Tuple[str, Any]]:
        if self.request is None:
            return
        yield "ip_address", self.request.META["REMOTE_ADDR"]
        if self.user and self.user.is_authenticated:
            yield "email", self.user.email
            yield "id", self.user.id
            yield "isStaff", self.user.is_staff
            if self.user.name:
                yield "name", self.user.name

    @cached_property
    def allow_list(self) -> List[str]:
        if settings.SENTRY_FRONTEND_WHITELIST_URLS:
            return settings.SENTRY_FRONTEND_WHITELIST_URLS
        if settings.ALLOWED_HOSTS == ["*"]:
            return []
        return list(settings.ALLOWED_HOSTS)

    def _is_superuser(self) -> bool:
        # Note: This intentionally does not use the "active" superuser flag as
        # the frontend should only ever use this flag as a hint that the user can be a superuser
        # the API will always need to check for active superuser.
        #
        # This is needed in the case where you access a different org and get denied, but the UI
        # can open the sudo dialog if you are an "inactive" superuser
        return self.request is not None and self.user is not None and self.user.is_superuser

    @property
    def links(self) -> Iterable[Tuple[str, str | None]]:
        organization_url = (
            generate_organization_url(self.last_org_slug) if self.last_org_slug else None
        )
        region_url = None
        if self.last_org:
            if SiloMode.get_current_mode() == SiloMode.CONTROL:
                organization_mapping = OrganizationMapping.objects.get(
                    organization_id=self.last_org.id
                )
                region_url = generate_region_url(organization_mapping.region_name)
            else:
                region_url = generate_region_url()

        yield "organizationUrl", organization_url
        yield "regionUrl", region_url
        yield "sentryUrl", options.get("system.url-prefix")

        if self._is_superuser() and superuser.ORG_ID is not None:
            org_context = organization_service.get_organization_by_id(
                id=superuser.ORG_ID, user_id=None
            )
            if org_context and org_context.organization:
                yield "superuserUrl", generate_organization_url(org_context.organization.slug)

    @cached_property
    def user_details(self) -> Mapping[str, Any] | None:
        if self.user is None or not self.user.is_authenticated:
            return None

        query_result = user_service.serialize_many(
            filter={"user_ids": [self.user.id]},
            serializer=UserSerializeType.SELF_DETAILED,
            auth_context=AuthenticationContext(
                auth=AuthenticatedToken.from_token(getattr(self.request, "auth", None)),
                user=serialize_generic_user(self.user),
            ),
        )
        if not query_result:
            # this could be an empty result as the user could be deleted
            return None

        (user_details,) = query_result
        user_details = json.loads(json.dumps(user_details))
        if self._is_superuser():
            user_details["isSuperuser"] = self.user.is_superuser
        return user_details

    @property
    def regions(self) -> List[Mapping[str, Any]]:
        """
        The regions available to the current user.

        This will include *all* multi-tenant regions, and if the customer
        has membership on any single-tenant regions those will also be included.
        """
        user = self.user
        region_names = find_all_multitenant_region_names()
        if not region_names:
            return [{"name": "default", "url": options.get("system.url-prefix")}]

        # No logged in user.
        if not user or not user.id:
            return [get_region_by_name(region).api_serialize() for region in region_names]

        # Ensure all regions the current user is in are included as there
        # could be single tenants as well.
        memberships = user_service.get_organizations(user_id=user.id)
        unique_regions = set(region_names) | {membership.region_name for membership in memberships}

        return [get_region_by_name(name).api_serialize() for name in unique_regions]

    def get_context(self) -> Mapping[str, Any]:
        return {
            "initialTrace": self.tracing_data,
            "customerDomain": self.customer_domain,
            "singleOrganization": settings.SENTRY_SINGLE_ORGANIZATION,
            "supportEmail": get_support_mail(),
            "urlPrefix": options.get("system.url-prefix"),
            "version": _get_version_info(),
            "features": list(self.enabled_features),
            "distPrefix": get_frontend_dist_prefix(),
            "needsUpgrade": self.needs_upgrade,
            "dsn": self.public_dsn,
            "statuspage": _get_statuspage(),
            "messages": [{"message": msg.message, "level": msg.tags} for msg in self.messages],
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
            "lastOrganization": self.last_org_slug,
            "languageCode": self.language_code,
            "userIdentity": dict(self.user_identity),
            "csrfCookieName": settings.CSRF_COOKIE_NAME,
            "superUserCookieName": superuser.COOKIE_NAME,
            "superUserCookieDomain": superuser.COOKIE_DOMAIN,
            "sentryConfig": {
                "dsn": self.public_dsn,
                # XXX: In the world of frontend / backend deploys being separated,
                # this is likely incorrect, since the backend version may not
                # match the frontend build version.
                #
                # This is likely to be removed sometime in the future.
                "release": f"frontend@{settings.SENTRY_SDK_CONFIG['release']}",
                "environment": settings.SENTRY_SDK_CONFIG["environment"],
                # By default `ALLOWED_HOSTS` is [*], however the JS SDK does not support globbing
                "whitelistUrls": self.allow_list,
                "allowUrls": self.allow_list,
                "tracePropagationTargets": settings.SENTRY_FRONTEND_TRACE_PROPAGATION_TARGETS or [],
            },
            "regions": self.regions,
            "demoMode": settings.DEMO_MODE,
            "enableAnalytics": settings.ENABLE_ANALYTICS,
            "validateSUForm": getattr(
                settings, "VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON", False
            ),
            "disableU2FForSUForm": getattr(settings, "DISABLE_SU_FORM_U2F_CHECK_FOR_LOCAL", False),
            "links": dict(self.links),
            "user": self.user_details,
            "isAuthenticated": self.user_details is not None,
        }


def get_client_config(request=None, org_context=None) -> MutableMapping[str, Any]:
    """
    Provides initial bootstrap data needed to boot the frontend application.
    """

    config = _ClientConfig(request, org_context)
    if request is not None and config.last_org is None:
        _delete_activeorg(config.session)
    return config.get_context()
