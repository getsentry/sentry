from __future__ import annotations

from collections import defaultdict, namedtuple
from collections.abc import Sequence
from typing import TYPE_CHECKING, overload

from rest_framework import serializers

from sentry.services.hybrid_cloud.user import RpcUser

if TYPE_CHECKING:
    from sentry.models.team import Team
    from sentry.models.user import User


class ActorTuple(namedtuple("Actor", "id type")):
    @property
    def identifier(self):
        return f"{self.type.__name__.lower()}:{self.id}"

    @overload
    @classmethod
    def from_actor_identifier(cls, actor_identifier: None) -> None:
        ...

    @overload
    @classmethod
    def from_actor_identifier(cls, actor_identifier: int | str) -> ActorTuple:
        ...

    @classmethod
    def from_actor_identifier(cls, actor_identifier: int | str | None) -> ActorTuple | None:
        from sentry.models.team import Team
        from sentry.models.user import User
        from sentry.services.hybrid_cloud.user.service import user_service

        """
        Returns an Actor tuple corresponding to a User or Team associated with
        the given identifier.

        Forms `actor_identifier` can take:
            1231 -> look up User by id
            "1231" -> look up User by id
            "user:1231" -> look up User by id
            "team:1231" -> look up Team by id
            "maiseythedog" -> look up User by username
            "maisey@dogsrule.com" -> look up User by primary email
        """

        if not actor_identifier:
            return None

        # If we have an integer, fall back to assuming it's a User
        if isinstance(actor_identifier, int):
            return cls(actor_identifier, User)

        # If the actor_identifier is a simple integer as a string,
        # we're also a User
        if actor_identifier.isdigit():
            return cls(int(actor_identifier), User)

        if actor_identifier.startswith("user:"):
            return cls(int(actor_identifier[5:]), User)

        if actor_identifier.startswith("team:"):
            return cls(int(actor_identifier[5:]), Team)

        try:
            user = user_service.get_by_username(username=actor_identifier)[0]
            return cls(user.id, User)
        except IndexError as e:
            raise serializers.ValidationError(f"Unable to resolve actor identifier: {e}")

    @classmethod
    def from_id(cls, user_id: int | None, team_id: int | None) -> ActorTuple | None:
        from sentry.models.team import Team
        from sentry.models.user import User

        if user_id and team_id:
            raise ValueError("user_id and team_id may not both be specified")
        if user_id and not team_id:
            return cls(user_id, User)
        if team_id and not user_id:
            return cls(team_id, Team)

        return None

    @classmethod
    def from_ids(cls, user_ids: Sequence[int], team_ids: Sequence[int]) -> Sequence[ActorTuple]:
        from sentry.models.team import Team
        from sentry.models.user import User

        return [
            *[cls(user_id, User) for user_id in user_ids],
            *[cls(team_id, Team) for team_id in team_ids],
        ]

    def resolve(self) -> Team | RpcUser:
        return fetch_actor_by_id(self.type, self.id)

    @classmethod
    def resolve_many(cls, actors: Sequence[ActorTuple]) -> Sequence[Team | RpcUser]:
        """
        Resolve multiple actors at the same time. Returns the result in the same order
        as the input, minus any actors we couldn't resolve.
        :param actors:
        :return:
        """
        from sentry.models.user import User
        from sentry.services.hybrid_cloud.user.service import user_service

        if not actors:
            return []

        actors_by_type = defaultdict(list)
        for actor in actors:
            actors_by_type[actor.type].append(actor)

        results = {}
        for model_class, _actors in actors_by_type.items():
            if model_class == User:
                for instance in user_service.get_many(filter={"user_ids": [a.id for a in _actors]}):
                    results[(model_class, instance.id)] = instance
            else:
                for instance in model_class.objects.filter(id__in=[a.id for a in _actors]):
                    results[(model_class, instance.id)] = instance

        return list(filter(None, [results.get((actor.type, actor.id)) for actor in actors]))


@overload
def fetch_actor_by_id(cls: type[User], id: int) -> RpcUser:
    ...


@overload
def fetch_actor_by_id(cls: type[Team], id: int) -> Team:
    ...


def fetch_actor_by_id(cls: type[User] | type[Team], id: int) -> Team | RpcUser:
    from sentry.models.team import Team
    from sentry.models.user import User
    from sentry.services.hybrid_cloud.user.service import user_service

    if cls is Team:
        return Team.objects.get(id=id)

    elif cls is User:
        user = user_service.get_user(id)
        if user is None:
            raise User.DoesNotExist()
        return user
    else:
        raise ValueError(f"Cls {cls} is not a valid actor type.")


def parse_and_validate_actor(
    actor_identifier: str | None, organization_id: int
) -> ActorTuple | None:
    from sentry.models.organizationmember import OrganizationMember
    from sentry.models.team import Team
    from sentry.models.user import User

    if not actor_identifier:
        return None

    try:
        actor = ActorTuple.from_actor_identifier(actor_identifier)
    except Exception:
        raise serializers.ValidationError(
            "Could not parse actor. Format should be `type:id` where type is `team` or `user`."
        )
    try:
        obj = actor.resolve()
    except (Team.DoesNotExist, User.DoesNotExist):
        raise serializers.ValidationError(f"{actor.type.__name__} does not exist")

    if isinstance(obj, Team):
        if obj.organization_id != organization_id:
            raise serializers.ValidationError("Team is not a member of this organization")
    elif isinstance(obj, RpcUser):
        if not OrganizationMember.objects.filter(
            organization_id=organization_id, user_id=obj.id
        ).exists():
            raise serializers.ValidationError("User is not a member of this organization")

    return actor
