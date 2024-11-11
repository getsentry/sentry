from __future__ import annotations

import hashlib
import logging
from collections.abc import Callable, Iterable
from typing import Any, ClassVar

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.urls import resolve
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_str
from rest_framework.authentication import (
    BaseAuthentication,
    BasicAuthentication,
    SessionAuthentication,
    get_authorization_header,
)
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from sentry_relay.exceptions import UnpackError

from sentry import options
from sentry.auth.services.auth import AuthenticatedToken
from sentry.auth.system import SystemToken, is_internal_ip
from sentry.hybridcloud.models import ApiKeyReplica, ApiTokenReplica, OrgAuthTokenReplica
from sentry.hybridcloud.rpc.service import compare_signature
from sentry.models.apiapplication import ApiApplication
from sentry.models.apikey import ApiKey
from sentry.models.apitoken import ApiToken
from sentry.models.orgauthtoken import (
    OrgAuthToken,
    is_org_auth_token_auth,
    update_org_auth_token_last_used,
)
from sentry.models.projectkey import ProjectKey
from sentry.models.relay import Relay
from sentry.organizations.services.organization import organization_service
from sentry.relay.utils import get_header_relay_id, get_header_relay_signature
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.silo.base import SiloLimit, SiloMode
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.linksign import process_signature
from sentry.utils.sdk import Scope
from sentry.utils.security.orgauthtoken_token import SENTRY_ORG_AUTH_TOKEN_PREFIX, hash_token

logger = logging.getLogger("sentry.api.authentication")


class AuthenticationSiloLimit(SiloLimit):
    def handle_when_unavailable(
        self,
        original_method: Callable[..., Any],
        current_mode: SiloMode,
        available_modes: Iterable[SiloMode],
    ) -> Callable[..., Any]:
        def handle(obj: Any, *args: Any, **kwargs: Any) -> Any:
            mode_str = ", ".join(str(m) for m in available_modes)
            message = (
                f"{type(obj)} used for an endpoint in {current_mode} mode."
                f"This authenticator is available only in: {mode_str}"
            )
            raise self.AvailabilityError(message)

        return handle

    def __call__(self, decorated_obj: Any) -> Any:
        if isinstance(decorated_obj, type):
            if issubclass(decorated_obj, BaseAuthentication):
                constructor_override = self.create_override(decorated_obj.__init__)
                new_class = type(
                    decorated_obj.__name__,
                    (decorated_obj,),
                    {
                        "__init__": constructor_override,
                        "silo_limit": self,
                    },
                )
                new_class.__module__ = decorated_obj.__module__
                return new_class

        raise ValueError(
            "`@AuthenticationSiloLimit` can decorate only BaseAuthentication subclasses"
        )


def is_internal_relay(request, public_key):
    """
    Checks if the relay is trusted (authorized for all project configs)
    """

    # check legacy whitelisted public_key settings
    # (we can't check specific relays but we can check public keys)
    if settings.DEBUG or public_key in settings.SENTRY_RELAY_WHITELIST_PK:
        return True

    return is_internal_ip(request)


def is_static_relay(request):
    """
    Checks if the request comes from a statically configured relay

    Note: Only checks the relay_id (no public key validation is done).
    """
    relay_id = get_header_relay_id(request)
    static_relays = options.get("relay.static_auth")
    relay_info = static_relays.get(relay_id)
    return relay_info is not None


def relay_from_id(request: Request, relay_id: str) -> tuple[Relay | None, bool]:
    """
    Tries to find a Relay for a given id
    If the id is statically registered than no DB access will be done.
    If the id is not among the statically registered relays a lookup in the DB will be performed
    :return: A tuple (Relay,bool) containing the Relay model and a flag True for statically configured
    relays and False for Relays configured in the DB.
    """

    # first see if we have a statically configured relay and therefore we don't
    # need to go to the database for it
    static_relays = options.get("relay.static_auth")
    relay_info = static_relays.get(relay_id)

    if relay_info is not None:
        # we have a statically configured Relay
        relay = Relay(
            relay_id=relay_id,
            public_key=relay_info.get("public_key"),
            is_internal=relay_info.get("internal") is True,
        )
        return relay, True  # a statically configured Relay
    else:
        try:
            relay = Relay.objects.get(relay_id=relay_id)
            return relay, False  # a Relay from the database
        except Relay.DoesNotExist:
            return None, False  # no Relay found


def update_token_access_record(auth: object):
    """
    Perform updates to token models for security purposes (i.e. 'date_last_used')
    """
    if is_org_auth_token_auth(auth):
        update_org_auth_token_last_used(auth, [])


