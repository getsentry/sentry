from __future__ import annotations

import base64
from typing import Any, List, Mapping, Optional

from django.contrib.auth.models import AnonymousUser
from django.db import router, transaction
from django.db.models import Count, F, Q

from sentry import roles
from sentry.auth.access import get_permissions_for_user
from sentry.auth.system import SystemToken
from sentry.middleware.auth import RequestAuthenticationMiddleware
from sentry.middleware.placeholder import placeholder_get_response
from sentry.models import (
    ApiKey,
    ApiToken,
    AuthIdentity,
    AuthProvider,
    OrganizationMemberMapping,
    OrgAuthToken,
    User,
    outbox_context,
)
from sentry.services.hybrid_cloud.auth import (
    AuthenticatedToken,
    AuthenticationContext,
    AuthenticationRequest,
    AuthService,
    MiddlewareAuthenticationResponse,
    RpcApiKey,
    RpcAuthenticatorType,
    RpcAuthProvider,
    RpcAuthState,
    RpcMemberSsoState,
    RpcOrganizationAuthConfig,
)
from sentry.services.hybrid_cloud.auth.serial import serialize_api_key, serialize_auth_provider
from sentry.services.hybrid_cloud.organization import (
    RpcOrganizationMemberSummary,
    organization_service,
)
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.silo import unguarded_write
from sentry.utils.auth import AuthUserPasswordExpired

_SSO_BYPASS = RpcMemberSsoState(is_required=False, is_valid=True)
_SSO_NONMEMBER = RpcMemberSsoState(is_required=False, is_valid=False)


def _query_sso_state(
    organization_id: int | None, is_super_user: bool, member: RpcOrganizationMemberSummary | None
) -> RpcMemberSsoState:
    """
    Check whether SSO is required and valid for a given member.
    This should generally be accessed from the `request.access` object.
    :param member:
    :param org_member_class:
    :return:
    """
    if organization_id is None:
        return _SSO_NONMEMBER

    # we special case superuser so that if they're a member of the org they must still follow SSO checks
    # or put another way, superusers who are not members of orgs bypass SSO.
    if member is None:
        if is_super_user:
            return _SSO_BYPASS
        return _SSO_NONMEMBER

    try:
        auth_provider = AuthProvider.objects.get(organization_id=member.organization_id)
    except AuthProvider.DoesNotExist:
        return _SSO_BYPASS

    if auth_provider.flags.allow_unlinked:
        return _SSO_BYPASS
    else:
        requires_sso = True
        try:
            auth_identity = AuthIdentity.objects.get(
                auth_provider=auth_provider, user=member.user_id
            )
        except AuthIdentity.DoesNotExist:
            sso_is_valid = False
            requires_sso = not _can_override_sso_as_owner(auth_provider, member)
        else:
            sso_is_valid = auth_identity.is_valid(member)

    return RpcMemberSsoState(is_required=requires_sso, is_valid=sso_is_valid)


def _can_override_sso_as_owner(
    auth_provider: AuthProvider, member: RpcOrganizationMemberSummary
) -> bool:
    """If an owner is trying to gain access, allow bypassing SSO if there are no
    other owners with SSO enabled.
    """

    org_roles = organization_service.get_all_org_roles(
        member_id=member.id, organization_id=member.organization_id
    )
    if roles.get_top_dog().id not in org_roles:
        return False

    all_top_dogs_from_teams = organization_service.get_top_dog_team_member_ids(
        organization_id=member.organization_id
    )
    user_ids = (
        OrganizationMemberMapping.objects.filter(
            Q(id__in=all_top_dogs_from_teams) | Q(role=roles.get_top_dog().id),
            organization_id=member.organization_id,
            user__is_active=True,
        )
        .exclude(id=member.id)
        .values_list("user_id")
    )
    return not AuthIdentity.objects.filter(auth_provider=auth_provider, user__in=user_ids).exists()


