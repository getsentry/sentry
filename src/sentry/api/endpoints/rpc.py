from django.conf import settings
from rest_framework.exceptions import NotFound, ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.services.hybrid_cloud.rpc import (
    RpcArgumentException,
    RpcResolutionException,
    dispatch_to_local_service,
)


class RpcServiceEndpoint(Endpoint):  # type: ignore
    permission_classes = ()

    def _is_authorized(self, request: Request) -> bool:
        """Check whether the remote procedure call is authorized.

        We currently know that RPC authorization is going to look a bit different
        from any user-based auth. It will likely rely on a shared secret between
        silos or something like SSH keys. The authority to make arbitrary RPCs
        surpasses anything in our current system of permission scopes; it's basically
        "system access" only.

        As a placeholder, use a global system flag (to be set only in dev
        environments) that allows access for superusers, and disables it entirely
        otherwise.

        TODO: Real solution
        """
        return bool(settings.ALLOW_HYBRID_CLOUD_RPC)

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

        return Response(data=result)
