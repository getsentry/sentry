"""Sentry SCM gRPC-Web client library."""

# Version matches main Sentry version
__version__ = "25.12.0"  # Update this to match current Sentry version

from .client import grpc_channel
from .scm_pb2 import *  # noqa: F403, F401
from .scm_pb2_grpc import *  # noqa: F403, F401

__all__ = [
    "grpc_channel",
]
