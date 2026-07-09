import logging
from typing import Any

import sentry_sdk
from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BaseAuthentication
from rest_framework.request import Request

from sentry.api.authentication import AuthenticationSiloLimit
from sentry.silo.base import SiloMode
from sentry.users.services.user.service import user_service
from sentry.viewer_context import viewer_context_from_header

logger = logging.getLogger(__name__)


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.CELL)
class SeerRpcViewerContextAuthentication(BaseAuthentication):
    """
    Authentication for seer RPC requests via a signed ``X-Viewer-Context`` JWT.

    A co-equal alternative to :class:`SeerRpcSignatureAuthentication` (HMAC). The
    JWT is verified with ``SEER_API_SHARED_SECRET`` using the shared
    ``sentry.viewer_context`` verification logic — the same trust envelope the
    rest of the Sentry API already relies on.

    Unlike the REST ``ViewerContextAuthentication``, this accepts org-only
    contexts (no ``user_id``) — the common near-term case for RPC callers — and
    returns a truthy ``auth`` value so the endpoint's ``_is_authorized`` gate
    passes. The user is resolved opportunistically when a ``user_id`` is present.
    """

    def authenticate(self, request: Request) -> tuple[Any, Any] | None:
        header = request.META.get("HTTP_X_VIEWER_CONTEXT")
        if not header:
            # No viewer context: leave authentication to the HMAC authenticator.
            return None

        vc = viewer_context_from_header(header)
        if vc is None or vc.organization_id is None:
            # Reject a viewer context that is unverifiable OR carries no
            # organization: every seer RPC call acts on behalf of an org, so a
            # VC used for auth MUST name one. We fall through (do not raise) so a
            # valid HMAC on the same request can still win; otherwise the
            # endpoint denies via _is_authorized. This guarantees every
            # VC-authenticated call carries an attested org to enforce against.
            return None

        user: Any = AnonymousUser()
        if vc.user_id is not None:
            resolved = user_service.get_user(user_id=vc.user_id)
            if resolved is not None:
                user = resolved

        sentry_sdk.get_isolation_scope().set_tag("seer_rpc_viewer_context_auth", True)
        sentry_sdk.get_isolation_scope().set_attribute("seer_rpc_viewer_context_auth", True)

        # Stash the verified context so the org-binding guard reads the signed
        # value directly. (The middleware contextvar can drop organization_id when
        # it resolves the user and prefers the request context, so it is not a
        # reliable source for the binding check.)
        setattr(request, "_seer_rpc_viewer_context", vc)

        # Return the raw header as a truthy ``auth`` so ``_is_authorized`` passes,
        # mirroring the HMAC authenticator's (user, token) shape.
        return (user, header)
