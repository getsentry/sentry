import hashlib
import hmac
import logging
from typing import Any

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import AuthenticationFailed, NotFound, ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException, RpcResolutionException
from sentry.hybridcloud.rpc.sig import SerializableFunctionValueException
from sentry.silo.base import SiloMode
from sentry.utils.env import in_test_environment

logger = logging.getLogger(__name__)


def compare_signature(url: str, body: bytes, signature: str) -> bool:
    """
    Compare request data + signature signed by one of the shared secrets.

    Once a key has been able to validate the signature other keys will
    not be attempted. We should only have multiple keys during key rotations.
    """
    if not settings.OVERWATCH_RPC_SHARED_SECRET:
        raise RpcAuthenticationSetupException(
            "Cannot validate RPC request signatures without OVERWATCH_RPC_SHARED_SECRET"
        )

    if not signature.startswith("rpcAuth:"):
        logger.error("Overwatch RPC signature validation failed: invalid signature prefix")
        return False

    if not body:
        logger.error("Overwatch RPC signature validation failed: no body")
        return False

    try:
        _, signature_data = signature.split(":", 2)

        signature_input = body

        for key in settings.OVERWATCH_RPC_SHARED_SECRET:
            computed = hmac.new(key.encode(), signature_input, hashlib.sha256).hexdigest()
            is_valid = hmac.compare_digest(computed.encode(), signature_data.encode())
            if is_valid:
                return True
    except Exception:
        logger.exception("Overwatch RPC signature validation failed")
        return False

    logger.error("Overwatch RPC signature validation failed")
    return False


def get_config_for_org(*, org_name: str) -> dict[str, Any]:
    """
    Get configuration for an organization stored on Sentry's side.

    TODO: This is a stub implementation that returns an empty dict.
    The actual config storage and retrieval logic will be implemented once config storage is implemented.

    Args:
        org_name: The name/slug of the organization

    Returns:
        dict: Organization configuration (empty dict for now - not yet implemented)
    """
    logger.info("Getting config for organization '%s' (stub implementation)", org_name)

    return {}


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.REGION)
class OverwatchRpcSignatureAuthentication(StandardAuthentication):
    """
    Authentication for Overwatch RPC requests.
    Requests are sent with an HMAC signed by a shared private key.
    """

    token_name = b"rpcauth"

    def accepts_auth(self, auth: list[bytes]) -> bool:
        if not auth or len(auth) < 2:
            return False
        return auth[0].lower() == self.token_name

    def authenticate_token(self, request: Request, token: str) -> tuple[Any, Any]:
        if not compare_signature(request.path_info, request.body, token):
            raise AuthenticationFailed("Invalid signature")

        sentry_sdk.get_isolation_scope().set_tag("overwatch_rpc_auth", True)

        return (AnonymousUser(), token)


@region_silo_endpoint
class OverwatchRpcServiceEndpoint(Endpoint):
    """
    RPC endpoint for Overwatch microservice to call. Authenticated with a shared secret.
    Overwatch will leverage this endpoint to recieve Sentry organization information.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CODECOV
    authentication_classes = (OverwatchRpcSignatureAuthentication,)
    permission_classes = ()
    enforce_rate_limit = False

    def _is_authorized(self, request: Request) -> bool:
        if request.auth and isinstance(
            request.successful_authenticator, OverwatchRpcSignatureAuthentication
        ):
            return True
        return False

    def _dispatch_to_local_method(self, method_name: str, arguments: dict[str, Any]) -> Any:
        """
        Dispatch the request to the appropriate local method.

        Args:
            method_name: The name of the method to call
            arguments: The arguments to pass to the method

        Returns:
            The result of the method call

        Raises:
            RpcResolutionException: If the method is not found
        """
        if method_name not in overwatch_method_registry:
            raise RpcResolutionException(f"Unknown method {method_name}")

        method = overwatch_method_registry[method_name]
        return method(**arguments)

    def post(self, request: Request, method_name: str) -> Response:
        """
        Handle POST requests to call Overwatch RPC methods.

        Args:
            request: The Django request object
            method_name: The name of the method to call

        Returns:
            Response: The response from the method call
        """
        try:
            arguments: dict[str, Any] = request.data.get("args", {})
        except (KeyError, AttributeError):
            raise ParseError("Missing 'args' in request data")

        try:
            result = self._dispatch_to_local_method(method_name, arguments)
        except RpcResolutionException as e:
            logger.exception("RPC resolution error for method '%s'", method_name)
            raise NotFound from e
        except ObjectDoesNotExist as e:
            logger.exception("Object not found for method '%s'", method_name)
            raise NotFound from e
        except SerializableFunctionValueException as e:
            sentry_sdk.capture_exception()
            raise ParseError from e
        except Exception as e:
            if in_test_environment():
                raise
            if settings.DEBUG:
                raise Exception(f"Problem processing overwatch rpc endpoint {method_name}") from e
            logger.exception("Unexpected error in overwatch RPC method '%s'", method_name)
            raise ValidationError(f"Internal error processing {method_name}") from e

        return Response(data=result)


# Registry of available methods that can be called via the RPC endpoint
overwatch_method_registry: dict[str, Any] = {
    "get_config_for_org": get_config_for_org,
}