class DatabaseBackedAuthService(AuthService):
    def get_organization_api_keys(self, *, organization_id: int) -> List[RpcApiKey]:
        return [
            serialize_api_key(k) for k in ApiKey.objects.filter(organization_id=organization_id)
        ]

    def get_organization_key(self, *, key: str) -> Optional[RpcApiKey]:
        try:
            return serialize_api_key(ApiKey.objects.get(key=key))
        except ApiKey.DoesNotExist:
            return None

    def get_org_auth_config(
        self, *, organization_ids: List[int]
    ) -> List[RpcOrganizationAuthConfig]:
        aps = {
            ap.organization_id: ap
            for ap in AuthProvider.objects.filter(organization_id__in=organization_ids)
        }
        qs = {
            row["organization_id"]: row["id__count"]
            for row in (
                ApiKey.objects.filter(organization_id__in=organization_ids)
                .values("organization_id")
                .annotate(Count("id"))
            )
        }
        return [
            RpcOrganizationAuthConfig(
                organization_id=oid,
                auth_provider=serialize_auth_provider(aps[oid]) if oid in aps else None,
                has_api_key=qs.get(oid, 0) > 0,
            )
            for oid in organization_ids
        ]

    def authenticate_with(
        self, *, request: AuthenticationRequest, authenticator_types: List[RpcAuthenticatorType]
    ) -> AuthenticationContext:
        fake_request = FakeAuthenticationRequest(request)

        for authenticator_type in authenticator_types:
            t = authenticator_type.as_authenticator().authenticate(fake_request)  # type: ignore[arg-type]
            if t is not None:
                user, token = t
                return AuthenticationContext(
                    auth=AuthenticatedToken.from_token(token),
                    user=user_service.get_user(user_id=user.id),
                )

        return AuthenticationContext(auth=None, user=None)

    def authenticate(self, *, request: AuthenticationRequest) -> MiddlewareAuthenticationResponse:
        fake_request = FakeAuthenticationRequest(request)
        handler = RequestAuthenticationMiddleware(placeholder_get_response)
        expired_user = None
        try:
            # Hahaha.  Yes.  You're reading this right.  I'm calling, the middleware, from the service method, that is
            # called, from slightly different, middleware.
            handler.process_request(fake_request)  # type: ignore[arg-type]
        except AuthUserPasswordExpired as e:
            expired_user = e.user
        except Exception as e:
            raise Exception("Unexpected error processing handler") from e

        auth = None
        if fake_request.auth is not None:
            auth = AuthenticatedToken.from_token(fake_request.auth)

        result = MiddlewareAuthenticationResponse(
            auth=auth,
            user_from_signed_request=fake_request.user_from_signed_request,
            accessed=fake_request.session._accessed,
        )

        if expired_user is not None:
            result.user = user_service.get_user(user_id=expired_user.id)
            result.expired = True
        elif fake_request.user is not None and not fake_request.user.is_anonymous:
            with transaction.atomic(using=router.db_for_read(User)):
                result.user = user_service.get_user(user_id=fake_request.user.id)
                transaction.set_rollback(True, using=router.db_for_read(User))

        return result

    def get_user_auth_state(
        self,
        *,
        user_id: int,
        is_superuser: bool,
        organization_id: int | None,
        org_member: RpcOrganizationMemberSummary | None,
    ) -> RpcAuthState:
        sso_state = _query_sso_state(
            organization_id=organization_id, is_super_user=is_superuser, member=org_member
        )

        if is_superuser:
            # "permissions" is a bit of a misnomer -- these are all admin level permissions, and the intent is that if you
            # have them, you can only use them when you are acting, as a superuser.  This is intentional.
            permissions = list(get_permissions_for_user(user_id))
        else:
            permissions = []

        return RpcAuthState(sso_state=sso_state, permissions=permissions)

    def get_org_ids_with_scim(
        self,
    ) -> List[int]:
        return list(
            AuthProvider.objects.filter(
                flags=F("flags").bitor(AuthProvider.flags.scim_enabled)
            ).values_list("organization_id", flat=True)
        )

    def get_auth_provider(self, organization_id: int) -> Optional[RpcAuthProvider]:
        try:
            auth_provider = AuthProvider.objects.get(organization_id=organization_id)
        except AuthProvider.DoesNotExist:
            return None
        return serialize_auth_provider(auth_provider)

    def change_scim(
        self, *, user_id: int, provider_id: int, enabled: bool, allow_unlinked: bool
    ) -> None:
        try:
            auth_provider = AuthProvider.objects.get(id=provider_id)
            user = User.objects.get(id=user_id)
        except (AuthProvider.DoesNotExist, User.DoesNotExist):
            return

        with outbox_context(transaction.atomic(router.db_for_write(AuthProvider))):
            auth_provider.flags.allow_unlinked = allow_unlinked
            if auth_provider.flags.scim_enabled != enabled:
                if enabled:
                    auth_provider.enable_scim(user)
                else:
                    auth_provider.disable_scim()

            auth_provider.save()

    def disable_provider(self, *, provider_id: int) -> None:
        with outbox_context(transaction.atomic(router.db_for_write(AuthProvider))):
            try:
                auth_provider = AuthProvider.objects.get(id=provider_id)
            except AuthProvider.DoesNotExist:
                return

            user_ids = OrganizationMemberMapping.objects.filter(
                organization_id=auth_provider.organization_id
            ).values_list("user_id", flat=True)
            with unguarded_write(router.db_for_write(User)):
                User.objects.filter(id__in=user_ids).update(is_managed=False)

            if auth_provider.flags.scim_enabled:
                auth_provider.disable_scim()
            auth_provider.delete()

    def update_provider_config(
        self, organization_id: int, auth_provider_id: int, config: Mapping[str, Any]
    ) -> None:
        current_provider = AuthProvider.objects.filter(
            organization_id=organization_id, id=auth_provider_id
        ).first()
        if current_provider is None:
            return
        current_provider.config = config
        current_provider.save()


