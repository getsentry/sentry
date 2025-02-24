import hashlib
import hmac
import logging
from collections.abc import Callable
from typing import Any

import orjson
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
from sentry_sdk import Scope, capture_exception

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException, RpcResolutionException
from sentry.hybridcloud.rpc.sig import SerializableFunctionValueException
from sentry.models.organization import Organization
from sentry.seer.fetch_issues_given_patches import get_issues_related_to_file_patches
from sentry.silo.base import SiloMode
from sentry.utils.env import in_test_environment

logger = logging.getLogger(__name__)


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

    # We aren't using the version bits currently.
    body = orjson.dumps(orjson.loads(body))
    _, signature_data = signature.split(":", 2)
    signature_input = b"%s:%s" % (
        url.encode(),
        body,
    )

    for key in settings.SEER_RPC_SHARED_SECRET:
        computed = hmac.new(key.encode(), signature_input, hashlib.sha256).hexdigest()
        is_valid = hmac.compare_digest(computed.encode(), signature_data.encode())
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

    def accepts_auth(self, auth: list[bytes]) -> bool:
        if not auth or len(auth) < 2:
            return False
        return auth[0].lower() == self.token_name

    def authenticate_token(self, request: Request, token: str) -> tuple[Any, Any]:
        if not compare_signature(request.path_info, request.body, token):
            raise AuthenticationFailed("Invalid signature")

        Scope.get_isolation_scope().set_tag("seer_rpc_auth", True)

        return (AnonymousUser(), token)


@region_silo_endpoint
class SeerRpcServiceEndpoint(Endpoint):
    """
    RPC endpoint for seer microservice to call. Authenticated with a shared secret.
    Copied from the normal rpc endpoint and modified for use with seer.
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

    def _dispatch_to_local_method(self, method_name: str, arguments: dict[str, Any]) -> Any:
        if method_name not in seer_method_registry:
            raise RpcResolutionException(f"Unknown method {method_name}")
        # As seer is a single service, we just directly expose the methods instead of services.
        method = seer_method_registry[method_name]
        return method(**arguments)

    def post(self, request: Request, method_name: str) -> Response:
        if not self._is_authorized(request):
            raise PermissionDenied

        try:
            arguments: dict[str, Any] = request.data["args"]
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
        except ObjectDoesNotExist as e:
            # Let this fall through, this is normal.
            capture_exception()
            raise NotFound from e
        except Exception as e:
            if in_test_environment():
                raise
            if settings.DEBUG:
                raise Exception(f"Problem processing seer rpc endpoint {method_name}") from e
            capture_exception()
            raise ValidationError from e
        return Response(data=result)


def get_organization_slug(*, org_id: int) -> dict:
    org: Organization = Organization.objects.get(id=org_id)
    return {"slug": org.slug}


def get_organization_autofix_consent(*, org_id: int) -> dict:
    org: Organization = Organization.objects.get(id=org_id)
    consent = org.get_option("sentry:gen_ai_consent_v2024_11_14", False)
    github_extension_enabled = org_id in options.get("github-extension.enabled-orgs")
    return {
        "consent": consent or github_extension_enabled,
    }


seer_method_registry: dict[str, Callable[..., dict[str, Any]]] = {
    "get_organization_slug": get_organization_slug,
    "get_organization_autofix_consent": get_organization_autofix_consent,
    "get_issues_related_to_file_patches": get_issues_related_to_file_patches,
}


def generate_request_signature(url_path: str, body: bytes) -> str:
    """
    Generate a signature for the request body
    with the first shared secret. If there are other
    shared secrets in the list they are only to be used
    for verfication during key rotation.
    """
    if not settings.SEER_RPC_SHARED_SECRET:
        raise RpcAuthenticationSetupException("Cannot sign RPC requests without RPC_SHARED_SECRET")

    signature_input = b"%s:%s" % (
        url_path.encode("utf8"),
        body,
    )
    secret = settings.SEER_RPC_SHARED_SECRET[0]
    signature = hmac.new(secret.encode("utf-8"), signature_input, hashlib.sha256).hexdigest()
    return f"rpc0:{signature}"
