import grpc
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.services.rpc.protobufs import Organization_pb2_grpc, User_pb2, User_pb2_grpc
from sentry.services.rpc.runner import get_server_address
from sentry.services.rpc.servicers.OrganizationServicer import OrganizationModelInterface
from sentry.services.rpc.servicers.UserServicer import UserModelInterface
from sentry.silo import SiloMode


class InternalSiloDebugEndpoint(Endpoint):
    permission_classes = ()

    def post(self, request: Request, model_name: str) -> Response:
        data = request.data
        current_silo = SiloMode.get_current_mode()
        response_data = {"request_data": data, "current_silo": current_silo.value}

        if model_name == "user":
            # Region Silo does not have direct access to User Model...
            if current_silo == SiloMode.REGION:
                with grpc.insecure_channel(get_server_address(SiloMode.CONTROL)) as channel:
                    stub = User_pb2_grpc.UserServiceStub(channel=channel)
                    request = User_pb2.ChangeNameRequest(item_id=data["id"], name=data["name"])
                    org_proto = stub.ChangeName(request)
                    response_data["rpc_response"] = {"id": org_proto.id, "name": org_proto.name}

            # Control Silo has access to User Model...
            if current_silo == SiloMode.CONTROL:
                UserModelInterface.change_name(data["id"], data["name"])

        if model_name == "organization":
            # Control Silo does not have direct access to Organization Model...
            if current_silo == SiloMode.CONTROL:
                with grpc.insecure_channel(get_server_address(SiloMode.REGION)) as channel:
                    stub = Organization_pb2_grpc.OrganizationServiceStub(channel=channel)
                    # Both Org + User protos share this request type
                    request = User_pb2.ChangeNameRequest(item_id=data["id"], name=data["name"])
                    user_proto = stub.ChangeName(request)
                    response_data["rpc_response"] = {"id": user_proto.id, "name": user_proto.name}

            # Region Silo has access to Organization Model...
            if current_silo == SiloMode.REGION:
                OrganizationModelInterface.change_name(data["id"], data["name"])

        return Response(response_data)
