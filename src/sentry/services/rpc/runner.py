import logging
from concurrent import futures

import grpc
from django.conf import settings

if not settings.configured:
    from sentry.runner import configure

    configure()

from sentry.services.rpc.protobufs import Organization_pb2_grpc, User_pb2_grpc
from sentry.services.rpc.servicers.OrganizationServicer import OrganizationServicer
from sentry.services.rpc.servicers.UserServicer import UserServicer
from sentry.silo import SiloMode

logger = logging.getLogger(__name__)


def add_servicers(server):
    if SiloMode.get_current_mode() == SiloMode.CONTROL:
        User_pb2_grpc.add_UserServiceServicer_to_server(UserServicer(), server)
        logger.info("Added User servicer to RPC")
    if SiloMode.get_current_mode() == SiloMode.REGION:
        Organization_pb2_grpc.add_OrganizationServiceServicer_to_server(
            OrganizationServicer(), server
        )
        logger.info("Added Organization servicer to RPC")


def get_server_address(silo_mode: SiloMode) -> str:
    port = (
        settings.SENTRY_RPC_CONTROL_PORT
        if silo_mode == SiloMode.CONTROL
        else settings.SENTRY_RPC_REGION_PORT
    )
    return f"[::]:{port}"


def create_server():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    add_servicers(server)
    port_address = get_server_address(SiloMode.get_current_mode())
    server.add_insecure_port(port_address)
    return server


def start_server(server=None):
    if server is None:
        server = create_server()
    logger.info("Starting RPC Server...")
    server.start()
    server.wait_for_termination()
