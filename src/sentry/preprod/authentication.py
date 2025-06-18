from django.conf import settings

from sentry.api.authentication import (
    AuthenticationSiloLimit,
    ServiceRpcSignatureAuthentication,
    generate_service_request_signature,
)
from sentry.silo.base import SiloMode

LAUNCHPAD_RPC_SHARED_SECRET_SETTING = "LAUNCHPAD_RPC_SHARED_SECRET"


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.REGION)
class LaunchpadRpcSignatureAuthentication(ServiceRpcSignatureAuthentication):
    """
    Authentication for Launchpad RPC requests.
    Requests are sent with an HMAC signed by a shared private key.
    """

    shared_secret_setting_name = LAUNCHPAD_RPC_SHARED_SECRET_SETTING
    service_name = "Launchpad"
    sdk_tag_name = "launchpad_rpc_auth"


def generate_launchpad_request_signature(url_path: str, body: bytes) -> str:
    """
    Generate a signature for the request body
    with the first shared secret. If there are other
    shared secrets in the list they are only to be used
    for verification during key rotation.
    """
    return generate_service_request_signature(
        url_path, body, settings.LAUNCHPAD_RPC_SHARED_SECRET, "Launchpad"
    )
