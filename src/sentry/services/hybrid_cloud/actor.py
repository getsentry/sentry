# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from collections import defaultdict
from enum import Enum
from typing import TYPE_CHECKING, Any, Iterable, List, MutableMapping, Optional, Union

from sentry.models.actor import ACTOR_TYPES, get_actor_id_for_user
from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.organization import RpcTeam
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service

if TYPE_CHECKING:
    from sentry.models.actor import Actor
    from sentry.models.team import Team
    from sentry.models.user import User


class ActorType(str, Enum):
    USER = "User"
    TEAM = "Team"


ActorTarget = Union["Actor", "RpcActor", "User", "RpcUser", "Team", "RpcTeam"]


class RpcActor(RpcModel):
    """Can represent any model object with a foreign key to Actor."""

    id: int
    """The id of the user/team this actor represents"""

    actor_type: ActorType
    """Whether this actor is a User or Team"""

    slug: Optional[str] = None

    def __post_init__(self) -> None:
        if (self.actor_type == ActorType.TEAM) == (self.slug is None):
            raise ValueError("Slugs are expected for teams only")

    def __hash__(self) -> int:
        return hash((self.id, self.actor_type))

    @classmethod
    def many_from_object(cls, objects: Iterable[ActorTarget]) -> List["RpcActor"]:
        """
        Create a list of RpcActor instaces based on a collection of 'objects'

        Objects will be grouped by the kind of actor they would be related to.
        Queries for actors are batched to increase efficiency. Users that are
        missing actors will have actors generated.
        """
        from sentry.models.team import Team
        from sentry.models.user import User

        result: List["RpcActor"] = []
        grouped_by_type: MutableMapping[str, List[int]] = defaultdict(list)
        team_slugs: MutableMapping[int, str] = {}
        for obj in objects:
            if isinstance(obj, cls):
                result.append(obj)
            if isinstance(obj, (User, RpcUser)):
                grouped_by_type[ActorType.USER].append(obj.id)
            if isinstance(obj, (Team, RpcTeam)):
                team_slugs[obj.id] = obj.slug
                grouped_by_type[ActorType.TEAM].append(obj.id)

        if grouped_by_type[ActorType.TEAM]:
            team_ids = grouped_by_type[ActorType.TEAM]
            for team_id in team_ids:
                result.append(
                    RpcActor(
                        id=team_id,
                        actor_type=ActorType.TEAM,
                        slug=team_slugs.get(team_id),
                    )
                )

        if grouped_by_type[ActorType.USER]:
            user_ids = grouped_by_type[ActorType.USER]
            for user_id in user_ids:
                result.append(RpcActor(id=user_id, actor_type=ActorType.USER))
        return result

    @classmethod
    def from_object(cls, obj: ActorTarget, fetch_actor: bool = True) -> "RpcActor":
        """
        fetch_actor: whether to make an extra query or call to fetch the actor id
                     Without the actor_id the RpcActor acts as a tuple of id and type.
        """
        from sentry.models.actor import Actor
        from sentry.models.team import Team
        from sentry.models.user import User

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
        if isinstance(obj, Actor):
            return cls.from_orm_actor(obj)
        raise TypeError(f"Cannot build RpcActor from {type(obj)}")

    @classmethod
    def from_orm_user(cls, user: "User", fetch_actor: bool = True) -> "RpcActor":
        return cls(
            id=user.id,
            actor_type=ActorType.USER,
        )

    @classmethod
    def from_orm_actor(cls, actor: "Actor") -> "RpcActor":
        actor_type = ActorType.USER if actor.type == ACTOR_TYPES["user"] else ActorType.TEAM
        model_id = actor.user_id if actor_type == ActorType.USER else actor.team_id

        return cls(
            id=model_id,
            actor_id=actor.id,
            actor_type=actor_type,
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

    def resolve(self) -> Optional[Union["Team", "RpcUser"]]:
        from sentry.models.team import Team

        if self.actor_type == ActorType.TEAM:
            return Team.objects.filter(id=self.id).first()
        if self.actor_type == ActorType.USER:
            return user_service.get_user(user_id=self.id)
