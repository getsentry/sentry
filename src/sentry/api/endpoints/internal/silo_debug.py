import grpc
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.models import Organization, User
from sentry.services.rpc.protobufs import Organization_pb2_grpc, User_pb2, User_pb2_grpc
from sentry.services.rpc.runner import get_server_address
from sentry.silo import SiloMode


class InternalSiloDebugEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request: Request) -> Response:
        current_silo = SiloMode.get_current_mode()
        response_data = {"current_silo": current_silo.value}

        if current_silo == SiloMode.CONTROL:
            organization = Organization.objects.get(id=1)
            organization.name = "New Organization Name"
            organization.save()

        if current_silo == SiloMode.REGION:
            # This should fail
            user = User.objects.get(id=1)
            user.username = "New Username"
            user.save()

        if current_silo == SiloMode.MONOLITH:
            pass

        return Response(response_data)

    def post(self, request: Request) -> Response:
        data = request.data

        current_silo = SiloMode.get_current_mode()
        response_data = {"request_data": data, "current_silo": current_silo.value}

        if current_silo == SiloMode.CONTROL:
            with grpc.insecure_channel(get_server_address(SiloMode.REGION)) as channel:
                stub = Organization_pb2_grpc.OrganizationServiceStub(channel=channel)
                # Both Org + User protos share this request type
                request = User_pb2.ChangeNameRequest(item_id=data["id"], name=data["name"])
                user_proto = stub.ChangeName(request)
                response_data["rpc_response"] = {"id": user_proto.id, "name": user_proto.name}

        if current_silo == SiloMode.REGION:
            with grpc.insecure_channel(get_server_address(SiloMode.CONTROL)) as channel:
                stub = User_pb2_grpc.UserServiceStub(channel=channel)
                request = User_pb2.ChangeNameRequest(item_id=data["id"], name=data["name"])
                org_proto = stub.ChangeName(request)
                response_data["rpc_response"] = {"id": org_proto.id, "name": org_proto.name}

        if current_silo == SiloMode.MONOLITH:
            pass

        return Response(response_data)
