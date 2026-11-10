from __future__ import annotations

import warnings
from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from enum import Enum
from typing import Annotated, Any, Literal, NotRequired, TypedDict, cast

from django.conf import settings
from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.formats import HexId, NumericId, hex_id, numeric_id
from sentry.app import env
from sentry.auth.elevated_mode import has_elevated_mode
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.interfaces.stacktrace import StacktraceOrder
from sentry.models.authidentity import AuthIdentity
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.organizations.services.organization import RpcOrganizationSummary
from sentry.users.models.authenticator import Authenticator
from sentry.users.models.user import User
from sentry.users.models.user_avatar import UserAvatar
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail
from sentry.users.models.userpermission import UserPermission
from sentry.users.services.user import RpcUser
from sentry.utils.avatar import get_gravatar_url
from sentry.utils.serializers import manytoone_to_dict

# The names of the avatar type choices of users, organizations and teams, as
# get_avatar_type_display() returns them.
AvatarTypeName = Literal["letter_avatar", "upload", "gravatar"]


class SerializedAvatarFields(TypedDict, total=False):
    avatarType: Annotated[AvatarTypeName, ApiDescription("Avatar type")]
    avatarUuid: Annotated[HexId | None, ApiDescription("ID of the uploaded avatar image, or null")]
    avatarUrl: Annotated[
        str | None, ApiDescription("URL of the avatar image, or null if none is set")
    ]


class _UserEmails(TypedDict):
    id: Annotated[str, ApiDescription("Email ID")]
    email: Annotated[str, ApiDescription("Email address")]
    is_verified: Annotated[bool, ApiDescription("Whether the email address is verified")]


class _Organization(TypedDict):
    slug: Annotated[str, ApiDescription("Organization slug")]
    name: Annotated[str, ApiDescription("Organization name")]


class _Provider(TypedDict):
    id: Annotated[str, ApiDescription("Auth provider key, such as google or saml2")]
    name: Annotated[str, ApiDescription("Display name of the auth provider")]


class _Identity(TypedDict):
    id: Annotated[str, ApiDescription("SSO identity ID")]
    name: Annotated[str, ApiDescription("User's identifier at the auth provider")]
    organization: Annotated[
        _Organization, ApiDescription("Organization the auth provider belongs to")
    ]
    provider: Annotated[_Provider, ApiDescription("Auth provider of the identity")]
    dateVerified: Annotated[
        datetime,
        ApiDescription(
            "When the identity was last verified by signing in through the auth provider"
        ),
    ]
    dateSynced: Annotated[
        datetime, ApiDescription("When the identity was last synced from the auth provider")
    ]


class _SerializedStacktraceOrder(int, Enum):
    DEFAULT = int(StacktraceOrder.DEFAULT)  # Equivalent to `MOST_RECENT_FIRST`
    MOST_RECENT_LAST = int(StacktraceOrder.MOST_RECENT_LAST)
    MOST_RECENT_FIRST = int(StacktraceOrder.MOST_RECENT_FIRST)


class _UserOptions(TypedDict):
    theme: Annotated[  # TODO: enum/literal for theme options
        str, ApiDescription('UI theme: "light", "dark" or "system". Defaults to "system"')
    ]
    language: Annotated[str, ApiDescription("UI language code, such as `en`")]
    stacktraceOrder: Annotated[
        _SerializedStacktraceOrder,
        ApiDescription(
            "Stack trace frame order: -1 for the default (most recent first), 1 for most recent last, 2 for most recent first"
        ),
    ]
    defaultIssueEvent: Annotated[
        str,
        ApiDescription(
            'Event shown by default on issue details: "recommended", "latest" or "oldest"'
        ),
    ]
    timezone: Annotated[str, ApiDescription("Time zone for displayed dates, such as `UTC`")]
    clock24Hours: Annotated[bool, ApiDescription("Whether times are shown in 24-hour format")]
    prefersIssueDetailsStreamlinedUI: Annotated[
        bool | None,
        ApiDescription(
            "Whether the user prefers the streamlined issue details UI, or null if they haven't chosen"
        ),
    ]


