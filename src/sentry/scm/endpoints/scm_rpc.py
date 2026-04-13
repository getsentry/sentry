import hashlib
import hmac
import logging
from typing import Any

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import (
    AuthenticationFailed,
    PermissionDenied,
)
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException
from sentry.scm.errors import (
    SCMCodedError,
    SCMError,
    SCMProviderException,
    SCMProviderNotSupported,
    SCMRpcActionCallError,
    SCMRpcActionNotFound,
    SCMRpcCouldNotDeserializeRequest,
    SCMUnhandledException,
)
from sentry.scm.private.rpc import dispatch
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


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.CELL)
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
                {
                    "errors": [
                        _make_error(
                            exception_type="AuthenticationFailure",
                            status_code=401,
                            title="SCM RPC signature validation failed.",
                            detail=signature_validation_error,
                        )
                    ]
                }
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


@internal_cell_silo_endpoint
class ScmRpcServiceEndpoint(Endpoint):
    """
    RPC endpoint for SCM interactions. Authenticated with a shared secret.
    Copied from the normal rpc endpoint and modified for use with SCM.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CODING_WORKFLOWS
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

    @sentry_sdk.trace
    def post(self, request: Request, method_name: str) -> Response:
        sentry_sdk.set_tag("rpc.method", method_name)

        if not self._is_authorized(request):
            raise PermissionDenied()

        try:
            result = dispatch(method_name, request.data)
        except SCMRpcActionNotFound as e:
            sentry_sdk.capture_exception()
            return _make_single_error_response(
                exception_type="SCMRpcActionNotFound",
                status_code=404,
                title="Not found",
                detail=f"Could not find action {e.action_name}",
                action_name=e.action_name,
            )
        except SCMRpcCouldNotDeserializeRequest as e:
            sentry_sdk.capture_exception()
            return _make_errors_response(
                status_code=400,
                errors=[
                    _make_error(
                        exception_type="SCMRpcCouldNotDeserializeRequest",
                        status_code=400,
                        title="The request could not be deserialized.",
                        meta=error,
                    )
                    for error in e.args[0]
                ],
            )
        except SCMRpcActionCallError as e:
            sentry_sdk.capture_exception()
            return _make_single_error_response(
                exception_type="SCMRpcActionCallError",
                status_code=500,
                title="An unexpected error occurred.",
                detail=e.message,
                action_name=e.action_name,
                message=e.message,
            )
        except SCMProviderNotSupported as e:
            sentry_sdk.capture_exception()
            return _make_single_error_response(
                exception_type="SCMProviderNotSupported",
                status_code=400,
                title="Provider not supported.",
                detail=e.message,
            )
        except SCMProviderException as e:
            sentry_sdk.capture_exception()
            return _make_single_error_response(
                exception_type="SCMProviderException",
                status_code=503,
                title="The service provider raised an error.",
                detail=_make_detail(e),
            )
        except SCMCodedError as e:
            sentry_sdk.capture_exception()
            return _make_single_error_response(
                exception_type="SCMCodedError",
                code=e.code,
                status_code=500,
                title="An error occurred.",
                detail=_make_detail(e),
            )
        except SCMUnhandledException as e:
            sentry_sdk.capture_exception()
            return _make_single_error_response(
                exception_type="SCMUnhandledException",
                status_code=500,
                title="An unexpected error occurred.",
                detail=_make_detail(e),
            )
        except SCMError as e:
            sentry_sdk.capture_exception()
            return _make_single_error_response(
                exception_type="SCMError",
                status_code=500,
                title="An unexpected error occurred.",
                detail=_make_detail(e),
            )
        except Exception:
            sentry_sdk.capture_exception()
            raise
        else:
            return Response(data={"data": result})


def _make_single_error_response(
    *,
    exception_type: str,
    status_code: int,
    title: str,
    detail: str,
    code: str | None = None,
    message: str | None = None,
    action_name: str | None = None,
) -> Response:
    return _make_errors_response(
        status_code=status_code,
        errors=[
            _make_error(
                status_code=status_code,
                title=title,
                detail=detail,
                exception_type=exception_type,
                code=code,
                message=message,
                action_name=action_name,
            )
        ],
    )


def _make_errors_response(*, status_code: int, errors: list[dict[str, Any]]) -> Response:
    return Response(data={"errors": errors}, status=status_code)


def _make_error(
    *,
    exception_type: str,
    status_code: int,
    title: str,
    detail: str | None = None,
    code: str | None = None,
    message: str | None = None,
    action_name: str | None = None,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {
        "status": str(status_code),
        "title": title,
    }
    if detail is not None:
        error["detail"] = detail
    if meta is None:
        meta = {}
    if exception_type is not None:
        meta["exception_type"] = exception_type
    if code is not None:
        meta["code"] = code
    if message is not None:
        meta["message"] = message
    if action_name is not None:
        meta["action_name"] = action_name
    if meta:
        error["meta"] = meta
    return error


def _make_detail(e: BaseException) -> str:
    details = list(e.args)
    while e.__cause__:
        e = e.__cause__
        details.extend(e.args)
    return ", ".join(str(detail) for detail in details)