class QuietBasicAuthentication(BasicAuthentication):
    def authenticate_header(self, request: Request) -> str:
        return 'xBasic realm="%s"' % self.www_authenticate_realm

    def transform_auth(
        self,
        user: int | User | RpcUser | None | AnonymousUser,
        request_auth: Any,
        entity_id_tag: str | None = None,
        **tags,
    ) -> tuple[RpcUser | AnonymousUser, AuthenticatedToken | None]:
        if isinstance(user, int):
            user = user_service.get_user(user_id=user)
        elif isinstance(user, User):
            user = user_service.get_user(user_id=user.id)
        if user is None:
            user = AnonymousUser()

        auth_token = AuthenticatedToken.from_token(request_auth)
        if auth_token and entity_id_tag:
            scope = Scope.get_isolation_scope()
            scope.set_tag(entity_id_tag, auth_token.entity_id)
            for k, v in tags.items():
                scope.set_tag(k, v)

        return (user, auth_token)


class StandardAuthentication(QuietBasicAuthentication):
    token_name: ClassVar[bytes]

    def accepts_auth(self, auth: list[bytes]) -> bool:
        return bool(auth) and auth[0].lower() == self.token_name

    def authenticate_token(self, request: Request, token_str: str) -> tuple[Any, Any]:
        raise NotImplementedError

    def authenticate(self, request: Request):
        auth = get_authorization_header(request).split()

        if not self.accepts_auth(auth):
            return None

        if len(auth) == 1:
            msg = "Invalid token header. No credentials provided."
            raise AuthenticationFailed(msg)
        elif len(auth) > 2:
            msg = "Invalid token header. Token string should not contain spaces."
            raise AuthenticationFailed(msg)

        return self.authenticate_token(request, force_str(auth[1]))


@AuthenticationSiloLimit(SiloMode.REGION)
class RelayAuthentication(BasicAuthentication):
    def authenticate(self, request: Request):
        relay_id = get_header_relay_id(request)
        relay_sig = get_header_relay_signature(request)
        if not relay_id:
            raise AuthenticationFailed("Invalid relay ID")
        if not relay_sig:
            raise AuthenticationFailed("Missing relay signature")
        return self.authenticate_credentials(relay_id, relay_sig, request)

    def authenticate_credentials(
        self, relay_id: str, relay_sig: str, request=None
    ) -> tuple[AnonymousUser, None]:
        Scope.get_isolation_scope().set_tag("relay_id", relay_id)

        if request is None:
            raise AuthenticationFailed("missing request")

        relay, static = relay_from_id(request, relay_id)

        if relay is None:
            raise AuthenticationFailed("Unknown relay")

        if not static:
            relay.is_internal = is_internal_relay(request, relay.public_key)

        try:
            data = relay.public_key_object.unpack(request.body, relay_sig, max_age=60 * 5)
            request.relay = relay
            request.relay_request_data = data
        except UnpackError:
            raise AuthenticationFailed("Invalid relay signature")

        # TODO(mitsuhiko): can we return the relay here?  would be nice if we
        # could find some common interface for it
        return (AnonymousUser(), None)


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.REGION)
class ApiKeyAuthentication(QuietBasicAuthentication):
    token_name = b"basic"

    def accepts_auth(self, auth: list[bytes]) -> bool:
        return bool(auth) and auth[0].lower() == self.token_name

    def authenticate_credentials(self, userid, password, request=None):
        # We don't use request, but it needs to be passed through to DRF 3.7+.
        if password:
            return None

        key: ApiKeyReplica | ApiKey
        if SiloMode.get_current_mode() == SiloMode.REGION:
            key_replica = ApiKeyReplica.objects.filter(key=userid).last()
            if key_replica is None:
                raise AuthenticationFailed("API key is not valid")
            else:
                key = key_replica
        else:
            try:
                key = ApiKey.objects.get_from_cache(key=userid)
            except ApiKey.DoesNotExist:
                raise AuthenticationFailed("API key is not valid")

        if not key.is_active:
            raise AuthenticationFailed("Key is disabled")

        return self.transform_auth(None, key, "api_key")


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.REGION)
class SessionNoAuthTokenAuthentication(SessionAuthentication):
    def authenticate(self, request: Request):
        auth = get_authorization_header(request)
        if auth:
            return None
        return super().authenticate(request)


