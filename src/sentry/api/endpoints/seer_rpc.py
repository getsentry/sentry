import hashlib
import hmac
from datetime import datetime
from typing import Any, Dict, List, Tuple

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotFound,
    ParseError,
    PermissionDenied,
    ValidationError,
)
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import capture_exception, configure_scope

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.models.group import Group
from sentry.services.hybrid_cloud.rpc import RpcAuthenticationSetupException, RpcResolutionException
from sentry.services.hybrid_cloud.sig import SerializableFunctionValueException
from sentry.silo.base import SiloMode
from sentry.utils import json
from sentry.utils.env import in_test_environment


def compare_signature(url: str, body: bytes, signature: str) -> bool:
    """
    Compare request data + signature signed by one of the shared secrets.

    Once a key has been able to validate the signature other keys will
    not be attempted. We should only have multiple keys during key rotations.
    """
    if not settings.SEER_RPC_SHARED_SECRET:
        raise RpcAuthenticationSetupException(
            "Cannot validate RPC request signatures without SEER_RPC_SHARED_SECRET"
        )

    if not signature.startswith("rpc0:"):
        return False

    # We aren't using the version bits currently, but might use them in the future.
    body = json.dumps(json.loads(body.decode("utf8"))).encode("utf8")
    _, signature_data = signature.split(":", 2)
    signature_input = b"%s:%s" % (
        url.encode("utf8"),
        body,
    )

    for key in settings.SEER_RPC_SHARED_SECRET:
        computed = hmac.new(key.encode("utf-8"), signature_input, hashlib.sha256).hexdigest()
        is_valid = hmac.compare_digest(computed.encode("utf-8"), signature_data.encode("utf-8"))
        if is_valid:
            return True

    return False


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.REGION)
class SeerRpcSignatureAuthentication(StandardAuthentication):
    """
    Authentication for seer RPC requests.
    Requests are sent with an HMAC signed by a shared private key.
    """

    token_name = b"rpcsignature"

    def accepts_auth(self, auth: List[bytes]) -> bool:
        if not auth or len(auth) < 2:
            return False
        return auth[0].lower() == self.token_name

    def authenticate_token(self, request: Request, token: str) -> Tuple[Any, Any]:
        if not compare_signature(request.path_info, request.body, token):
            raise AuthenticationFailed("Invalid signature")

        with configure_scope() as scope:
            scope.set_tag("rpc_auth", True)

        return (AnonymousUser(), token)


@all_silo_endpoint
class SeerRpcServiceEndpoint(Endpoint):
    """
    RPC endpoint for seer microservice to call. Authenticated with a shared secret.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    authentication_classes = (SeerRpcSignatureAuthentication,)
    permission_classes = ()
    enforce_rate_limit = False

    def _is_authorized(self, request: Request) -> bool:
        if request.auth and isinstance(
            request.successful_authenticator, SeerRpcSignatureAuthentication
        ):
            return True
        return False

    def _dispatch_to_local_method(self, method_name: str, arguments: Dict[str, Any]) -> Any:
        if method_name not in seer_method_registry:
            raise RpcResolutionException(f"Unknown method {method_name}")
        method = seer_method_registry[method_name]
        return method(**arguments)

    def post(self, request: Request, method_name: str) -> Response:
        if not self._is_authorized(request):
            raise PermissionDenied

        try:
            arguments: Dict[str, Any] = request.data["args"]
        except KeyError as e:
            raise ParseError from e
        if not isinstance(arguments, dict):
            raise ParseError

        try:
            result = self._dispatch_to_local_method(method_name, arguments)
        except RpcResolutionException as e:
            capture_exception()
            raise NotFound from e
        except SerializableFunctionValueException as e:
            capture_exception()
            raise ParseError from e
        except Exception as e:
            # Produce more detailed log
            if settings.DEBUG:
                raise Exception(f"Problem processing seer rpc endpoint {method_name}") from e
            capture_exception()
            raise ValidationError from e
        return Response(data=result)


def autofix_callback(result: dict) -> bool:
    group: Group = Group.objects.get(id=result["issue_id"])

    metadata = group.data.get("metadata", {})
    autofix_data = metadata.get("autofix", {})
    if result["result"]:
        metadata["autofix"] = {
            **autofix_data,
            "completedAt": datetime.now().isoformat(),
            "status": "COMPLETED",
            "fix": convert_dict_key_case(result["result"], snake_to_camel_case),
        }
    else:
        metadata["autofix"] = {
            "completedAt": datetime.now().isoformat(),
            "status": "COMPLETED",
            "fix": None,
        }
    group.data["metadata"] = metadata

    group.save()

    return True


seer_method_registry = {
    "autofix_callback": autofix_callback,
}
