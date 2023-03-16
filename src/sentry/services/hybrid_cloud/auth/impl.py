from __future__ import annotations

import base64
from typing import List, Mapping, Tuple

from django.contrib.auth.models import AnonymousUser
from django.db.models import Count, F, Q
from rest_framework.request import Request

from sentry import features, roles
from sentry.api.invite_helper import ApiInviteHelper
from sentry.auth.access import get_permissions_for_user
from sentry.auth.system import SystemToken
from sentry.middleware.auth import RequestAuthenticationMiddleware
from sentry.models import (
    ApiKey,
    ApiToken,
    AuthIdentity,
    AuthProvider,
    Organization,
    OrganizationMember,
    SentryAppInstallationToken,
    User,
)
from sentry.services.hybrid_cloud.auth import (
    AuthenticatedToken,
    AuthenticationContext,
    AuthenticationRequest,
    AuthService,
    MiddlewareAuthenticationResponse,
    RpcAuthenticatorType,
    RpcAuthIdentity,
    RpcAuthProvider,
    RpcAuthProviderFlags,
    RpcAuthState,
    RpcMemberSsoState,
    RpcOrganizationAuthConfig,
)
from sentry.services.hybrid_cloud.organization import (
    RpcOrganization,
    RpcOrganizationMember,
    RpcOrganizationMemberFlags,
    RpcOrganizationMemberSummary,
    organization_service,
)
from sentry.services.hybrid_cloud.organization.impl import DatabaseBackedOrganizationService
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.impl import serialize_rpc_user
from sentry.silo import SiloMode
from sentry.utils.auth import AuthUserPasswordExpired
from sentry.utils.types import Any

_SSO_BYPASS = RpcMemberSsoState(is_required=False, is_valid=True)
_SSO_NONMEMBER = RpcMemberSsoState(is_required=False, is_valid=False)