@AuthenticationSiloLimit(SiloMode.CONTROL)
class ClientIdSecretAuthentication(QuietBasicAuthentication):
    """
    Authenticates a Sentry Application using its Client ID and Secret

    This will be the method by which we identify which Sentry Application is
    making the request, for any requests not scoped to an installation.

    For example, the request to exchange a Grant Code for an Api Token.
    """

    def authenticate(self, request: Request):
        if not request.json_body:
            raise AuthenticationFailed("Invalid request")

        client_id = request.json_body.get("client_id")
        client_secret = request.json_body.get("client_secret")

        invalid_pair_error = AuthenticationFailed("Invalid Client ID / Secret pair")

        if not client_id or not client_secret:
            raise invalid_pair_error

        try:
            application = ApiApplication.objects.get(client_id=client_id)
        except ApiApplication.DoesNotExist:
            raise invalid_pair_error

        if not constant_time_compare(application.client_secret, client_secret):
            raise invalid_pair_error

        try:
            user_id = application.sentry_app.proxy_user_id
        except SentryApp.DoesNotExist:
            raise invalid_pair_error
        if user_id is None:
            raise invalid_pair_error
        return self.transform_auth(user_id, None)


@AuthenticationSiloLimit(SiloMode.REGION, SiloMode.CONTROL)
class UserAuthTokenAuthentication(StandardAuthentication):
    token_name = b"bearer"

    def _find_or_update_token_by_hash(self, token_str: str) -> ApiToken | ApiTokenReplica:
        """
        Find token by hash or update token's hash value if only found via plaintext.

        1. Hash provided plaintext token.
        2. Perform lookup based on hashed value.
        3. If found, return the token.
        4. If not found, search for the token based on its plaintext value.
        5. If found, update the token's hashed value and return the token.
        6. If not found via hash or plaintext value, raise AuthenticationFailed

        Returns `ApiTokenReplica` if running in REGION silo or
        `ApiToken` if running in CONTROL silo.
        """

        hashed_token = hashlib.sha256(token_str.encode()).hexdigest()

        if SiloMode.get_current_mode() == SiloMode.REGION:
            try:
                # Try to find the token by its hashed value first
                return ApiTokenReplica.objects.get(hashed_token=hashed_token)
            except ApiTokenReplica.DoesNotExist:
                try:
                    # If we can't find it by hash, use the plaintext string
                    return ApiTokenReplica.objects.get(token=token_str)
                except ApiTokenReplica.DoesNotExist:
                    # If the token does not exist by plaintext either, it is not a valid token
                    raise AuthenticationFailed("Invalid token")
        else:
            try:
                # Try to find the token by its hashed value first
                return ApiToken.objects.select_related("user", "application").get(
                    hashed_token=hashed_token
                )
            except ApiToken.DoesNotExist:
                try:
                    # If we can't find it by hash, use the plaintext string
                    api_token = ApiToken.objects.select_related("user", "application").get(
                        token=token_str
                    )
                except ApiToken.DoesNotExist:
                    # If the token does not exist by plaintext either, it is not a valid token
                    raise AuthenticationFailed("Invalid token")
                else:
                    # Update it with the hashed value if found by plaintext
                    api_token.hashed_token = hashed_token
                    api_token.save(update_fields=["hashed_token"])

                    return api_token

    def accepts_auth(self, auth: list[bytes]) -> bool:
        if not super().accepts_auth(auth):
            return False

        # Technically, this will not match if auth length is not 2
        # However, we want to run into `authenticate()` in this case, as this throws a more helpful error message
        if len(auth) != 2:
            return True

        token_str = force_str(auth[1])
        return not token_str.startswith(SENTRY_ORG_AUTH_TOKEN_PREFIX)

    def authenticate_token(self, request: Request, token_str: str) -> tuple[Any, Any]:
        user: AnonymousUser | User | RpcUser | None = AnonymousUser()

        token: SystemToken | ApiTokenReplica | ApiToken | None = SystemToken.from_request(
            request, token_str
        )

        application_is_inactive = False

        if not token:
            token = self._find_or_update_token_by_hash(token_str)
            if isinstance(token, ApiTokenReplica):  # we're running as a REGION silo
                user = user_service.get_user(user_id=token.user_id)
                application_is_inactive = not token.application_is_active
            else:  # the token returned is an ApiToken from the CONTROL silo
                user = token.user
                application_is_inactive = (
                    token.application is not None and not token.application.is_active
                )

        elif isinstance(token, SystemToken):
            user = token.user

        if not token:
            raise AuthenticationFailed("Invalid token")

        if token.is_expired():
            raise AuthenticationFailed("Token expired")

        if user and hasattr(user, "is_active") and not user.is_active:
            raise AuthenticationFailed("User inactive or deleted")

        if application_is_inactive:
            raise AuthenticationFailed("UserApplication inactive or deleted")

        if token.organization_id:
            # We need to make sure the organization to which the token has access is the same as the one in the URL
            organization = None
            organization_context = organization_service.get_organization_by_id(
                id=token.organization_id
            )
            if organization_context:
                organization = organization_context.organization

            if organization:
                resolved_url = resolve(request.path_info)
                target_org_id_or_slug = resolved_url.kwargs.get("organization_id_or_slug")
                if target_org_id_or_slug:
                    if (
                        organization.slug != target_org_id_or_slug
                        and organization.id != target_org_id_or_slug
                    ):
                        # TODO (@athena): We want to raise auth excecption here but to be sure
                        # I soft launch this by only logging the error for now
                        # raise AuthenticationFailed("Unauthorized organization access")
                        logger.info(
                            "Token has access to organization %s but wants to get access to organization %s",
                            organization.slug,
                            target_org_id_or_slug,
                        )
                else:
                    # TODO (@athena): We want to limit org level token's access to org level endpoints only
                    # so in the future this will be an auth exception but for now we soft launch by logging an error
                    logger.info(
                        "Token has only access to organization %s but is calling an endpoint for multiple organizations: %s",
                        organization.slug,
                        request.path_info,
                    )
            else:
                # TODO (@athena): If there is an organization token we should be able to fetch organization context
                # Otherwise we should raise an exception
                # For now adding logging to investigate if this is a valid case we need to address
                logger.info(
                    "Token has access to an unknown organization: %s", token.organization_id
                )

        return self.transform_auth(
            user,
            token,
            "api_token",
            api_token_type=self.token_name,
            api_token_is_sentry_app=getattr(user, "is_sentry_app", False),
        )


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.REGION)
class OrgAuthTokenAuthentication(StandardAuthentication):
    token_name = b"bearer"

    def accepts_auth(self, auth: list[bytes]) -> bool:
        if not super().accepts_auth(auth) or len(auth) != 2:
            return False

        token_str = force_str(auth[1])
        return token_str.startswith(SENTRY_ORG_AUTH_TOKEN_PREFIX)

    def authenticate_token(self, request: Request, token_str: str) -> tuple[Any, Any]:
        token_hashed = hash_token(token_str)

        token: OrgAuthTokenReplica | OrgAuthToken
        if SiloMode.get_current_mode() == SiloMode.REGION:
            try:
                token = OrgAuthTokenReplica.objects.get(
                    token_hashed=token_hashed,
                    date_deactivated__isnull=True,
                )
            except OrgAuthTokenReplica.DoesNotExist:
                raise AuthenticationFailed("Invalid org token")
        else:
            try:
                token = OrgAuthToken.objects.get(
                    token_hashed=token_hashed, date_deactivated__isnull=True
                )
            except OrgAuthToken.DoesNotExist:
                raise AuthenticationFailed("Invalid org token")

        return self.transform_auth(
            None,
            token,
            "api_token",
            api_token_type=self.token_name,
            api_token_is_org_token=True,
        )


