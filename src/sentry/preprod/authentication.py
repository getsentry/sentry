from __future__ import annotations

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from sentry.api.authentication import AuthenticationSiloLimit, HmacSignatureAuthentication
from sentry.silo.base import SiloMode

LAUNCHPAD_RPC_SHARED_SECRET_SETTING = "LAUNCHPAD_RPC_SHARED_SECRET"


@AuthenticationSiloLimit(SiloMode.REGION)
class LaunchpadRpcSignatureAuthentication(HmacSignatureAuthentication):
    """
    Authentication for Launchpad RPC requests.
    Requests are sent with an HMAC signed by a shared private key.
    """

    shared_secret_setting_name = LAUNCHPAD_RPC_SHARED_SECRET_SETTING
    service_name = "Launchpad"
    sdk_tag_name = "launchpad_rpc_auth"


class LaunchpadRpcPermission(BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        return bool(request.auth) and isinstance(
            request.successful_authenticator, LaunchpadRpcSignatureAuthentication
        )
