from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_text
from rest_framework.authentication import BasicAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from sentry_relay import UnpackError

from sentry import options
from sentry.auth.system import SystemToken, is_internal_ip
from sentry.models import ApiApplication, ApiKey, ApiToken, ProjectKey, Relay
from sentry.relay.utils import get_header_relay_id, get_header_relay_signature
from sentry.utils.sdk import configure_scope


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


def relay_from_id(request, relay_id):
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
            relay.is_internal = is_internal_relay(request, relay.public_key)
            return relay, False  # a Relay from the database
        except Relay.DoesNotExist:
            return None, False  # no Relay found


class QuietBasicAuthentication(BasicAuthentication):
    def authenticate_header(self, request):
        return 'xBasic realm="%s"' % self.www_authenticate_realm


class StandardAuthentication(QuietBasicAuthentication):
    token_name = None

    def authenticate(self, request):
        auth = get_authorization_header(request).split()

        if not auth or auth[0].lower() != self.token_name:
            return None

        if len(auth) == 1:
            msg = "Invalid token header. No credentials provided."
            raise AuthenticationFailed(msg)
        elif len(auth) > 2:
            msg = "Invalid token header. Token string should not contain spaces."
            raise AuthenticationFailed(msg)

        return self.authenticate_credentials(request, force_text(auth[1]))


class RelayAuthentication(BasicAuthentication):
    def authenticate(self, request):
        relay_id = get_header_relay_id(request)
        relay_sig = get_header_relay_signature(request)
        if not relay_id:
            raise AuthenticationFailed("Invalid relay ID")
        if not relay_sig:
            raise AuthenticationFailed("Missing relay signature")
        return self.authenticate_credentials(relay_id, relay_sig, request)

    def authenticate_credentials(self, relay_id, relay_sig, request):
        with configure_scope() as scope:
            scope.set_tag("relay_id", relay_id)

        relay, static = relay_from_id(request, relay_id)

        if relay is None:
            raise AuthenticationFailed("Unknown relay")

        try:
            data = relay.public_key_object.unpack(request.body, relay_sig, max_age=60 * 5)
            request.relay = relay
            request.relay_request_data = data
        except UnpackError:
            raise AuthenticationFailed("Invalid relay signature")

        # TODO(mitsuhiko): can we return the relay here?  would be nice if we
        # could find some common interface for it
        return (AnonymousUser(), None)


class ApiKeyAuthentication(QuietBasicAuthentication):
    def authenticate_credentials(self, userid, password, request=None):
        # We don't use request, but it needs to be passed through to DRF 3.7+.
        if password:
            return None

        try:
            key = ApiKey.objects.get_from_cache(key=userid)
        except ApiKey.DoesNotExist:
            raise AuthenticationFailed("API key is not valid")

        if not key.is_active:
            raise AuthenticationFailed("Key is disabled")

        with configure_scope() as scope:
            scope.set_tag("api_key", key.id)

        return (AnonymousUser(), key)


class ClientIdSecretAuthentication(QuietBasicAuthentication):
    """
    Authenticates a Sentry Application using its Client ID and Secret

    This will be the method by which we identify which Sentry Application is
    making the request, for any requests not scoped to an installation.

    For example, the request to exchange a Grant Code for an Api Token.
    """

    def authenticate(self, request):
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
            return (application.sentry_app.proxy_user, None)
        except Exception:
            raise invalid_pair_error


class TokenAuthentication(StandardAuthentication):
    token_name = b"bearer"

    def authenticate_credentials(self, request, token_str):
        token = SystemToken.from_request(request, token_str)
        try:
            token = (
                token
                or ApiToken.objects.filter(token=token_str)
                .select_related("user", "application")
                .get()
            )
        except ApiToken.DoesNotExist:
            raise AuthenticationFailed("Invalid token")

        if token.is_expired():
            raise AuthenticationFailed("Token expired")

        if not token.user.is_active:
            raise AuthenticationFailed("User inactive or deleted")

        if token.application and not token.application.is_active:
            raise AuthenticationFailed("UserApplication inactive or deleted")

        with configure_scope() as scope:
            scope.set_tag("api_token_type", self.token_name)
            scope.set_tag("api_token", token.id)
            scope.set_tag("api_token_is_sentry_app", getattr(token.user, "is_sentry_app", False))

        return (token.user, token)


class DSNAuthentication(StandardAuthentication):
    token_name = b"dsn"

    def authenticate_credentials(self, request, token):
        try:
            key = ProjectKey.from_dsn(token)
        except ProjectKey.DoesNotExist:
            raise AuthenticationFailed("Invalid dsn")

        if not key.is_active:
            raise AuthenticationFailed("Invalid dsn")

        with configure_scope() as scope:
            scope.set_tag("api_token_type", self.token_name)
            scope.set_tag("api_project_key", key.id)

        return (AnonymousUser(), key)
