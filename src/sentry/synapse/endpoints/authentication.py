from __future__ import annotations

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from sentry.api.authentication import AuthenticationSiloLimit, HmacSignatureAuthentication
from sentry.silo.base import SiloMode


@AuthenticationSiloLimit(SiloMode.CONTROL)
class SynapseSignatureAuthentication(HmacSignatureAuthentication):
    """
    Authentication for Synapse RPC requests.
    Requests are sent with an HMAC signed by SYNAPSE_HMAC_SECRET.
    """

    token_name = b"signature"
    shared_secret_setting_name = "SYNAPSE_HMAC_SECRET"
    service_name = "Synapse"
    sdk_tag_name = "synapse_auth"
    signature_prefix = "synapse0"
    include_url_in_signature = True


class SynapseAuthPermission(BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        return bool(request.auth) and isinstance(
            request.successful_authenticator, SynapseSignatureAuthentication
        )
