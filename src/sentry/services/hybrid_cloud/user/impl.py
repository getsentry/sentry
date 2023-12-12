from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, MutableMapping, Optional, Tuple
from uuid import uuid4

from django.db import router, transaction
from django.db.models import F, Q, QuerySet
from django.utils.text import slugify

from sentry.api.serializers import (
    DetailedSelfUserSerializer,
    DetailedUserSerializer,
    UserSerializer,
)
from sentry.api.serializers.base import Serializer, serialize
from sentry.db.models.query import in_iexact
from sentry.models.authidentity import AuthIdentity
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.user import User
from sentry.models.useremail import UserEmail
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import (
    FilterQueryDatabaseImpl,
    OpaqueSerializedResponse,
)
from sentry.services.hybrid_cloud.organization_mapping.model import RpcOrganizationMapping
from sentry.services.hybrid_cloud.organization_mapping.serial import serialize_organization_mapping
from sentry.services.hybrid_cloud.user import (
    RpcUser,
    UserFilterArgs,
    UserSerializeType,
    UserUpdateArgs,
)
from sentry.services.hybrid_cloud.user.model import RpcVerifyUserEmail, UserIdEmailArgs
from sentry.services.hybrid_cloud.user.serial import serialize_rpc_user
from sentry.services.hybrid_cloud.user.service import UserService
from sentry.signals import user_signup

logger = logging.getLogger("user:provisioning")


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
            return [serialize_rpc_user(user)]
        except User.DoesNotExist:
            # If not, we can take a stab at guessing it's an email address
            if "@" in username:
                # email isn't guaranteed unique
                return [serialize_rpc_user(u) for u in qs.filter(email__iexact=username)]
        return []

    def get_existing_usernames(self, *, usernames: List[str]) -> List[str]:
        users = User.objects.filter(username__in=usernames)
        return list(users.values_list("username", flat=True))

    def get_organizations(
        self,
        *,
        user_id: int,
        only_visible: bool = False,
    ) -> List[RpcOrganizationMapping]:
        if user_id is None:
            # This is impossible if type hints are followed or Pydantic enforces type-checking
            # on serialization, but is still possible if we make a call
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
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

        if len(attrs):
            for k, v in attrs.items():
                setattr(user, k, v)
            user.save()

        return serialize(user)

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

    def get_first_superuser(self) -> Optional[RpcUser]:
        user = User.objects.filter(is_superuser=True, is_active=True).first()
        if user is None:
            return None
        return serialize_rpc_user(user)

    def get_or_create_user_by_email(
        self, *, email: str, ident: Optional[str] = None, referrer: Optional[str] = None
    ) -> Tuple[RpcUser, bool]:
        with transaction.atomic(router.db_for_write(User)):
            rpc_user = self.get_user_by_email(email=email, ident=ident)
            if rpc_user:
                return (rpc_user, False)

            # Create User if it doesn't exist
            user = User.objects.create(
                username=f"{slugify(str.split(email, '@')[0])}-{uuid4().hex}",
                email=email,
                name=email,
            )
            user_signup.send_robust(
                sender=self, user=user, source="api", referrer=referrer or "unknown"
            )
            user.update(flags=F("flags").bitor(User.flags.newsletter_consent_prompt))
            return (serialize_rpc_user(user), True)

    def get_user_by_email(
        self,
        *,
        email: str,
        ident: Optional[str] = None,
    ) -> Optional[RpcUser]:
        user_query = User.objects.filter(email__iexact=email, is_active=True)
        if user_query.exists():
            # Users are not supposed to have the same email but right now our auth pipeline let this happen
            # So let's not break the user experience. Instead return the user with auth identity of ident or
            # the first user if ident is None
            user = user_query[0]
            if user_query.count() > 1:
                logger.warning("Email has multiple users", extra={"email": email})
                if ident:
                    identity_query = AuthIdentity.objects.filter(user__in=user_query, ident=ident)
                    if identity_query.exists():
                        user = identity_query[0].user
                    if identity_query.count() > 1:
                        logger.warning(
                            "Email has two auth identity for the same ident",
                            extra={"email": email},
                        )
            return serialize_rpc_user(user)
        return None

    def verify_any_email(self, *, email: str) -> bool:
        user_email = UserEmail.objects.filter(email__iexact=email).first()
        if user_email is None:
            return False
        if not user_email.is_verified:
            user_email.update(is_verified=True)
            return True
        return False

    def create_by_username_and_email(self, *, email: str, username: str) -> RpcUser:
        return serialize_rpc_user(User.objects.create(username=username, email=email))

    def trigger_user_consent_email_if_applicable(self, *, user_id: int) -> None:
        user = User.objects.get(id=user_id)
        flag = User.flags.newsletter_consent_prompt
        user.update(flags=F("flags").bitor(flag))
        user.send_confirm_emails(is_new_user=True)

    def verify_user_emails(
        self, *, user_id_emails: List[UserIdEmailArgs]
    ) -> Dict[int, RpcVerifyUserEmail]:
        results = {}
        for user_id_email in user_id_emails:
            user_id = user_id_email["user_id"]
            email = user_id_email["email"]
            exists = UserEmail.objects.filter(user_id=user_id, email__iexact=email).exists()
            results[user_id] = RpcVerifyUserEmail(email=email, exists=exists)
        return results

    class _UserFilterQuery(
        FilterQueryDatabaseImpl[User, UserFilterArgs, RpcUser, UserSerializeType],
    ):
        def apply_filters(self, query: QuerySet[User], filters: UserFilterArgs) -> QuerySet[User]:
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

            return query

        def base_query(self, ids_only: bool = False) -> QuerySet[User]:
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
