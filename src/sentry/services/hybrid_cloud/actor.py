# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from enum import Enum
from typing import TYPE_CHECKING, Any, Optional, Union

from sentry.models.actor import get_actor_id_for_user
from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.organization import RpcTeam
from sentry.services.hybrid_cloud.user import RpcUser

if TYPE_CHECKING:
    from sentry.models import Team, User


class ActorType(str, Enum):
    USER = "User"
    TEAM = "Team"


class RpcActor(RpcModel):
    """Can represent any model object with a foreign key to Actor."""

    id: int
    """The id of the user/team this actor represents"""

    actor_id: Optional[int]
    """The id of the Actor record"""

    actor_type: ActorType
    """Whether this actor is a User or Team"""

    slug: Optional[str] = None
    is_superuser: bool = False

    def __post_init__(self) -> None:
        if (self.actor_type == ActorType.TEAM) == (self.slug is None):
            raise ValueError("Slugs are expected for teams only")

    def __hash__(self) -> int:
        return hash((self.id, self.actor_type))

    @classmethod
    def from_object(
        cls, obj: Union["RpcActor", "User", "Team", "RpcUser", "RpcTeam"], fetch_actor: bool = True
    ) -> "RpcActor":
        """
        fetch_actor: whether to make an extra query or call to fetch the actor id
                     Without the actor_id the RpcActor acts as a tuple of id and type.
        """
        from sentry.models import Team, User

        if isinstance(obj, cls):
            return obj
        if isinstance(obj, User):
            return cls.from_orm_user(obj, fetch_actor=fetch_actor)
        if isinstance(obj, Team):
            return cls.from_orm_team(obj)
        if isinstance(obj, RpcUser):
            return cls.from_rpc_user(obj, fetch_actor=fetch_actor)
        if isinstance(obj, RpcTeam):
            return cls.from_rpc_team(obj)
        raise TypeError(f"Cannot build RpcActor from {type(obj)}")

    @classmethod
    def from_orm_user(cls, user: "User", fetch_actor: bool = True) -> "RpcActor":
        actor_id = None
        if fetch_actor:
            actor_id = get_actor_id_for_user(user)
        return cls(
            id=user.id,
            actor_id=actor_id,
            actor_type=ActorType.USER,
            is_superuser=user.is_superuser,
        )

    @classmethod
    def from_rpc_user(cls, user: RpcUser, fetch_actor: bool = True) -> "RpcActor":
        actor_id = None
        if fetch_actor:
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

    @classmethod
    def from_rpc_team(cls, team: RpcTeam) -> "RpcActor":
        return cls(id=team.id, actor_id=team.actor_id, actor_type=ActorType.TEAM, slug=team.slug)

    def __eq__(self, other: Any) -> bool:
        return (
            isinstance(other, self.__class__)
            and self.id == other.id
            and self.actor_type == other.actor_type
        )
