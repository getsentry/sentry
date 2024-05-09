# Deprecated module for actor imports
# Use sentry.types.actor instead.
from sentry.types.actor import Actor, ActorTarget, ActorType, parse_and_validate_actor

RpcActor = Actor

__all__ = (
    "RpcActor",
    "ActorType",
    "ActorTarget",
    "parse_and_validate_actor",
)
