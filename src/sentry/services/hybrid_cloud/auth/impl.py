from __future__ import annotations

import base64
import dataclasses
from typing import List, Mapping

from django.contrib.auth.models import AnonymousUser
from django.db.models import Count, F

from sentry import roles
from sentry.auth.access import get_permissions_for_user
from sentry.auth.system import SystemToken
from sentry.middleware.auth import RequestAuthenticationMiddleware
from sentry.models import ApiKey, ApiToken, AuthIdentity, AuthProvider, OrganizationMember, User
from sentry.services.hybrid_cloud.auth import (
    ApiAuthProvider,
    ApiAuthProviderFlags,
    ApiAuthState,
    ApiMemberSsoState,
    ApiOrganizationAuthConfig,
    AuthenticatedToken,
    AuthenticationRequest,
    AuthenticationResponse,
    AuthService,
)
from sentry.services.hybrid_cloud.organization import ApiOrganizationMember
from sentry.services.hybrid_cloud.user import user_service
from sentry.silo import SiloMode
from sentry.utils.auth import AuthUserPasswordExpired
from sentry.utils.types import Any

_SSO_BYPASS = ApiMemberSsoState(False, True)
_SSO_NONMEMBER = ApiMemberSsoState(False, False)


# When OrgMemberMapping table is created for the control silo, org_member_class will use that rather
# than the OrganizationMember type.
def query_sso_state(
    organization_id: int | None,
    is_super_user: bool,
    member: ApiOrganizationMember | OrganizationMember | None,
    org_member_class: Any = OrganizationMember,
) -> ApiMemberSsoState:
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
            if member.role == roles.get_top_dog().id:

                def get_user_ids(org_id: int, mem_id: int) -> Any:
                    return (
                        org_member_class.objects.filter(
                            organization_id=org_id,
                            role=roles.get_top_dog().id,
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

    return ApiMemberSsoState(is_required=requires_sso, is_valid=sso_is_valid)


class DatabaseBackedAuthService(AuthService):
    def _serialize_auth_provider_flags(self, ap: AuthProvider) -> ApiAuthProviderFlags:
        d: dict[str, bool] = {}
        for f in dataclasses.fields(ApiAuthProviderFlags):
            d[f.name] = bool(ap.flags[f.name])
        return ApiAuthProviderFlags(**d)

    def _serialize_auth_provider(self, ap: AuthProvider) -> ApiAuthProvider:
        return ApiAuthProvider(
            id=ap.id,
            organization_id=ap.organization_id,
            provider=ap.provider,
            flags=self._serialize_auth_provider_flags(ap),
        )

    def get_org_auth_config(
        self, *, organization_ids: List[int]
    ) -> List[ApiOrganizationAuthConfig]:
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
            ApiOrganizationAuthConfig(
                organization_id=oid,
                auth_provider=self._serialize_auth_provider(aps[oid]) if oid in aps else None,
                has_api_key=qs.get(oid, 0) > 0,
            )
            for oid in organization_ids
        ]

    def authenticate(self, *, request: AuthenticationRequest) -> AuthenticationResponse:
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

        result = AuthenticationResponse(
            auth=auth, user_from_signed_request=fake_request.user_from_signed_request
        )

        if expired_user is not None:
            result.user = user_service.serialize_user(expired_user)
            result.expired = True
        elif fake_request.user is not None and not fake_request.user.is_anonymous:
            from django.db import connections, transaction

            with transaction.atomic():
                result.user = user_service.serialize_user(fake_request.user)
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
        org_member: ApiOrganizationMember | OrganizationMember | None,
    ) -> ApiAuthState:
        sso_state = query_sso_state(
            organization_id=organization_id,
            is_super_user=is_superuser,
            member=org_member,
            org_member_class=OrganizationMember,
        )
        permissions: List[str] = list()
        # "permissions" is a bit of a misnomer -- these are all admin level permissions, and the intent is that if you
        # have them, you can only use them when you are acting, as a superuser.  This is intentional.
        if is_superuser:
            permissions.extend(get_permissions_for_user(user_id))

        return ApiAuthState(
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

    def build_absolute_uri(self) -> str:
        return self.req.absolute_url

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
