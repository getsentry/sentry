from collections import defaultdict
from collections.abc import Iterable, MutableMapping, Sequence
from enum import Enum
from typing import TYPE_CHECKING, Any, Protocol, Union, overload

from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from sentry.hybridcloud.rpc import RpcModel
from sentry.users.services.user import RpcUser

if TYPE_CHECKING:
    from sentry.models.team import Team
    from sentry.organizations.services.organization import RpcTeam
    from sentry.users.models.user import User


class ActorType(str, Enum):
    USER = "User"
    TEAM = "Team"


ActorTarget = Union["Actor", "User", "RpcUser", "Team", "RpcTeam"]


class Actor(RpcModel):
    """Can represent any model object with a foreign key to Actor."""

    id: int
    """The id of the user/team this actor represents"""

    actor_type: ActorType
    """Whether this actor is a User or Team"""

    slug: str | None = None

    class InvalidActor(ObjectDoesNotExist):
        """Raised when an Actor fails to resolve or be found"""

        pass

    @classmethod
    def resolve_many(
        cls, actors: Sequence["Actor"], filter_none: bool = True
    ) -> list["Team | RpcUser | None"]:
        """
        Resolve a list of actors in a batch to the Team/User the Actor references.

        Will generate more efficient queries to load actors than calling
        Actor.resolve() individually will.
        """
        from sentry.models.team import Team
        from sentry.users.services.user.service import user_service

        if not actors:
            return []
        actors_by_type: dict[ActorType, list[Actor]] = defaultdict(list)
        for actor in actors:
            actors_by_type[actor.actor_type].append(actor)
        results: dict[tuple[ActorType, int], Team | RpcUser] = {}
        for actor_type, actor_list in actors_by_type.items():
            if actor_type == ActorType.USER:
                for user in user_service.get_many_by_id(ids=[u.id for u in actor_list]):
                    results[(actor_type, user.id)] = user
            if actor_type == ActorType.TEAM:
                for team in Team.objects.filter(id__in=[t.id for t in actor_list]):
                    results[(actor_type, team.id)] = team

        final_results = [results.get((actor.actor_type, actor.id)) for actor in actors]
        if filter_none:
            final_results = list(filter(None, final_results))
        return final_results

    @classmethod
    def many_from_object(cls, objects: Iterable[ActorTarget]) -> list["Actor"]:
        """
        Create a list of Actor instances based on a collection of 'objects'

        Objects will be grouped by the kind of actor they would be related to.
        Queries for actors are batched to increase efficiency. Users that are
        missing actors will have actors generated.
        """
        from sentry.models.team import Team
        from sentry.organizations.services.organization import RpcTeam
        from sentry.users.models.user import User

        result: list["Actor"] = []
        grouped_by_type: MutableMapping[str, list[int]] = defaultdict(list)
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
                    Actor(
                        id=team_id,
                        actor_type=ActorType.TEAM,
                        slug=team_slugs.get(team_id),
                    )
                )

        if grouped_by_type[ActorType.USER]:
            user_ids = grouped_by_type[ActorType.USER]
            for user_id in user_ids:
                result.append(Actor(id=user_id, actor_type=ActorType.USER))
        return result

    @classmethod
    def from_object(cls, obj: ActorTarget) -> "Actor":
        """
        fetch_actor: whether to make an extra query or call to fetch the actor id
                     Without the actor_id the Actor acts as a tuple of id and type.
        """
        from sentry.models.team import Team
        from sentry.organizations.services.organization import RpcTeam
        from sentry.users.models.user import User

        if isinstance(obj, cls):
            return obj
        if isinstance(obj, User):
            return cls.from_orm_user(obj)
        if isinstance(obj, Team):
            return cls.from_orm_team(obj)
        if isinstance(obj, RpcUser):
            return cls.from_rpc_user(obj)
        if isinstance(obj, RpcTeam):
            return cls.from_rpc_team(obj)
        raise TypeError(f"Cannot build Actor from {type(obj)}")

    @classmethod
    def from_orm_user(cls, user: "User") -> "Actor":
        return cls(
            id=user.id,
            actor_type=ActorType.USER,
        )

    @classmethod
    def from_rpc_user(cls, user: RpcUser) -> "Actor":
        return cls(
            id=user.id,
            actor_type=ActorType.USER,
        )

    @classmethod
    def from_orm_team(cls, team: "Team") -> "Actor":
        return cls(id=team.id, actor_type=ActorType.TEAM, slug=team.slug)

    @classmethod
    def from_rpc_team(cls, team: "RpcTeam") -> "Actor":
        return cls(id=team.id, actor_type=ActorType.TEAM, slug=team.slug)

    @overload
    @classmethod
    def from_identifier(cls, id: None) -> None: ...

    @overload
    @classmethod
    def from_identifier(cls, id: int | str) -> "Actor": ...

    @classmethod
    def from_identifier(cls, id: str | int | None) -> "Actor | None":
        """
        Parse an actor identifier into an Actor

        Forms `id` can take:
            1231 -> look up User by id
            "1231" -> look up User by id
            "user:1231" -> look up User by id
            "team:1231" -> look up Team by id
            "maiseythedog" -> look up User by username
            "maisey@dogsrule.com" -> look up User by primary email
        """
        from sentry.users.services.user.service import user_service

        if not id:
            return None
        # If we have an integer, fall back to assuming it's a User
        if isinstance(id, int):
            return cls(id=id, actor_type=ActorType.USER)

        # If the actor_identifier is a simple integer as a string,
        # we're also a User
        if id.isdigit():
            return cls(id=int(id), actor_type=ActorType.USER)

        if id.startswith("user:"):
            return cls(id=int(id[5:]), actor_type=ActorType.USER)

        if id.startswith("team:"):
            return cls(id=int(id[5:]), actor_type=ActorType.TEAM)

        try:
            user = user_service.get_by_username(username=id)[0]
            return cls(id=user.id, actor_type=ActorType.USER)
        except IndexError as e:
            raise cls.InvalidActor(f"Unable to resolve actor identifier: {e}")

    @classmethod
    def from_id(cls, user_id: int | None = None, team_id: int | None = None) -> "Actor | None":
        if user_id and team_id:
            raise cls.InvalidActor("You can only provide one of user_id and team_id")
        if user_id:
            return cls(id=user_id, actor_type=ActorType.USER)
        if team_id:
            return cls(id=team_id, actor_type=ActorType.TEAM)
        return None

    def __post_init__(self) -> None:
        if not self.is_team and self.slug is not None:
            raise ValueError("Slugs are expected for teams only")

    def __hash__(self) -> int:
        return hash((self.id, self.actor_type))

    def __eq__(self, other: Any) -> bool:
        return (
            isinstance(other, self.__class__)
            and self.id == other.id
            and self.actor_type == other.actor_type
        )

    def resolve(self) -> "Team | RpcUser":
        """
        Resolve an Actor into the Team or RpcUser it represents.

        Will raise Team.DoesNotExist or User.DoesNotExist when the actor is invalid
        """
        from sentry.models.team import Team
        from sentry.users.services.user.service import user_service

        if self.is_team:
            team = Team.objects.filter(id=self.id).first()
            if team:
                return team
            raise Actor.InvalidActor(f"Cannot find a team with id={self.id}")
        if self.is_user:
            user = user_service.get_user(user_id=self.id)
            if user:
                return user
            raise Actor.InvalidActor(f"Cannot find a User with id={self.id}")
        # This should be un-reachable
        raise Actor.InvalidActor("Cannot resolve an actor with an unknown type")

    @property
    def identifier(self) -> str:
        return f"{self.actor_type.lower()}:{self.id}"

    @property
    def is_team(self) -> bool:
        return self.actor_type == ActorType.TEAM

    @property
    def is_user(self) -> bool:
        return self.actor_type == ActorType.USER


class ActorOwned(Protocol):
    """Protocol for objects that are owned by Actor but need to store ownership in discrete columns"""

    @property
    def owner(self) -> Actor | None: ...

    @owner.setter
    def owner(self, actor: Actor | None) -> None: ...


def parse_and_validate_actor(actor_identifier: str | None, organization_id: int) -> Actor | None:
    from sentry.models.organizationmember import OrganizationMember
    from sentry.models.team import Team

    if not actor_identifier:
        return None

    try:
        actor = Actor.from_identifier(actor_identifier)
    except Exception:
        raise serializers.ValidationError(
            "Could not parse actor. Format should be `type:id` where type is `team` or `user`."
        )
    try:
        obj = actor.resolve()
    except Actor.InvalidActor:
        raise serializers.ValidationError(f"{actor.actor_type} does not exist")

    if isinstance(obj, Team):
        if obj.organization_id != organization_id:
            raise serializers.ValidationError("Team is not a member of this organization")
    elif isinstance(obj, RpcUser):
        if not OrganizationMember.objects.filter(
            organization_id=organization_id, user_id=obj.id
        ).exists():
            raise serializers.ValidationError("User is not a member of this organization")

    return actor
