from __future__ import annotations

import itertools
import warnings
from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, DefaultDict, TypedDict, cast

from django.conf import settings
from django.contrib.auth.models import AnonymousUser

from sentry import experiments
from sentry.api.serializers import Serializer, register
from sentry.api.serializers.types import SerializedAvatarFields
from sentry.app import env
from sentry.auth.elevated_mode import has_elevated_mode
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
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
from sentry.users.models.userrole import UserRoleUser
from sentry.users.services.user import RpcUser
from sentry.utils.avatar import get_gravatar_url
from sentry.utils.serializers import manytoone_to_dict


class _UserEmails(TypedDict):
    id: str
    email: str
    is_verified: bool


class _Organization(TypedDict):
    slug: str
    name: str


class _Provider(TypedDict):
    id: str
    name: str


class _Identity(TypedDict):
    id: str
    name: str
    organization: _Organization
    provider: _Provider
    dateVerified: datetime
    dateSynced: datetime


class _UserOptions(TypedDict):
    theme: str  # TODO: enum/literal for theme options
    language: str
    stacktraceOrder: int  # TODO: enum/literal
    defaultIssueEvent: str
    timezone: str
    clock24Hours: bool
    prefersIssueDetailsStreamlinedUI: bool


class UserSerializerResponseOptional(TypedDict, total=False):
    # NOTE: There is a bug here where trying to move these fields to
    # UserSerializerResponse and using NotRequired. "identities" is marked as
    # required for places where UserSerializerResponse is used as a field (e.g
    # OrganizationMemberResponse).
    identities: list[_Identity]
    avatar: SerializedAvatarFields
    authenticators: list[Any]  # TODO: find out what type this is
    canReset2fa: bool


class UserSerializerResponse(UserSerializerResponseOptional):
    id: str
    name: str
    username: str
    email: str
    avatarUrl: str
    isActive: bool
    hasPasswordAuth: bool
    isManaged: bool
    dateJoined: datetime
    lastLogin: datetime | None
    has2fa: bool
    lastActive: datetime | None
    isSuperuser: bool
    isStaff: bool
    experiments: dict[str, Any]  # TODO
    emails: list[_UserEmails]


class UserSerializerResponseSelf(UserSerializerResponse):
    options: _UserOptions
    flags: Any  # TODO


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
        experiment_assignments = experiments.all(user=user)

        d: UserSerializerResponse = {
            "id": str(obj.id),
            "name": obj.get_display_name(),
            "username": obj.username,
            "email": obj.email,
            "avatarUrl": get_gravatar_url(obj.email, size=32),
            "isActive": obj.is_active,
            "hasPasswordAuth": obj.password not in ("!", ""),
            "isManaged": obj.is_managed,
            "dateJoined": obj.date_joined,
            "lastLogin": obj.last_login,
            "has2fa": attrs["has2fa"],
            "lastActive": obj.last_active,
            "isSuperuser": obj.is_superuser,
            "isStaff": obj.is_staff,
            "experiments": experiment_assignments,
            "emails": [
                {"id": str(e.id), "email": e.email, "is_verified": e.is_verified}
                for e in attrs["emails"]
            ],
        }

        if self._user_is_requester(obj, user):
            d = cast(UserSerializerResponseSelf, d)
            options = {
                o.key: o.value
                for o in UserOption.objects.filter(user_id=user.id, project_id__isnull=True)
            }
            stacktrace_order = int(options.get("stacktrace_order", -1) or -1)

            d["options"] = {
                "theme": options.get("theme") or "light",
                "language": options.get("language") or settings.SENTRY_DEFAULT_LANGUAGE,
                "stacktraceOrder": stacktrace_order,
                "defaultIssueEvent": options.get("default_issue_event") or "recommended",
                "timezone": options.get("timezone") or settings.SENTRY_DEFAULT_TIME_ZONE,
                "clock24Hours": options.get("clock_24_hours") or False,
                "prefersIssueDetailsStreamlinedUI": options.get(
                    "prefers_issue_details_streamlined_ui", False
                ),
            }

            d["flags"] = {"newsletter_consent_prompt": bool(obj.flags.newsletter_consent_prompt)}

        if attrs.get("avatar"):
            avatar: SerializedAvatarFields = {
                "avatarType": attrs["avatar"].get_avatar_type_display(),
                "avatarUuid": attrs["avatar"].ident if attrs["avatar"].get_file_id() else None,
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

        active_memberships: DefaultDict[int, int] = defaultdict(int)
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
        d = cast(UserSerializerResponse, super().serialize(obj, attrs, user))

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
    permissions: Sequence[str]


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
        # XXX(dcramer): There is definitely a way to write this query using
        #  Django's awkward ORM magic to cache it using `UserRole` but at least
        #  someone can understand this direction of access/optimization.
        roles = {
            ur.user_id: ur.role.permissions
            for ur in UserRoleUser.objects.filter(user_id__in=user_ids).select_related("role")
        }

        for item in item_list:
            attrs[item]["authenticators"] = authenticators[item.id]
            attrs[item]["permissions"] = {p.permission for p in permissions[item.id]} | set(
                itertools.chain(roles.get(item.id, []))
            )

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
