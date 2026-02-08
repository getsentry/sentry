import hashlib
import hmac
import logging
from collections.abc import Callable
from typing import Any

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotFound,
    ParseError,
    PermissionDenied,
    ValidationError,
)
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, internal_region_silo_endpoint
from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException
from sentry.scm.actions import SourceCodeManager
from sentry.silo.base import SiloMode

logger = logging.getLogger(__name__)


def generate_request_signature(url_path: str, body: bytes) -> str:
    """
    Generate a signature for the request body
    with the first shared secret. If there are other
    shared secrets in the list they are only to be used
    for verification during key rotation.
    """
    if not settings.SCM_RPC_SHARED_SECRET:
        raise RpcAuthenticationSetupException(
            "Cannot sign RPC requests without SCM_RPC_SHARED_SECRET"
        )

    signature_input = body
    secret = settings.SCM_RPC_SHARED_SECRET[0]
    signature = hmac.new(secret.encode("utf-8"), signature_input, hashlib.sha256).hexdigest()
    return f"rpc0:{signature}"


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.REGION)
class ScmRpcSignatureAuthentication(StandardAuthentication):
    """
    Authentication for SCM RPC requests.
    Requests are sent with an HMAC signed by a shared private key.
    """

    token_name = b"rpcsignature"

    def accepts_auth(self, auth: list[bytes]) -> bool:
        if not auth or len(auth) < 2:
            return False
        return auth[0].lower() == self.token_name

    def authenticate_token(self, request: Request, token: str) -> tuple[Any, Any]:
        signature_validation_error = get_signature_validation_error(
            request.path_info, request.body, token
        )
        if signature_validation_error:
            raise AuthenticationFailed(
                f"SCM RPC signature validation failed: {signature_validation_error}"
            )

        sentry_sdk.get_isolation_scope().set_tag("scm_rpc_auth", True)

        return (AnonymousUser(), token)


def get_signature_validation_error(url: str, body: bytes, signature: str) -> str | None:
    """
    Compare request data + signature signed by one of the shared secrets.

    Once a key has been able to validate the signature other keys will
    not be attempted. We should only have multiple keys during key rotations.
    """
    if not settings.SCM_RPC_SHARED_SECRET:
        raise RpcAuthenticationSetupException(
            "Cannot validate RPC request signatures without SCM_RPC_SHARED_SECRET"
        )

    signature_parts = signature.split(":", 1)
    if len(signature_parts) != 2:
        return "invalid signature format"

    signature_prefix, signature_data = signature_parts

    if signature_prefix != "rpc0":
        return "invalid signature prefix"

    if not body:
        return "no body"

    for key in settings.SCM_RPC_SHARED_SECRET:
        computed = hmac.new(key.encode(), body, hashlib.sha256).hexdigest()
        is_valid = hmac.compare_digest(computed.encode(), signature_data.encode())
        if is_valid:
            return None

    return "wrong secret"


@internal_region_silo_endpoint
class ScmRpcServiceEndpoint(Endpoint):
    """
    RPC endpoint for SCM interactions. Authenticated with a shared secret.
    Copied from the normal rpc endpoint and modified for use with SCM.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    # @todo Set owner (Vincent needs guidance from Colton)
    authentication_classes = (ScmRpcSignatureAuthentication,)
    permission_classes = ()
    enforce_rate_limit = False

    @staticmethod
    @sentry_sdk.trace
    def _is_authorized(request: Request) -> bool:
        if request.auth and isinstance(
            request.successful_authenticator, ScmRpcSignatureAuthentication
        ):
            return True
        return False

    @staticmethod
    @sentry_sdk.trace
    def _dispatch_to_source_code_manager(method_name: str, arguments: dict[str, Any]) -> Any:
        method = scm_method_registry.get(method_name)
        if method is None:
            raise NotFound(f"Unknown RPC method {method_name!r}")

        organization_id = arguments.pop("organization_id", None)
        if not isinstance(organization_id, int):
            raise ValidationError("Argument 'organization_id' must be an integer")

        repository_id = arguments.pop("repository_id", None)
        if isinstance(repository_id, dict) and len(repository_id) == 2:
            repository_id = (repository_id.get("provider"), repository_id.get("external_id"))
            repository_id_type_is_correct = isinstance(repository_id[0], str) and isinstance(
                repository_id[1], str
            )
        else:
            repository_id_type_is_correct = isinstance(repository_id, int)
        if not repository_id_type_is_correct:
            raise ValidationError(
                'Argument \'repository_id\' must be an integer or a dict {"provider": string, "external_id": string}'
            )

        scm = SourceCodeManager.make_from_repository_id(organization_id, repository_id)

        try:
            return method(scm, **arguments)
        except TypeError as e:
            raise ValidationError(f"Error calling method {method_name}: {str(e)}") from e
        except ObjectDoesNotExist as e:
            raise NotFound(
                f"Repository not found for organization_id={organization_id} and repository_id={repository_id}"
            ) from e

    @sentry_sdk.trace
    def post(self, request: Request, method_name: str) -> Response:
        sentry_sdk.set_tag("rpc.method", method_name)

        if not self._is_authorized(request):
            raise PermissionDenied()

        if not isinstance(request.data, dict):
            raise ParseError("Request body must be a JSON object")
        try:
            arguments: dict[str, Any] = request.data["args"]
        except KeyError as e:
            raise ParseError("Missing 'args' in request body") from e
        if not isinstance(arguments, dict):
            raise ParseError("Argument 'args' must be a dictionary")

        try:
            result = self._dispatch_to_source_code_manager(method_name, arguments)
        except Exception:
            sentry_sdk.capture_exception()
            raise
        else:
            return Response(data=result)


scm_method_registry: dict[str, Callable] = {
    # These callables must accept a SourceCodeManager as their first argument,
    # and then they are free to accept any other **kwargs they want.
    # Their return type must be JSON-serializable.
    #
    # This dict could be populated dynamically by scanning the SourceCodeManager class for methods.
    # Explicit listing give us more control: we can rename methods,
    # delay exposing them as RPC, adapt their interface, etc.
    #
    # If a method of SourceCodeManager accepts only JSON-serializable arguments, by names, and
    # returns a JSON-serializable type, then it can be listed here directly.
    # Else, an adapter function must be used.
    "get_issue_comments": SourceCodeManager.get_issue_comments,
    "create_issue_comment": SourceCodeManager.create_issue_comment,
    "delete_issue_comment": SourceCodeManager.delete_issue_comment,
    "get_pull_request": SourceCodeManager.get_pull_request,
    "get_pull_request_comments": SourceCodeManager.get_pull_request_comments,
    "create_pull_request_comment": SourceCodeManager.create_pull_request_comment,
    "delete_pull_request_comment": SourceCodeManager.delete_pull_request_comment,
    "get_comment_reactions": SourceCodeManager.get_comment_reactions,
    "create_comment_reaction": SourceCodeManager.create_comment_reaction,
    "delete_comment_reaction": SourceCodeManager.delete_comment_reaction,
    "get_issue_reactions": SourceCodeManager.get_issue_reactions,
    "create_issue_reaction": SourceCodeManager.create_issue_reaction,
    "delete_issue_reaction": SourceCodeManager.delete_issue_reaction,
}
