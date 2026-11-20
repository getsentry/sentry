DATA_VERSION = "1"

DISCOVERY_PATH = "/.well-known/openid-configuration"

SCOPE = "openid email profile"

# Asymmetric algorithms only. HS* would make the client secret the signing key, and
# "none" would skip signature checks entirely.
ALLOWED_SIGNING_ALGORITHMS = frozenset(
    {"RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512"}
)

# Preference order when the provider supports more than one.
SUPPORTED_TOKEN_ENDPOINT_AUTH_METHODS = ("client_secret_basic", "client_secret_post")

# Allowed clock skew, in seconds, when checking `exp` and `iat`.
ID_TOKEN_LEEWAY = 60

HTTP_TIMEOUT = 10

ERR_INVALID_RESPONSE = "Unable to verify your identity with the identity provider."
ERR_NOT_CONFIGURED = "This OpenID Connect provider is not configured."
ERR_EMAIL_NOT_VERIFIED = (
    "Your identity provider did not confirm that your email address is verified."
)
