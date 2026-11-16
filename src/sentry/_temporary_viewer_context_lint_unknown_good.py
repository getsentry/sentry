"""Temporary synthetic fixture for decision-model lint."""

from sentry.viewer_context import Actor, ActorType, ViewerContext


def resolve_request_context(resolved_actor: Actor | None) -> ViewerContext:
    """Represent requests with no resolvable caller as UNKNOWN."""
    return ViewerContext(actor=resolved_actor or Actor(type=ActorType.UNKNOWN))
