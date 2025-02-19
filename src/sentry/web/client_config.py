from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from functools import cached_property
from typing import Any

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.messages import get_messages
from django.contrib.sessions.backends.base import SessionBase
from django.core.cache import cache
from django.http import HttpRequest
from packaging.version import parse as parse_version
from rest_framework.request import Request

import sentry
from sentry import features, options
from sentry.api.utils import generate_region_url
from sentry.auth import superuser
from sentry.auth.services.auth import AuthenticationContext
from sentry.auth.superuser import is_active_superuser
from sentry.models.organizationmapping import OrganizationMapping
from sentry.organizations.absolute_url import generate_organization_url
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcUserOrganizationContext,
    organization_service,
)
from sentry.projects.services.project_key import ProjectKeyRole, project_key_service
from sentry.silo.base import SiloMode
from sentry.types.region import (
    Region,
    RegionCategory,
    find_all_multitenant_region_names,
    get_region_by_name,
)
from sentry.users.models.user import User
from sentry.users.services.user import UserSerializeType
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service
from sentry.utils import auth, json
from sentry.utils.assets import get_frontend_dist_prefix
from sentry.utils.demo_mode import is_demo_mode_enabled, is_demo_user
from sentry.utils.email import is_smtp_enabled
from sentry.utils.http import is_using_customer_domain
from sentry.utils.settings import (
    is_self_hosted,
    is_self_hosted_errors_only,
    should_show_beacon_consent_prompt,
)


def _get_support_mail() -> str | None:
    """Returns the most appropriate support email address"""

    return options.get("system.support-email") or options.get("system.admin-email") or None


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


def _get_statuspage() -> dict[str, str] | None:
    page_id: str | None = settings.STATUS_PAGE_ID
    if page_id is None:
        return None
    return {"id": page_id, "api_host": settings.STATUS_PAGE_API_HOST}


def _get_public_dsn() -> str | None:
    if settings.SENTRY_FRONTEND_DSN:
        return settings.SENTRY_FRONTEND_DSN

    if settings.IS_DEV and not settings.SENTRY_USE_RELAY:
        return ""

    project_id: int | None = settings.SENTRY_FRONTEND_PROJECT or settings.SENTRY_PROJECT
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


def _resolve_last_org(
    request: HttpRequest | None,
    session: SessionBase | None,
    user: AnonymousUser | User | None,
    org_context: RpcUserOrganizationContext | None = None,
) -> RpcOrganization | None:
    user_is_authenticated = (
        user is not None and not isinstance(user, AnonymousUser) and user.is_authenticated
    )

    if org_context is None:
        last_org_slug = session["activeorg"] if session and "activeorg" in session else None
        if not last_org_slug:
            return None

        if user_is_authenticated and user is not None:
            org_context = organization_service.get_organization_by_slug(
                slug=last_org_slug,
                only_visible=False,
                user_id=user.id,
                include_projects=False,
                include_teams=False,
            )

    has_org_access = bool(org_context and org_context.member)

    if not has_org_access and user_is_authenticated:
        has_org_access = request is not None and superuser.is_active_superuser(request)

    if org_context and has_org_access:
        return org_context.organization

    return None


