import os
from concurrent import futures

import grpc

from sentry.services.rpc.protobufs import Organization_pb2_grpc, User_pb2_grpc
from sentry.services.rpc.servicers.OrganizationServicer import OrganizationServicer
from sentry.services.rpc.servicers.UserServicer import UserServicer


def add_servicers(server):
    if os.environ.get("SENTRY_SILO_MODE", None) == "CONTROL":
        print("Adding User servicer...")
        User_pb2_grpc.add_UserServiceServicer_to_server(UserServicer(), server)
    if os.environ.get("SENTRY_SILO_MODE", None) == "REGION":
        print("Adding Organization servicer...")
        Organization_pb2_grpc.add_OrganizationServiceServicer_to_server(
            OrganizationServicer(), server
        )


def create_server(port):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    add_servicers(server)
    server.add_insecure_port(f"[::]:{port}")
    print(f"Starting Sentry RPC Server @ {port}...")
    server.start()
