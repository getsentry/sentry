from sentry.viewer_context import ActorId, ActorType

CREATOR_ACTOR_CHOICES = (
    (ActorType.USER.value, "User"),
    (ActorType.SERVICE_ACCOUNT.value, "Service account"),
)
COMMAND_ACTOR_CHOICES = (*CREATOR_ACTOR_CHOICES, (ActorType.SYSTEM.value, "System"))


def parse_actor_reference(
    actor_type: str | None, actor_id: int | None, *, allow_system: bool
) -> ActorId | None:
    """Read identity only: this neither resolves an actor nor grants access."""
    if actor_type is None and actor_id is None:
        return None
    if actor_type is None:
        raise ValueError("Actor kind is required when an ID is present")

    kind = ActorType(actor_type)
    if kind == ActorType.SYSTEM and allow_system:
        if actor_id is not None:
            raise ValueError("System actors cannot have an entity ID")
        return ActorId(kind, None)

    if kind not in (ActorType.USER, ActorType.SERVICE_ACCOUNT):
        raise ValueError("Unsupported investigation actor kind")
    if type(actor_id) is not int or actor_id <= 0:
        raise ValueError("Actor ID must be a positive integer")
    return ActorId(kind, actor_id)
