from rest_framework.exceptions import NotFound, ParseError, PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.authentication import RpcSignatureAuthentication
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.services.hybrid_cloud.rpc import (
    RpcArgumentException,
    RpcResolutionException,
    dispatch_to_local_service,
)


@all_silo_endpoint
class RpcServiceEndpoint(Endpoint):
    authentication_classes = (RpcSignatureAuthentication,)
    permission_classes = ()

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
        arguments = request.data.get("args")

        try:
            result = dispatch_to_local_service(service_name, method_name, arguments)
        except RpcResolutionException as e:
            raise NotFound from e
        except RpcArgumentException as e:
            raise ParseError from e
        except Exception as e:
            raise ValidationError from e
        return Response(data=result)
