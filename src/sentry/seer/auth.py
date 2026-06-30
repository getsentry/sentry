import hashlib
import hmac
import logging
from typing import Any

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException
from sentry.silo.base import SiloMode
from sentry.users.services.user.service import user_service
from sentry.viewer_context import viewer_context_from_header

logger = logging.getLogger(__name__)


def compare_signature(url: str, body: bytes, signature: str) -> bool:
    """
    Compare request data + signature signed by one of the shared secrets.

    Once a key has been able to validate the signature other keys will
    not be attempted. We should only have multiple keys during key rotations.

    DEPRECATED: part of the HMAC RPC auth mechanism being retired in favor of
    signed ``X-Viewer-Context`` (see ``SeerRpcSignatureAuthentication``).
    """
    if not settings.SEER_RPC_SHARED_SECRET:
        raise RpcAuthenticationSetupException(
            "Cannot validate RPC request signatures without SEER_RPC_SHARED_SECRET"
        )

    if not signature.startswith("rpc0:"):
        logger.error("Seer RPC signature validation failed: invalid signature prefix")
        return False

    if not body:
        logger.error("Seer RPC signature validation failed: no body")
        return False

    try:
        # We aren't using the version bits currently.
        _, signature_data = signature.split(":", 2)

        signature_input = body

        for key in settings.SEER_RPC_SHARED_SECRET:
            computed = hmac.new(key.encode(), signature_input, hashlib.sha256).hexdigest()
            is_valid = hmac.compare_digest(computed.encode(), signature_data.encode())
            if is_valid:
                return True
    except Exception:
        logger.exception("Seer RPC signature validation failed")
        return False

    logger.error("Seer RPC signature validation failed")

    return False


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.CELL)
class SeerRpcSignatureAuthentication(StandardAuthentication):
    """
    Authentication for seer RPC requests.
    Requests are sent with an HMAC signed by a shared private key.

    DEPRECATED: this HMAC mechanism (backed by ``SEER_RPC_SHARED_SECRET``) is
    slated for removal. Seer<->Sentry auth is consolidating onto the signed
    ``X-Viewer-Context`` header (see ``SeerRpcViewerContextAuthentication``).
    Removal order: (1) this endpoint accepts viewer context [done],
    (2) Seer stops sending ``Rpcsignature``, (3) delete this class +
    ``compare_signature``, (4) retire ``SEER_RPC_SHARED_SECRET`` (only after
    step 2 --- an inbound signature with the secret unset raises).
    """

    token_name = b"rpcsignature"

    def accepts_auth(self, auth: list[bytes]) -> bool:
        if not auth or len(auth) < 2:
            return False
        return auth[0].lower() == self.token_name

    def authenticate_token(self, request: Request, token: str) -> tuple[Any, Any]:
        if not compare_signature(request.path_info, request.body, token):
            raise AuthenticationFailed("Invalid signature")

        sentry_sdk.get_isolation_scope().set_tag("seer_rpc_auth", True)

        return (AnonymousUser(), token)


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.CELL)
class SeerRpcViewerContextAuthentication(BaseAuthentication):
    """
    Authentication for seer RPC requests via a signed ``X-Viewer-Context`` JWT.

    A co-equal alternative to :class:`SeerRpcSignatureAuthentication` (HMAC). The
    JWT is verified with ``SEER_API_SHARED_SECRET`` using the shared
    ``sentry.viewer_context`` verification logic --- the same trust envelope the
    rest of the Sentry API already relies on.

    Unlike the REST ``ViewerContextAuthentication``, this accepts org-only
    contexts (no ``user_id``) --- the common near-term case for RPC callers ---
    and returns a truthy ``auth`` value so the endpoint's ``_is_authorized``
    gate passes. The user is resolved opportunistically when a ``user_id`` is
    present.
    """

    def authenticate(self, request: Request) -> tuple[Any, Any] | None:
        header = request.META.get("HTTP_X_VIEWER_CONTEXT")
        if not header:
            return None

        vc = viewer_context_from_header(header)
        if vc is None or vc.organization_id is None:
            return None

        user: Any = AnonymousUser()
        if vc.user_id is not None:
            resolved = user_service.get_user(user_id=vc.user_id)
            if resolved is not None:
                user = resolved

        sentry_sdk.get_isolation_scope().set_tag("seer_rpc_viewer_context_auth", True)

        setattr(request, "_seer_rpc_viewer_context", vc)

        return (user, header)
