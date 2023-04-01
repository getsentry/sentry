# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from enum import Enum
from typing import TYPE_CHECKING, Optional, Union

from sentry.models.actor import get_actor_id_for_user
from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.user import RpcUser

if TYPE_CHECKING:
    from sentry.models import Team, User


class ActorType(Enum):
    USER = "User"
    TEAM = "Team"


class RpcActor(RpcModel):
    """Can represent any model object with a foreign key to Actor."""

    id: int
    actor_id: Optional[int]
    actor_type: ActorType
    slug: Optional[str] = None
    is_superuser: bool = False

    def __post_init__(self) -> None:
        if (self.actor_type == ActorType.TEAM) == (self.slug is None):
            raise ValueError("Slugs are expected for teams only")

    def __hash__(self) -> int:
        return hash((self.id, self.actor_id, self.actor_type))

    @classmethod
    def from_object(cls, obj: Union["RpcActor", "User", "Team", "RpcUser"]) -> "RpcActor":
        from sentry.models import Team, User

        if isinstance(obj, cls):
            return obj
        if isinstance(obj, User):
            return cls.from_orm_user(obj)
        if isinstance(obj, Team):
            return cls.from_orm_team(obj)
        if isinstance(obj, RpcUser):
            return cls.from_rpc_user(obj)
        raise TypeError(f"Cannot build RpcActor from {type(obj)}")

    @classmethod
    def from_orm_user(cls, user: "User") -> "RpcActor":
        actor_id = get_actor_id_for_user(user)
        return cls(
            id=user.id,
            actor_id=actor_id,
            actor_type=ActorType.USER,
            is_superuser=user.is_superuser,
        )

    @classmethod
    def from_rpc_user(cls, user: RpcUser) -> "RpcActor":
        actor_id = get_actor_id_for_user(user)
        return cls(
            id=user.id,
            actor_id=actor_id,
            actor_type=ActorType.USER,
            is_superuser=user.is_superuser,
        )

    @classmethod
    def from_orm_team(cls, team: "Team") -> "RpcActor":
        return cls(id=team.id, actor_id=team.actor_id, actor_type=ActorType.TEAM, slug=team.slug)
