from typing import Any, Dict

import pydantic
from rest_framework.exceptions import NotFound, ParseError, PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import capture_exception

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import RpcSignatureAuthentication
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.rpc import RpcResolutionException, dispatch_to_local_service
from sentry.services.hybrid_cloud.sig import SerializableFunctionValueException
from sentry.utils.env import in_test_environment


@all_silo_endpoint
class RpcServiceEndpoint(Endpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.HYBRID_CLOUD
    authentication_classes = (RpcSignatureAuthentication,)
    permission_classes = ()
    enforce_rate_limit = False

    def _is_authorized(self, request: Request) -> bool:
        if request.auth and isinstance(
            request.successful_authenticator, RpcSignatureAuthentication
        ):
            return True
        return False

    def post(self, request: Request, service_name: str, method_name: str) -> Response:
        if not self._is_authorized(request):
            raise PermissionDenied

        metadata = request.data.get("meta")  # noqa
        try:
            arguments: Dict[str, Any] = request.data["args"]
        except KeyError as e:
            raise ParseError from e
        if not isinstance(arguments, dict):
            raise ParseError

        auth_context: AuthenticationContext = AuthenticationContext()
        if auth_context_json := arguments.get("auth_context"):
            try:
                # Note -- generally, this is NOT set, but only in cases where an RPC needs to invoke code
                # that depends on the `env.request.user` object.  In that case, the authentication context
                # includes an authenticated user that will be injected into the global request context
                # for compatibility.  Notably, this authentication context is *trusted* as the request comes
                # from within the privileged RPC channel.
                auth_context = AuthenticationContext.parse_obj(auth_context_json)
            except pydantic.ValidationError as e:
                capture_exception()
                raise ParseError from e

        try:
            with auth_context.applied_to_request(request):
                result = dispatch_to_local_service(service_name, method_name, arguments)
        except RpcResolutionException as e:
            capture_exception()
            raise NotFound from e
        except SerializableFunctionValueException as e:
            capture_exception()
            raise ParseError from e
        except Exception as e:
            # Produce more detailed log
            if in_test_environment():
                raise Exception(
                    f"Problem processing rpc service endpoint {service_name}/{method_name}"
                ) from e
            capture_exception()
            raise ValidationError from e
        return Response(data=result)
