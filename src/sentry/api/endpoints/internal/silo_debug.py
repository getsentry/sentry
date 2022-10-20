from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.silo.base import SiloMode
from sentry.silo.client import RegionSiloClient


class InternalSiloDebugEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request: Request) -> Response:
        current_silo = SiloMode.get_current_mode()
        data = {"silo": current_silo.value}

        if current_silo == SiloMode.CONTROL:
            region_client = RegionSiloClient("region")
            response = region_client.req("/internal/silo-debug/")
            data["fetched"] = response.data

        if current_silo == SiloMode.REGION:
            pass

        if current_silo == SiloMode.MONOLITH:
            pass

        return Response(data)