class FakeRequestDict:
    d: Mapping[str, str | bytes | None]
    _accessed: set[str]

    def __init__(self, **d: Any):
        self.d = d
        self._accessed = set()

    @property
    def accessed(self) -> bool:
        return bool(self._accessed)

    def __getitem__(self, item: str) -> str | bytes:
        self._accessed.add(item)
        result = self.d[item]
        if result is None:
            raise KeyError(f"Key '{item!r}' does not exist")
        return result

    def __contains__(self, item: str) -> bool:
        return self.d.get(item, None) is not None

    def get(self, key: str, default: str | bytes | None = None) -> str | bytes | None:
        try:
            return self[key]
        except KeyError:
            return default


class FakeAuthenticationRequest:
    """
    Our authentication framework all speaks request objects -- it is not easily possible to replace all of the django
    authentication helpers, backends, and other logic that is part of authentication, to speak some other sort of object,
    or to be pure and simply return results.  They mutate "request" objects, and thus, we have to capture results by
    "receiving" these mutations on a fake, generated context that is isolated for the purpose of calculating
    authentication.  In some future, we may need or want to vendor our own custom authentication system so that, you
    know, it returns pure results instead of expecting constantly to mutate full request objects, but hey! :shrug:.
    """

    session: FakeRequestDict
    GET: FakeRequestDict
    POST: FakeRequestDict
    req: AuthenticationRequest

    # These attributes are expected to be mutated when we call into the authentication middleware.  The result of those
    # mutations becomes, the result of authentication.
    user: User | AnonymousUser | None
    user_from_signed_request: bool = False
    auth: Any

    def build_absolute_uri(self, path: str | None = None) -> str:
        if path is None:
            return self.req.absolute_url
        return self.req.absolute_url_root

    def __init__(self, req: AuthenticationRequest) -> None:
        self.auth = None
        self.req = req
        self.session = FakeRequestDict(
            _auth_user_id=req.user_id,
            _auth_user_backend=req.backend,
            _auth_user_hash=req.user_hash,
            _nonce=req.nonce,
        )
        self.POST = FakeRequestDict(
            _sentry_request_signature=req.signature,
        )

        self.GET = FakeRequestDict(
            _=req.signature,
        )

        self.META = FakeRequestDict(
            HTTP_AUTHORIZATION=_unwrap_b64(req.authorization_b64), REMOTE_ADDR=req.remote_addr
        )
        self.user_from_signed_request = False

    @property
    def path(self) -> str:
        return self.req.path


def _unwrap_b64(input: str | None) -> bytes | None:
    if input is None:
        return None

    return base64.b64decode(input.encode("utf8"))


AuthenticatedToken.register_kind("system", SystemToken)
AuthenticatedToken.register_kind("api_token", ApiToken)
AuthenticatedToken.register_kind("org_auth_token", OrgAuthToken)
AuthenticatedToken.register_kind("api_key", ApiKey)


def promote_request_rpc_user(request: Any) -> User:
    if not hasattr(request, "_promoted_user"):
        setattr(request, "_promoted_user", User.objects.get(id=request.user.id))
    return request._promoted_user


promote_request_api_user = promote_request_rpc_user