# When OrgMemberMapping table is created for the control silo, org_member_class will use that rather
# than the OrganizationMember type.
def query_sso_state(
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
        auth_provider = AuthProvider.objects.get(organization=member.organization_id)
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
            # If an owner is trying to gain access,
            # allow bypassing SSO if there are no other
            # owners with SSO enabled.
            if roles.get_top_dog().id in organization_service.get_all_org_roles(
                member_id=member.id
            ):

                def get_user_ids(org_id: int, mem_id: int) -> Any:
                    all_top_dogs_from_teams = organization_service.get_top_dog_team_member_ids(
                        organization_id=org_id
                    )
                    return (
                        OrganizationMember.objects.filter(
                            Q(id__in=all_top_dogs_from_teams) | Q(role=roles.get_top_dog().id),
                            organization_id=org_id,
                            user__is_active=True,
                        )
                        .exclude(id=mem_id)
                        .values_list("user_id")
                    )

                if SiloMode.get_current_mode() != SiloMode.MONOLITH:
                    # Giant hack for now until we have control silo org membership table.
                    with SiloMode.exit_single_process_silo_context(), SiloMode.enter_single_process_silo_context(
                        SiloMode.MONOLITH
                    ):
                        user_ids = get_user_ids(member.organization_id, member.id)
                else:
                    user_ids = get_user_ids(member.organization_id, member.id)

                requires_sso = AuthIdentity.objects.filter(
                    auth_provider=auth_provider,
                    user__in=user_ids,
                ).exists()
        else:
            sso_is_valid = auth_identity.is_valid(member)

    return RpcMemberSsoState(is_required=requires_sso, is_valid=sso_is_valid)


class DatabaseBackedAuthService(AuthService):
    def _serialize_auth_provider_flags(self, ap: AuthProvider) -> RpcAuthProviderFlags:
        return RpcAuthProviderFlags(
            allow_unlinked=ap.allow_unlinked,
            scim_enabled=ap.scim_enabled,
        )

    def _serialize_auth_provider(self, ap: AuthProvider) -> RpcAuthProvider:
        return RpcAuthProvider(
            id=ap.id,
            organization_id=ap.organization_id,
            provider=ap.provider,
            flags=self._serialize_auth_provider_flags(ap),
        )

    def get_org_auth_config(
        self, *, organization_ids: List[int]
    ) -> List[RpcOrganizationAuthConfig]:
        aps: Mapping[int, AuthProvider] = {
            ap.organization_id: ap
            for ap in AuthProvider.objects.filter(organization_id__in=organization_ids)
        }
        qs: Mapping[int, int] = {
            row["organization_id"]: row["id__count"]
            for row in ApiKey.objects.filter(organization_id__in=organization_ids)
            .values("organization_id")
            .annotate(Count("id"))
        }
        return [
            RpcOrganizationAuthConfig(
                organization_id=oid,
                auth_provider=self._serialize_auth_provider(aps[oid]) if oid in aps else None,
                has_api_key=qs.get(oid, 0) > 0,
            )
            for oid in organization_ids
        ]

    def authenticate_with(
        self, *, request: AuthenticationRequest, authenticator_types: List[RpcAuthenticatorType]
    ) -> AuthenticationContext:
        fake_request = FakeAuthenticationRequest(request)
        user: User | None = None
        token: Any = None

        for authenticator_type in authenticator_types:
            t = authenticator_type.as_authenticator().authenticate(fake_request)
            if t is not None:
                user, token = t
                break

        return AuthenticationContext(
            auth=AuthenticatedToken.from_token(token) if token else None,
            user=serialize_rpc_user(user) if user else None,
        )

    def token_has_org_access(self, *, token: AuthenticatedToken, organization_id: int) -> bool:
        return SentryAppInstallationToken.objects.has_organization_access(token, organization_id)  # type: ignore

    def authenticate(self, *, request: AuthenticationRequest) -> MiddlewareAuthenticationResponse:
        fake_request = FakeAuthenticationRequest(request)
        handler: Any = RequestAuthenticationMiddleware()
        expired_user: User | None = None
        try:
            # Hahaha.  Yes.  You're reading this right.  I'm calling, the middleware, from the service method, that is
            # called, from slightly different, middleware.
            handler.process_request(fake_request)
        except AuthUserPasswordExpired as e:
            expired_user = e.user
        except Exception as e:
            raise Exception("Unexpected error processing handler") from e

        auth: AuthenticatedToken | None = None
        if fake_request.auth is not None:
            auth = AuthenticatedToken.from_token(fake_request.auth)

        result = MiddlewareAuthenticationResponse(
            auth=auth, user_from_signed_request=fake_request.user_from_signed_request
        )

        if expired_user is not None:
            result.user = serialize_rpc_user(expired_user)
            result.expired = True
        elif fake_request.user is not None and not fake_request.user.is_anonymous:
            from django.db import connections, transaction

            with transaction.atomic():
                result.user = serialize_rpc_user(fake_request.user)
                transaction.set_rollback(True)
            if SiloMode.single_process_silo_mode():
                connections.close_all()

        return result

    def get_user_auth_state(
        self,
        *,
        user_id: int,
        is_superuser: bool,
        organization_id: int | None,
        org_member: RpcOrganizationMemberSummary | None,
    ) -> RpcAuthState:
        sso_state = query_sso_state(
            organization_id=organization_id, is_super_user=is_superuser, member=org_member
        )
        permissions: List[str] = list()
        # "permissions" is a bit of a misnomer -- these are all admin level permissions, and the intent is that if you
        # have them, you can only use them when you are acting, as a superuser.  This is intentional.
        if is_superuser:
            permissions.extend(get_permissions_for_user(user_id))

        return RpcAuthState(
            sso_state=sso_state,
            permissions=permissions,
        )

    def close(self) -> None:
        pass

    def get_org_ids_with_scim(
        self,
    ) -> List[int]:
        return list(
            AuthProvider.objects.filter(
                flags=F("flags").bitor(AuthProvider.flags.scim_enabled)
            ).values_list("organization_id", flat=True)
        )

    def get_auth_providers(self, organization_id: int) -> List[RpcAuthProvider]:
        return list(AuthProvider.objects.filter(organization_id=organization_id))

    def handle_new_membership(
        self,
        request: Request,
        organization: RpcOrganization,
        auth_identity: RpcAuthIdentity,
        auth_provider: RpcAuthProvider,
    ) -> Tuple[RpcUser, RpcOrganizationMember]:
        # TODO: Might be able to keep hold of the RpcUser object whose ID was
        #  originally passed to construct the RpcAuthIdentity object
        user = User.objects.get(id=auth_identity.user_id)
        serial_user = serialize_rpc_user(user)

        # This raises an AvailabilityError
        # TODO: Extract ApiInviteHelper methods into new service methods
        orm_org = Organization.objects.get(id=organization.id)

        # If the user is either currently *pending* invite acceptance (as indicated
        # from the invite token and member id in the session) OR an existing invite exists on this
        # organization for the email provided by the identity provider.
        invite_helper = ApiInviteHelper.from_session_or_email(
            request=request, organization=orm_org, email=user.email
        )

        # If we are able to accept an existing invite for the user for this
        # organization, do so, otherwise handle new membership
        if invite_helper:
            if invite_helper.invite_approved:
                om = invite_helper.accept_invite(user)
                return serial_user, DatabaseBackedOrganizationService.serialize_member(om)

            # It's possible the user has an _invite request_ that hasn't been approved yet,
            # and is able to join the organization without an invite through the SSO flow.
            # In that case, delete the invite request and create a new membership.
            invite_helper.handle_invite_not_approved()

        flags = RpcOrganizationMemberFlags(sso__linked=True)
        # if the org doesn't have the ability to add members then anyone who got added
        # this way should be disabled until the org upgrades
        if not features.has("organizations:invite-members", orm_org):
            flags.member_limit__restricted = True

        # Otherwise create a new membership
        om = organization_service.add_organization_member(
            organization=organization,
            role=organization.default_role,
            user=serial_user,
            flags=flags,
        )

        # TODO: Combine into one query
        provider_model = AuthProvider.objects.get(id=auth_provider.id)
        default_team_ids = provider_model.default_teams.values_list("id", flat=True)

        for team_id in default_team_ids:
            organization_service.add_team_member(team_id=team_id, organization_member=om)

        return serial_user, om


class FakeRequestDict:
    d: Mapping[str, str | bytes | None]

    def __init__(self, **d: Any):
        self.d = d

    def __getitem__(self, item: str) -> str | bytes:
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
AuthenticatedToken.register_kind("api_key", ApiKey)


def promote_request_rpc_user(request: Any) -> User:
    if not hasattr(request, "_promoted_user"):
        setattr(request, "_promoted_user", User.objects.get(id=request.user.id))
    return request._promoted_user


promote_request_api_user = promote_request_rpc_user
