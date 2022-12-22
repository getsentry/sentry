from __future__ import annotations

import base64
import dataclasses
import logging
from typing import TYPE_CHECKING, List, Mapping, Tuple
from uuid import uuid4

from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, transaction
from django.db.models import Count, F
from django.utils import timezone
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
    User,
)
from sentry.services.hybrid_cloud.auth import (
    ApiAuthIdentity,
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
from sentry.services.hybrid_cloud.organization import (
    ApiOrganization,
    ApiOrganizationMember,
    ApiOrganizationMemberFlags,
    organization_service,
)
from sentry.services.hybrid_cloud.organization.impl import DatabaseBackedOrganizationService
from sentry.services.hybrid_cloud.user import APIUser, user_service
from sentry.silo import SiloMode
from sentry.utils.auth import AuthUserPasswordExpired
from sentry.utils.types import Any

if TYPE_CHECKING:
    from sentry.auth.provider import Provider

logger = logging.getLogger("sentry.auth")

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
    @classmethod
    def _serialize_auth_provider_flags(cls, ap: AuthProvider) -> ApiAuthProviderFlags:
        d: dict[str, bool] = {}
        for f in dataclasses.fields(ApiAuthProviderFlags):
            d[f.name] = bool(ap.flags[f.name])
        return ApiAuthProviderFlags(**d)

    @classmethod
    def serialize_auth_provider(cls, ap: AuthProvider) -> ApiAuthProvider:
        return ApiAuthProvider(
            id=ap.id,
            organization_id=ap.organization_id,
            provider=ap.provider,
            flags=cls._serialize_auth_provider_flags(ap),
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
                auth_provider=self.serialize_auth_provider(aps[oid]) if oid in aps else None,
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

    def _serialize_auth_identity(self, auth_identity: AuthIdentity) -> ApiAuthIdentity:
        return ApiAuthIdentity(
            id=auth_identity.id,
            user_id=auth_identity.user_id,
            provider_id=auth_identity.auth_provider_id,
            ident=auth_identity.ident,
        )

    def provision_user_from_sso(
        self, *, auth_provider: ApiAuthProvider, identity_data: Mapping[str, Any]
    ) -> Tuple[APIUser, ApiAuthIdentity]:
        from django.conf import settings

        user = User.objects.create(
            username=uuid4().hex,
            email=identity_data["email"],
            name=identity_data.get("name", "")[:200],
        )

        if settings.TERMS_URL and settings.PRIVACY_URL:
            user.update(flags=F("flags").bitor(User.flags.newsletter_consent_prompt))

        try:
            with transaction.atomic():
                auth_identity = AuthIdentity.objects.create(
                    auth_provider=auth_provider,
                    user=user,
                    ident=identity_data["id"],
                    data=identity_data.get("data", {}),
                )
        except IntegrityError:
            auth_identity = AuthIdentity.objects.get(
                auth_provider_id=auth_provider.id, ident=identity_data["id"]
            )
            auth_identity.update(user=user, data=identity_data.get("data", {}))

        user.send_confirm_emails(is_new_user=True)

        serial_user = user_service.serialize_user(user)
        serial_auth_identity = self._serialize_auth_identity(auth_identity)
        return serial_user, serial_auth_identity

    def attach_identity(
        self,
        user_id: int,
        auth_provider: ApiAuthProvider,
        provider: Provider,
        organization: ApiOrganization,
        identity_attrs: Mapping[str, Any],
    ) -> Tuple[bool, ApiAuthIdentity]:
        def lookup_auth_identity(**params: Any) -> AuthIdentity | None:
            try:
                return AuthIdentity.objects.get(auth_provider_id=auth_provider.id, **params)
            except AuthIdentity.DoesNotExist:
                return None

        # prioritize identifying by the SSO provider's user ID
        auth_identity = lookup_auth_identity(ident=identity_attrs["id"])
        if auth_identity is None:
            # otherwise look for an already attached identity
            # this can happen if the SSO provider's internal ID changes
            auth_identity = lookup_auth_identity(user_id=user_id)

        def wipe_existing_identity() -> Any:
            # it's possible the user has an existing identity, let's wipe it out
            # so that the new identifier gets used (other we'll hit a constraint)
            # violation since one might exist for (provider, user) as well as
            # (provider, ident)
            assert auth_identity is not None
            deletion_result = (
                AuthIdentity.objects.exclude(id=auth_identity.id)
                .filter(auth_provider_id=auth_provider.id, user_id=user_id)
                .delete()
            )

            # since we've identified an identity which is no longer valid
            # lets preemptively mark it as such
            other_member = organization_service.check_membership_by_id(
                organization_id=organization.id, user_id=auth_identity.user_id
            )
            if other_member is None:
                return
            other_member.flags.sso__invalid = True
            other_member.flags.sso__linked = False
            organization_service.update_membership_flags(organization_member=other_member)

            return deletion_result

        if auth_is_new := auth_identity is None:
            auth_identity = AuthIdentity.objects.create(
                auth_provider_id=auth_provider.id,
                user_id=user_id,
                ident=identity_attrs["id"],
                data=identity_attrs.get("data", {}),
            )
        else:
            # TODO(dcramer): this might leave the user with duplicate accounts,
            # and in that kind of situation its very reasonable that we could
            # test email addresses + is_managed to determine if we can auto
            # merge
            if auth_identity.user.id != user_id:
                wipe = wipe_existing_identity()
            else:
                wipe = None

            logger.info(
                "sso.login-pipeline.attach-existing-identity",
                extra={
                    "wipe_result": repr(wipe),
                    "organization_id": organization.id,
                    "user_id": user_id,
                    "auth_identity_user_id": auth_identity.user.id,
                    "auth_provider_id": auth_provider.id,
                    "idp_identity_id": identity_attrs["id"],
                    "idp_identity_email": identity_attrs.get("email"),
                },
            )

            new_data = provider.update_identity(
                new_data=identity_attrs.get("data", {}), current_data=auth_identity.data
            )
            now = timezone.now()
            auth_identity.update(
                user_id=user_id,
                ident=identity_attrs["id"],
                data=new_data,
                last_verified=now,
                last_synced=now,
            )

        return auth_is_new, self._serialize_auth_identity(auth_identity)

    def handle_new_membership(
        self,
        request: Request,
        organization: ApiOrganization,
        auth_identity: ApiAuthIdentity,
        auth_provider: ApiAuthProvider,
    ) -> Tuple[APIUser, ApiOrganizationMember | None]:
        # TODO: Might be able to keep hold of the APIUser object whose ID was
        #  originally passed to construct the ApiAuthIdentity object
        user = User.objects.get(id=auth_identity.user_id)
        serial_user = user_service.serialize_user(user)

        # If the user is either currently *pending* invite acceptance (as indicated
        # from the invite token and member id in the session) OR an existing invite exists on this
        # organization for the email provided by the identity provider.
        invite_helper = ApiInviteHelper.from_session_or_email(
            request=request,
            organization=Organization.objects.get(id=organization.id),
            email=user.email,
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

        flags = ApiOrganizationMemberFlags(sso__linked=True)
        # if the org doesn't have the ability to add members then anyone who got added
        # this way should be disabled until the org upgrades
        if not features.has("organizations:invite-members", organization):
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
