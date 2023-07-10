from __future__ import annotations

from typing import Any, Callable, List, MutableMapping, Optional

from django.db.models import Q, QuerySet

from sentry.api.serializers import (
    DetailedSelfUserSerializer,
    DetailedUserSerializer,
    UserSerializer,
)
from sentry.api.serializers.base import Serializer
from sentry.db.models import BaseQuerySet
from sentry.db.models.query import in_iexact
from sentry.models import (
    OrganizationMapping,
    OrganizationMemberMapping,
    OrganizationStatus,
    UserEmail,
)
from sentry.models.user import User
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import (
    FilterQueryDatabaseImpl,
    OpaqueSerializedResponse,
)
from sentry.services.hybrid_cloud.organization import RpcOrganizationSummary
from sentry.services.hybrid_cloud.organization_mapping.serial import serialize_organization_mapping
from sentry.services.hybrid_cloud.user import (
    RpcUser,
    UserFilterArgs,
    UserSerializeType,
    UserUpdateArgs,
)
from sentry.services.hybrid_cloud.user.serial import serialize_rpc_user
from sentry.services.hybrid_cloud.user.service import UserService


class DatabaseBackedUserService(UserService):
    def serialize_many(
        self,
        *,
        filter: UserFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
        serializer: Optional[UserSerializeType] = None,
    ) -> List[OpaqueSerializedResponse]:
        return self._FQ.serialize_many(filter, as_user, auth_context, serializer)

    def get_many(self, *, filter: UserFilterArgs) -> List[RpcUser]:
        return self._FQ.get_many(filter)

    def get_many_ids(self, *, filter: UserFilterArgs) -> List[int]:
        return self._FQ.get_many_ids(filter)

    def get_many_by_email(
        self,
        emails: List[str],
        is_active: bool = True,
        is_verified: bool = True,
        organization_id: Optional[int] = None,
    ) -> List[RpcUser]:
        user_emails_query = UserEmail.objects.filter(in_iexact("email", emails))

        if is_verified:
            user_emails_query = user_emails_query.filter(is_verified=True)

        emails_by_user_ids: MutableMapping[int, List[str]] = {}
        for ue in user_emails_query:
            emails_by_user_ids.setdefault(ue.user_id, []).append(ue.email)

        user_query = self._FQ.base_query().filter(id__in=list(emails_by_user_ids.keys()))
        if is_active:
            user_query = user_query.filter(is_active=is_active)
        if organization_id is not None:
            user_query = user_query.filter(orgmembermapping_set__organization_id=organization_id)

        return [
            self._FQ.serialize_rpc(user).by_email(email)
            for user in user_query
            for email in emails_by_user_ids[user.id]
        ]

    def get_by_username(
        self, username: str, with_valid_password: bool = True, is_active: bool | None = None
    ) -> List[RpcUser]:
        qs = self._FQ.base_query()

        if is_active is not None:
            qs = qs.filter(is_active=is_active)

        if with_valid_password:
            qs = qs.exclude(password="!")

        try:
            # First, assume username is an iexact match for username
            user = qs.get(username__iexact=username)
            return [user]
        except User.DoesNotExist:
            # If not, we can take a stab at guessing it's an email address
            if "@" in username:
                # email isn't guaranteed unique
                return list(qs.filter(email__iexact=username))
        return []

    def get_organizations(
        self,
        *,
        user_id: int,
        only_visible: bool = False,
    ) -> List[RpcOrganizationSummary]:
        if user_id is None:
            # This is impossible if type hints are followed or Pydantic enforces
            # type-checking on serialization, but is still possible if we make a call
            # from non-Mypy-checked code on the same silo. It can occur easily if
            # `request.user.id` is passed as an argument where the user is an
            # AnonymousUser. Check explicitly to guard against returning mappings
            # representing invitations.
            return []  # type: ignore[unreachable]

        org_ids = OrganizationMemberMapping.objects.filter(user_id=user_id).values_list(
            "organization_id", flat=True
        )
        org_query = OrganizationMapping.objects.filter(organization_id__in=org_ids)
        if only_visible:
            org_query = org_query.filter(status=OrganizationStatus.ACTIVE)
        return [serialize_organization_mapping(o) for o in org_query]

    def flush_nonce(self, *, user_id: int) -> None:
        user = User.objects.filter(id=user_id).first()
        if user is not None:
            user.update(session_nonce="foo")

    def update_user(
        self,
        *,
        user_id: int,
        attrs: UserUpdateArgs,
    ) -> Any:
        if len(attrs):
            User.objects.filter(id=user_id).update(**attrs)
        return self.serialize_many(filter=dict(user_ids=[user_id]))[0]

    def get_user_by_social_auth(
        self, *, organization_id: int, provider: str, uid: str
    ) -> Optional[RpcUser]:
        user = User.objects.filter(
            social_auth__provider=provider,
            social_auth__uid=uid,
            orgmembermapping_set__organization_id=organization_id,
        ).first()
        if user is None:
            return None
        return serialize_rpc_user(user)

    class _UserFilterQuery(
        FilterQueryDatabaseImpl[User, UserFilterArgs, RpcUser, UserSerializeType],
    ):
        def apply_filters(
            self,
            query: BaseQuerySet,
            filters: UserFilterArgs,
        ) -> List[User]:
            if "user_ids" in filters:
                query = query.filter(id__in=filters["user_ids"])
            if "is_active" in filters:
                query = query.filter(is_active=filters["is_active"])
            if "organization_id" in filters:
                query = query.filter(
                    orgmembermapping_set__organization_id=filters["organization_id"]
                )
            if "email_verified" in filters:
                query = query.filter(emails__is_verified=filters["email_verified"])
            if "emails" in filters:
                query = query.filter(in_iexact("emails__email", filters["emails"]))
            if "query" in filters:
                query = query.filter(
                    Q(emails__email__icontains=filters["query"])
                    | Q(name__icontains=filters["query"])
                )
            if "authenticator_types" in filters:
                at = filters["authenticator_types"]
                if at is None:
                    query = query.filter(authenticator__isnull=True)
                else:
                    query = query.filter(authenticator__isnull=False, authenticator__type__in=at)

            return list(query)

        def base_query(self, ids_only: bool = False) -> QuerySet:
            if ids_only:
                return User.objects

            return User.objects.extra(
                select={
                    "permissions": "select array_agg(permission) from sentry_userpermission where user_id=auth_user.id",
                    "roles": """
                        SELECT array_agg(permissions)
                        FROM sentry_userrole
                        JOIN sentry_userrole_users
                          ON sentry_userrole_users.role_id=sentry_userrole.id
                       WHERE user_id=auth_user.id""",
                    "useremails": "select array_agg(row_to_json(sentry_useremail)) from sentry_useremail where user_id=auth_user.id",
                    "authenticators": "SELECT array_agg(row_to_json(auth_authenticator)) FROM auth_authenticator WHERE user_id=auth_user.id",
                    "useravatar": "SELECT array_agg(row_to_json(sentry_useravatar)) FROM sentry_useravatar WHERE user_id = auth_user.id",
                }
            )

        def filter_arg_validator(self) -> Callable[[UserFilterArgs], Optional[str]]:
            return self._filter_has_any_key_validator("user_ids", "organization_id", "emails")

        def serialize_api(self, serializer_type: Optional[UserSerializeType]) -> Serializer:
            serializer: Serializer = UserSerializer()
            if serializer_type == UserSerializeType.DETAILED:
                serializer = DetailedUserSerializer()
            if serializer_type == UserSerializeType.SELF_DETAILED:
                serializer = DetailedSelfUserSerializer()
            return serializer

        def serialize_rpc(self, user: User) -> RpcUser:
            return serialize_rpc_user(user)

    _FQ = _UserFilterQuery()