@AuthenticationSiloLimit(SiloMode.REGION)
class DSNAuthentication(StandardAuthentication):
    token_name = b"dsn"

    def authenticate_token(self, request: Request, token: str) -> tuple[Any, Any]:
        try:
            key = ProjectKey.from_dsn(token)
        except ProjectKey.DoesNotExist:
            raise AuthenticationFailed("Invalid dsn")

        if not key.is_active:
            raise AuthenticationFailed("Invalid dsn")

        scope = Scope.get_isolation_scope()
        scope.set_tag("api_token_type", self.token_name)
        scope.set_tag("api_project_key", key.id)

        return (AnonymousUser(), key)


@AuthenticationSiloLimit(SiloMode.REGION)
class SignedRequestAuthentication(BaseAuthentication):
    def authenticate(self, request: Request) -> tuple[Any, Any]:
        user = process_signature(request)
        if not user:
            return (AnonymousUser(), None)

        setattr(request, "user_from_signed_request", True)
        return (user, None)


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.REGION)
class RpcSignatureAuthentication(StandardAuthentication):
    """
    Authentication for cross-region RPC requests.
    Requests are sent with an HMAC signed by a shared private key.
    """

    token_name = b"rpcsignature"

    def accepts_auth(self, auth: list[bytes]) -> bool:
        if not auth or len(auth) < 2:
            return False
        return auth[0].lower() == self.token_name

    def authenticate_token(self, request: Request, token: str) -> tuple[Any, Any]:
        if not compare_signature(request.path_info, request.body, token):
            raise AuthenticationFailed("Invalid signature")

        Scope.get_isolation_scope().set_tag("rpc_auth", True)

        return (AnonymousUser(), token)
