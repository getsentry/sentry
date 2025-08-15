from sentry.api.authentication import AuthenticationSiloLimit, ServiceRpcSignatureAuthentication
from sentry.silo.base import SiloMode

LAUNCHPAD_RPC_SHARED_SECRET_SETTING = "LAUNCHPAD_RPC_SHARED_SECRET"


@AuthenticationSiloLimit(SiloMode.REGION)
class LaunchpadRpcSignatureAuthentication(ServiceRpcSignatureAuthentication):
    """
    Authentication for Launchpad RPC requests.
    Requests are sent with an HMAC signed by a shared private key.
    """

    shared_secret_setting_name = LAUNCHPAD_RPC_SHARED_SECRET_SETTING
    service_name = "Launchpad"
    sdk_tag_name = "launchpad_rpc_auth"
