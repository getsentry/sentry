import grpc
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.services.rpc.protobufs import Organization_pb2_grpc, User_pb2, User_pb2_grpc
from sentry.silo import SiloMode


class InternalStatsEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request: Request) -> Response:
        current_silo = SiloMode.get_current_mode()
        data = {"silo": current_silo.value}

        if current_silo == SiloMode.CONTROL:
            with grpc.insecure_channel("localhost:50052") as channel:
                stub = Organization_pb2_grpc.OrganizationServiceStub(channel=channel)
                # Both Org + User protos share this request type
                req = User_pb2.ChangeNameRequest(item_id=1, name="not-testing")
                response = stub.ChangeName(req)
                print(response)
                print("🔥🔥🔥")

        if current_silo == SiloMode.REGION:
            with grpc.insecure_channel("localhost:50051") as channel:
                stub = User_pb2_grpc.UserServiceStub(channel=channel)
                req = User_pb2.ChangeNameRequest(item_id=1, name="not-testing")
                response = stub.ChangeName(req)
                print(response)
                print("😍😍😍😍")

        if current_silo == SiloMode.MONOLITH:
            pass

        return Response(data)