class _UserFlags(TypedDict):
    newsletter_consent_prompt: Annotated[
        bool, ApiDescription("Whether to ask the user for newsletter consent")
    ]


class _AuthenticatorSerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("Authenticator ID")]
    type: Annotated[str, ApiDescription("Authenticator type, such as totp, sms, u2f or recovery")]
    name: Annotated[str, ApiDescription("Display name of the authenticator type")]
    dateCreated: Annotated[datetime, ApiDescription("When the authenticator was added")]
    dateUsed: Annotated[
        datetime | None, ApiDescription("When the authenticator was last used, or null")
    ]


class UserSerializerResponseOptional(TypedDict, total=False):
    # NOTE: There is a bug here where trying to move these fields to
    # UserSerializerResponse and using NotRequired. "identities" is marked as
    # required for places where UserSerializerResponse is used as a field (e.g
    # OrganizationMemberResponse).
    identities: Annotated[
        list[_Identity],
        ApiDescription(
            "SSO identities of the user. Only included for the requesting user, unless the request has active superuser or staff access"
        ),
    ]
    avatar: Annotated[SerializedAvatarFields, ApiDescription("User avatar")]
    authenticators: Annotated[
        list[_AuthenticatorSerializerResponse],
        ApiDescription(
            "Two-factor authenticators of the user, without backup methods such as recovery codes"
        ),
    ]
    canReset2fa: Annotated[
        bool,
        ApiDescription(
            "Whether the organization can reset the user's two-factor authentication. True only if the user is a member of exactly one active organization"
        ),
    ]


class UserSerializerResponse(UserSerializerResponseOptional):
    id: Annotated[NumericId, ApiDescription("User ID")]
    name: Annotated[
        str,
        ApiDescription(
            "Display name: the user's name, or their email or username if no name is set"
        ),
    ]
    username: Annotated[str, ApiDescription("Username")]
    email: Annotated[str, ApiDescription("Primary email address")]
    avatarUrl: Annotated[str, ApiDescription("Gravatar URL for the primary email address")]
    isActive: Annotated[bool, ApiDescription("Whether the account is active")]
    isSuspended: Annotated[
        bool, ApiDescription("Whether the account is suspended. Suspended users can't sign in")
    ]
    hasPasswordAuth: Annotated[bool, ApiDescription("Whether the user has a password set")]
    isManaged: Annotated[
        bool,
        ApiDescription(
            "Whether the account is managed, which stops the user from changing their username, password and similar details"
        ),
    ]
    dateJoined: Annotated[datetime, ApiDescription("When the account was created")]
    lastLogin: Annotated[datetime | None, ApiDescription("When the user last signed in, or null")]
    has2fa: Annotated[
        bool, ApiDescription("Whether the user has two-factor authentication enabled")
    ]
    lastActive: Annotated[datetime | None, ApiDescription("When the user was last active, or null")]
    isSuperuser: Annotated[bool, ApiDescription("Whether the user is a superuser")]
    isStaff: Annotated[bool, ApiDescription("Whether the user has staff status")]
    experiments: Annotated[dict[str, str], ApiDescription("Deprecated. Always an empty object")]
    emails: Annotated[
        list[_UserEmails],
        ApiDescription(
            "Email addresses of the user. Only included for the requesting user or superusers; empty otherwise"
        ),
    ]


class UserSerializerResponseSelf(UserSerializerResponse):
    options: Annotated[_UserOptions, ApiDescription("Preferences of the user")]
    flags: Annotated[_UserFlags, ApiDescription("Account flags of the user")]