class _ClientConfig:
    def __init__(
        self,
        request: Request | None = None,
        org_context: RpcUserOrganizationContext | None = None,
    ) -> None:
        self.request = request
        if request is not None:
            self.user: User | AnonymousUser | None = request.user
            self.session: SessionBase | None = request.session
        else:
            self.user = None
            self.session = None

        self.last_org = _resolve_last_org(request, self.session, self.user, org_context)

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
        if features.has("system:multi-region"):
            yield "system:multi-region"
        # TODO @athena: remove this feature flag after development is done
        # this is a temporary hack to be able to used flagpole in a case where there's no organization
        # availble on the frontend
        if self.last_org and features.has(
            "organizations:scoped-partner-oauth", self.last_org, actor=self.user
        ):
            yield "system:scoped-partner-oauth"

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
    def user_identity(self) -> Iterable[tuple[str, Any]]:
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
    def allow_list(self) -> list[str]:
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
    def links(self) -> Iterable[tuple[str, str | None]]:
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

        if self._is_superuser() and superuser.SUPERUSER_ORG_ID is not None:
            org_context = organization_service.get_organization_by_id(
                id=superuser.SUPERUSER_ORG_ID,
                user_id=None,
                include_projects=False,
                include_teams=False,
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
                auth=self.request.auth if self.request is not None else None,
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

    @cached_property
    def _member_region_names(self) -> frozenset[str]:
        # If the user is not authenticated they have no region membership
        if not self.user or not self.user.id:
            return frozenset()

        region_names = user_service.get_member_region_names(user_id=self.user.id)
        return frozenset(region_names)

    @staticmethod
    def _serialize_regions(
        region_names: Iterable[str], display_order: Callable[[Region], Any]
    ) -> list[Mapping[str, Any]]:
        regions = [get_region_by_name(name) for name in region_names]
        regions.sort(key=display_order)
        return [region.api_serialize() for region in regions]

    @property
    def regions(self) -> list[Mapping[str, Any]]:
        """
        The regions available to the current user.

        This will include *all* multi-tenant regions, and if the user
        has membership on any single-tenant regions those will also be included.
        """

        # Only expose visible regions.
        # When new regions are added they can take some work to get working correctly.
        # Before they are working we need ways to bring parts of the region online without
        # exposing the region to customers.
        region_names = find_all_multitenant_region_names()

        if not region_names:
            return [{"name": "default", "url": options.get("system.url-prefix")}]

        def region_display_order(region: Region) -> tuple[bool, bool, str]:
            return (
                not region.is_historic_monolith_region(),  # default region comes first
                region.category != RegionCategory.MULTI_TENANT,  # multi-tenants before single
                region.name,  # then sort alphabetically
            )

        # Show all visible multi-tenant regions to unauthenticated users as they could
        # create a new account. Else, ensure all regions the current user is in are
        # included as there could be single tenants or hidden regions.
        unique_regions = set(region_names) | self._member_region_names
        return self._serialize_regions(unique_regions, region_display_order)

    @property
    def member_regions(self) -> list[Mapping[str, Any]]:
        """
        The regions the user has membership in. Includes single-tenant regions.
        """
        return self._serialize_regions(self._member_region_names, lambda r: r.name)

    @property
    def should_preload_data(self) -> bool:
        """
        Indicates if the preload-data functionality is enabled when rendering
        the preload-data.html template. This is only used when layout.html is
        rendered.
        """
        # Don't send requests if there is no logged in user.
        if not self.user_details:
            return False

        # If the user is viewing the accept invitation user interface,
        # we should avoid preloading the data as they might not yet have access to it,
        # which could cause an error notification (403) to pop up in the user interface.
        invite_route_names = (
            "sentry-accept-invite",
            "sentry-organization-accept-invite",
        )
        if (
            self.request
            and self.request.resolver_match
            and self.request.resolver_match.url_name in invite_route_names
        ):
            return False

        return True

    def get_context(self) -> Mapping[str, Any]:
        return {
            "initialTrace": self.tracing_data,
            "customerDomain": self.customer_domain,
            "singleOrganization": settings.SENTRY_SINGLE_ORGANIZATION,
            "supportEmail": _get_support_mail(),
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
            "isSelfHostedErrorsOnly": is_self_hosted_errors_only(),
            # sentryMode intends to supersede isSelfHosted,
            # so we can differentiate between "SELF_HOSTED", "SINGLE_TENANT", and "SAAS".
            "sentryMode": settings.SENTRY_MODE.name,
            "shouldPreloadData": self.should_preload_data,
            "shouldShowBeaconConsentPrompt": not self.needs_upgrade
            and should_show_beacon_consent_prompt(),
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
            "memberRegions": self.member_regions,
            "regions": self.regions,
            "relocationConfig": {"selectableRegions": options.get("relocation.selectable-regions")},
            "demoMode": is_demo_mode_enabled() and is_demo_user(self.user),
            "enableAnalytics": settings.ENABLE_ANALYTICS,
            "validateSUForm": getattr(
                settings, "VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON", False
            ),
            "disableU2FForSUForm": getattr(settings, "DISABLE_SU_FORM_U2F_CHECK_FOR_LOCAL", False),
            "links": dict(self.links),
            "user": self.user_details,
            "isAuthenticated": self.user_details is not None,
        }


def get_client_config(
    request=None, org_context: RpcUserOrganizationContext | None = None
) -> Mapping[str, Any]:
    """
    Provides initial bootstrap data needed to boot the frontend application.
    """

    config = _ClientConfig(request, org_context)
    if request is not None and config.last_org is None:
        _delete_activeorg(config.session)
    return config.get_context()
