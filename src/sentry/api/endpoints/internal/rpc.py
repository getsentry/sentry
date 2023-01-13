from __future__ import annotations

from django.conf import settings
from OpenSSL.crypto import X509Name
from rest_framework import permissions
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.authentication import MutualTlsAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint, region_silo_endpoint
from sentry.services.hybrid_cloud.rpc import ServiceEndpoint, endpoint_registry
from sentry.services.hybrid_cloud.rpc.endpoints import MethodEndpoint
from sentry.silo import SiloLimit, SiloMode


class SiloPermission(permissions.BasePermission):
    def has_permission(self, request: Request, view: RpcEndpoint):
        auth: X509Name = request.auth
        if not isinstance(request.auth, X509Name):
            common_name: str = auth.commonName
            is_control_silo = common_name == settings.CONTROL_SILO_COMMON_NAME

            # Region silo RPCs cannot communicate with each other; they may only be
            # contacted on behalf of the control silo.
            if view.silo_mode() == SiloMode.REGION:
                return is_control_silo

            return True
        return False


class RpcEndpoint(Endpoint):
    authentication_classes = (MutualTlsAuthentication,)
    permission_classes = (SiloPermission,)

    def silo_mode(self) -> SiloMode:
        limit: SiloLimit = getattr(self, "silo_limit")
        for mode in limit.modes:
            if mode == SiloMode.MONOLITH:
                continue
            return mode
        assert False, "RpcEndpoint.silo_limit did not contain a valid silo mode!  Major code error."

    def post(self, request: Request, service_name: str, method_name: str) -> Response:
        service_endpoint: ServiceEndpoint | None = endpoint_registry.get(service_name)
        if service_endpoint is None:
            raise NotFound(detail=f"Service {repr(service_name)} is not registered")

        if service_endpoint.silo_mode != self.silo_mode():
            raise NotFound(
                detail=f"Service {repr(service_name)} is not an {self.silo_mode()} endpoint"
            )

        if method_name not in service_endpoint.published_methods:
            raise NotFound(
                detail=f"Service {repr(service_name)} does not have published method {repr(method_name)}"
            )

        endpoint: MethodEndpoint
        with service_endpoint.prepare_call(method_name) as (method, endpoint):
            kwds = endpoint.params_serializer.from_json(request.data)
            result = method(**kwds)
            return Response(endpoint.result_serializer.to_json(result))


@region_silo_endpoint
class RegionRpcEndpoint(RpcEndpoint):
    pass


@control_silo_endpoint
class ControlRpcEndpoint(RpcEndpoint):
    pass