@register(User)
class UserSerializer(Serializer):
    def _user_is_requester(self, obj: User, requester: User | AnonymousUser | RpcUser) -> bool:
        if isinstance(requester, User):
            return bool(requester == obj)
        if isinstance(requester, RpcUser):
            return bool(requester.id == obj.id)
        return False

    def _get_identities(
        self, item_list: Sequence[User], user: User | RpcUser | AnonymousUser
    ) -> dict[int, list[AuthIdentity]]:
        if not (env.request and has_elevated_mode(env.request)):
            item_list = [x for x in item_list if x.id == user.id]

        queryset = AuthIdentity.objects.filter(
            user_id__in=[i.id for i in item_list]
        ).select_related(
            "auth_provider",
        )

        results: dict[int, list[AuthIdentity]] = {i.id: [] for i in item_list}
        for item in queryset:
            results[item.user_id].append(item)
        return results

    def get_attrs(
        self, item_list: Sequence[User], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> MutableMapping[User, Any]:
        user_ids = [i.id for i in item_list]
        avatars = {a.user_id: a for a in UserAvatar.objects.filter(user_id__in=user_ids)}
        identities = self._get_identities(item_list, user)
        emails = manytoone_to_dict(UserEmail.objects.filter(user_id__in=user_ids), "user_id")
        authenticators = Authenticator.objects.bulk_users_have_2fa(user_ids)

        data = {}
        for item in item_list:
            data[item] = {
                "avatar": avatars.get(item.id),
                "identities": identities.get(item.id),
                "has2fa": authenticators[item.id],
                "emails": emails[item.id],
            }
        return data

    def serialize(
        self,
        obj: User,
        attrs: Mapping[str, Any],
        user: User | AnonymousUser | RpcUser,
        **kwargs: Any,
    ) -> UserSerializerResponse | UserSerializerResponseSelf:
        d: UserSerializerResponse = {
            "id": numeric_id(obj.id),
            "name": obj.get_display_name(),
            "username": obj.username,
            "email": obj.email,
            "avatarUrl": get_gravatar_url(obj.email, size=32),
            "isActive": obj.is_active,
            "isSuspended": obj.is_suspended,
            "hasPasswordAuth": obj.password not in ("!", ""),
            "isManaged": obj.is_managed,
            "dateJoined": obj.date_joined,
            "lastLogin": obj.last_login,
            "has2fa": attrs["has2fa"],
            "lastActive": obj.last_active,
            "isSuperuser": obj.is_superuser,
            "isStaff": obj.is_staff,
            "emails": [],
            # TODO(epurkhiser): This can be removed once we confirm the
            # frontend does not use it
            "experiments": {},
        }

        if self._user_is_requester(obj, user) or user.is_superuser:
            d["emails"] = [
                {"id": str(e.id), "email": e.email, "is_verified": e.is_verified}
                for e in attrs["emails"]
            ]

        if self._user_is_requester(obj, user):
            d = cast(UserSerializerResponseSelf, d)
            options = {
                o.key: o.value
                for o in UserOption.objects.filter(user_id=obj.id, project_id__isnull=True)
                if o.value is not None
            }

            stacktrace_order = _SerializedStacktraceOrder(
                int(
                    options.get("stacktrace_order", StacktraceOrder.DEFAULT)
                    # TODO: This second `or` won't be necessary once we remove empty strings from the DB
                    or StacktraceOrder.DEFAULT
                )
            )

            d["options"] = {
                "theme": options.get("theme") or "system",
                "language": options.get("language") or settings.SENTRY_DEFAULT_LANGUAGE,
                "stacktraceOrder": stacktrace_order,
                "defaultIssueEvent": options.get("default_issue_event") or "recommended",
                "timezone": options.get("timezone") or settings.SENTRY_DEFAULT_TIME_ZONE,
                "clock24Hours": options.get("clock_24_hours") or False,
                "prefersIssueDetailsStreamlinedUI": options.get(
                    "prefers_issue_details_streamlined_ui"
                ),
            }

            d["flags"] = {"newsletter_consent_prompt": bool(obj.flags.newsletter_consent_prompt)}

        if attrs.get("avatar"):
            avatar: SerializedAvatarFields = {
                "avatarType": attrs["avatar"].get_avatar_type_display(),
                "avatarUuid": (
                    hex_id(attrs["avatar"].ident) if attrs["avatar"].get_file_id() else None
                ),
                "avatarUrl": attrs["avatar"].absolute_url(),
            }
        else:
            avatar = {"avatarType": "letter_avatar", "avatarUuid": None, "avatarUrl": None}
        d["avatar"] = avatar

        # TODO(dcramer): move this to DetailedUserSerializer
        if attrs["identities"] is not None:
            organization_ids = {i.auth_provider.organization_id for i in attrs["identities"]}
            auth_identity_organizations = organization_mapping_service.get_many(
                organization_ids=list(organization_ids)
            )
            orgs_by_id: Mapping[int, RpcOrganizationSummary] = {
                o.id: o for o in auth_identity_organizations
            }

            d["identities"] = [
                {
                    "id": str(i.id),
                    "name": i.ident,
                    "organization": {
                        "slug": orgs_by_id[i.auth_provider.organization_id].slug,
                        "name": orgs_by_id[i.auth_provider.organization_id].name,
                    },
                    "provider": {
                        "id": i.auth_provider.provider,
                        "name": i.auth_provider.get_provider().name,
                    },
                    "dateSynced": i.last_synced,
                    "dateVerified": i.last_verified,
                }
                for i in attrs["identities"]
            ]

        return d


class DetailedUserSerializer(UserSerializer):
    """
    Used in situations like when a member admin (on behalf of an organization) looks up memberships.
    """

    def get_attrs(
        self, item_list: Sequence[User], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> MutableMapping[User, Any]:
        attrs = super().get_attrs(item_list, user)

        # ignore things that aren't user controlled (like recovery codes)
        authenticators = manytoone_to_dict(
            Authenticator.objects.filter(user__in=item_list),
            "user_id",
            lambda x: not x.interface.is_backup_interface,
        )

        memberships = OrganizationMemberMapping.objects.filter(
            user_id__in={u.id for u in item_list}
        ).values_list("user_id", "organization_id", named=True)
        active_organizations = OrganizationMapping.objects.filter(
            organization_id__in={m.organization_id for m in memberships},
            status=OrganizationStatus.ACTIVE,
        ).values_list("organization_id", flat=True)

        active_memberships: defaultdict[int, int] = defaultdict(int)
        for membership in memberships:
            if membership.organization_id in active_organizations:
                active_memberships[membership.user_id] += 1

        for item in item_list:
            attrs[item]["authenticators"] = authenticators[item.id]
            # org can reset 2FA if the user is only in one org
            attrs[item]["canReset2fa"] = active_memberships[item.id] == 1

        return attrs

    def serialize(
        self,
        obj: User,
        attrs: Mapping[str, Any],
        user: User | AnonymousUser | RpcUser,
        **kwargs: Any,
    ) -> UserSerializerResponse:
        d = super().serialize(obj, attrs, user)

        # TODO(schew2381): Remove mention of superuser below once the staff feature flag is removed

        # XXX(dcramer): we don't check for active superuser/staff here as we simply
        # want to tell the UI that we're an authenticated superuser/staff, and
        # for requests that require an *active* session, they should prompt
        # on-demand. This ensures things like links to the Sentry admin can
        # still easily be rendered.
        d["authenticators"] = [
            {
                "id": str(a.id),
                "type": a.interface.interface_id,
                "name": str(a.interface.name),
                "dateCreated": a.created_at,
                "dateUsed": a.last_used_at,
            }
            for a in attrs["authenticators"]
        ]
        d["canReset2fa"] = attrs["canReset2fa"]
        return d


class DetailedSelfUserSerializerResponse(UserSerializerResponse):
    permissions: Annotated[
        Sequence[str],
        ApiDescription(
            "Sentry staff permissions granted to the user, such as users.admin. Empty for most users"
        ),
    ]
    options: NotRequired[
        Annotated[
            _UserOptions,
            ApiDescription("The user's preferences. Only included for the requesting user"),
        ]
    ]
    flags: NotRequired[
        Annotated[
            _UserFlags,
            ApiDescription("Account flags. Only included for the requesting user"),
        ]
    ]


class UserSerializerWithOrgMembershipsResponse(UserSerializerResponse):
    organizations: Sequence[str]


class DetailedSelfUserSerializer(UserSerializer):
    """
    Return additional information for operating on behalf of a user, like their permissions.

    Should only be returned when acting on behalf of the user, or acting on behalf of a Sentry `users.admin`.
    """

    def get_attrs(
        self, item_list: Sequence[User], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> MutableMapping[User, Any]:
        attrs = super().get_attrs(item_list, user)
        user_ids = [i.id for i in item_list]

        # ignore things that aren't user controlled (like recovery codes)
        authenticators = manytoone_to_dict(
            Authenticator.objects.filter(user_id__in=user_ids),
            "user_id",
            lambda x: not x.interface.is_backup_interface,
        )

        permissions = manytoone_to_dict(
            UserPermission.objects.filter(user_id__in=user_ids), "user_id"
        )

        for item in item_list:
            attrs[item]["authenticators"] = authenticators[item.id]
            attrs[item]["permissions"] = {p.permission for p in permissions[item.id]}

        return attrs

    def serialize(
        self,
        obj: User,
        attrs: Mapping[str, Any],
        user: User | AnonymousUser | RpcUser,
        **kwargs: Any,
    ) -> DetailedSelfUserSerializerResponse:
        d = cast(DetailedSelfUserSerializerResponse, super().serialize(obj, attrs, user))

        # safety check to never return this information if the acting user is not 1) this user, 2) an admin
        # TODO(schew2381): Remove user.is_superuser once the staff feature flag is removed
        if user.id == obj.id or user.is_superuser or user.is_staff:
            # XXX(dcramer): we don't check for active superuser/staff here as we simply
            # want to tell the UI that we're an authenticated superuser/staff, and
            # for requests that require an *active* session, they should prompt
            # on-demand. This ensures things like links to the Sentry admin can
            # still easily be rendered.
            d["permissions"] = sorted(attrs["permissions"])
            d["authenticators"] = [
                {
                    "id": str(a.id),
                    "type": a.interface.interface_id,
                    "name": str(a.interface.name),
                    "dateCreated": a.created_at,
                    "dateUsed": a.last_used_at,
                }
                for a in attrs["authenticators"]
            ]
        else:
            warnings.warn(
                "Incorrectly calling `DetailedSelfUserSerializer`. See docstring for details."
            )
        return d


class UserSerializerWithOrgMemberships(UserSerializer):
    def get_attrs(
        self,
        item_list: Sequence[User],
        user: User | AnonymousUser | RpcUser,
        **kwargs: Any,
    ) -> MutableMapping[User, Any]:
        attrs = super().get_attrs(item_list, user, **kwargs)

        memberships = OrganizationMemberMapping.objects.filter(
            user_id__in={u.id for u in item_list}
        ).values_list("user_id", "organization_id", named=True)
        active_org_id_to_slug = dict(
            OrganizationMapping.objects.filter(
                organization_id__in={m.organization_id for m in memberships},
                status=OrganizationStatus.ACTIVE,
            ).values_list("organization_id", "slug")
        )
        active_organization_ids = active_org_id_to_slug.keys()

        user_org_memberships: defaultdict[int, set[str]] = defaultdict(set)
        for membership in memberships:
            if membership.organization_id in active_organization_ids:
                user_org_memberships[membership.user_id].add(
                    active_org_id_to_slug[membership.organization_id]
                )
        for item in item_list:
            attrs[item]["organizations"] = user_org_memberships[item.id]

        return attrs

    def serialize(
        self,
        obj: User,
        attrs: Mapping[str, Any],
        user: User | AnonymousUser | RpcUser,
        **kwargs: Any,
    ) -> UserSerializerWithOrgMembershipsResponse:
        response = cast(
            UserSerializerWithOrgMembershipsResponse, super().serialize(obj, attrs, user)
        )

        response["organizations"] = sorted(attrs["organizations"])
        return response
