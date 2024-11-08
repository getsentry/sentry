import pytest
from rest_framework import serializers

from sentry.models.team import Team
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.actor import Actor, ActorType, parse_and_validate_actor
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service


@django_db_all(transaction=True)
def test_many_from_object_users() -> None:
    users = [Factories.create_user(), Factories.create_user()]
    actors = Actor.many_from_object(users)
    assert len(actors) == len(users)
    assert all([isinstance(a, Actor) for a in actors])
    assert actors[0].id == users[0].id
    assert actors[0].actor_type == ActorType.USER
    assert actors[0].is_user
    assert not actors[0].is_team

    assert actors[1].id == users[1].id
    assert actors[1].actor_type == ActorType.USER


@django_db_all(transaction=True)
def test_from_identifier() -> None:
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    team = Factories.create_team(organization=org)

    actor = Actor.from_identifier(user.id)
    assert actor
    assert actor.id == user.id
    assert actor.actor_type == ActorType.USER
    assert actor.is_user
    assert not actor.is_team

    actor = Actor.from_identifier(str(user.id))
    assert actor
    assert actor.id == user.id
    assert actor.actor_type == ActorType.USER

    actor = Actor.from_identifier(f"user:{user.id}")
    assert actor
    assert actor.id == user.id
    assert actor.actor_type == ActorType.USER

    actor = Actor.from_identifier(user.username)
    assert actor
    assert actor.id == user.id
    assert actor.actor_type == ActorType.USER

    actor = Actor.from_identifier(user.email)
    assert actor
    assert actor.id == user.id
    assert actor.actor_type == ActorType.USER
    assert actor.identifier == f"user:{user.id}"

    actor = Actor.from_identifier(f"team:{team.id}")
    assert actor
    assert actor.id == team.id
    assert actor.actor_type == ActorType.TEAM
    assert actor.identifier == f"team:{team.id}"
    assert actor.is_team
    assert not actor.is_user


def test_from_id() -> None:
    actor = Actor.from_id(team_id=1)
    assert actor
    assert actor.id == 1
    assert actor.actor_type == ActorType.TEAM

    actor = Actor.from_id(user_id=11)
    assert actor
    assert actor.id == 11
    assert actor.actor_type == ActorType.USER

    assert Actor.from_id(user_id=None) is None

    with pytest.raises(Actor.InvalidActor):
        Actor.from_id(user_id=11, team_id=99)


@django_db_all(transaction=True)
def test_many_from_object_rpc_users() -> None:
    orm_users = [Factories.create_user(), Factories.create_user()]
    user_ids = [u.id for u in orm_users]
    rpc_users = user_service.get_many(filter={"user_ids": user_ids})

    actors = Actor.many_from_object(rpc_users)
    assert len(actors) == len(rpc_users)
    assert all([isinstance(a, Actor) for a in actors])
    assert actors[0].id == rpc_users[0].id
    assert actors[0].actor_type == ActorType.USER

    assert actors[1].id == rpc_users[1].id
    assert actors[1].actor_type == ActorType.USER


@django_db_all(transaction=True)
def test_many_from_object_teams() -> None:
    organization = Factories.create_organization()
    teams = [
        Factories.create_team(organization=organization),
        Factories.create_team(organization=organization),
    ]
    actors = Actor.many_from_object(teams)

    assert len(actors) == 2
    assert actors[0].id == teams[0].id
    assert actors[0].actor_type == ActorType.TEAM
    assert actors[0].slug

    assert len(actors) == 2
    assert actors[1].id == teams[1].id
    assert actors[1].actor_type == ActorType.TEAM
    assert actors[1].slug


@django_db_all(transaction=True)
def test_many_from_object_mixed() -> None:
    organization = Factories.create_organization()
    teams = [
        Factories.create_team(organization=organization),
        Factories.create_team(organization=organization),
    ]
    actors = Actor.many_from_object(teams)

    assert len(actors) == 2
    assert actors[0].id == teams[0].id
    assert actors[0].actor_type == ActorType.TEAM
    assert actors[0].slug

    assert len(actors) == 2
    assert actors[1].id == teams[1].id
    assert actors[1].actor_type == ActorType.TEAM
    assert actors[1].slug


@django_db_all(transaction=True)
def test_resolve_many() -> None:
    organization = Factories.create_organization()
    team_one = Factories.create_team(organization=organization)
    team_two = Factories.create_team(organization=organization)
    user_one = Factories.create_user()
    user_two = Factories.create_user()

    members = [user_one, user_two, team_two, team_one]
    actors = [Actor.from_object(m) for m in members]
    resolved = Actor.resolve_many(actors)
    assert len(resolved) == len(actors)

    assert isinstance(resolved[0], RpcUser)
    assert resolved[0].id == user_one.id

    assert isinstance(resolved[1], RpcUser)
    assert resolved[1].id == user_two.id

    assert isinstance(resolved[2], Team)
    assert resolved[2].id == team_two.id

    assert isinstance(resolved[3], Team)
    assert resolved[3].id == team_one.id


@django_db_all(transaction=True)
def test_parse_and_validate_actor() -> None:
    user = Factories.create_user()
    other_user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    other_org = Factories.create_organization(owner=other_user)

    team = Factories.create_team(organization=org)
    other_team = Factories.create_team(organization=other_org)

    actor = parse_and_validate_actor("", org.id)
    assert actor is None
    actor = parse_and_validate_actor(None, org.id)
    assert actor is None

    with pytest.raises(serializers.ValidationError):
        parse_and_validate_actor("lol:nope", org.id)

    # Users that don't exist = errors
    with pytest.raises(serializers.ValidationError):
        parse_and_validate_actor("user:9326798", org.id)

    # Users require membership in the org
    with pytest.raises(serializers.ValidationError):
        parse_and_validate_actor(f"user:{other_user.id}", org.id)
    actor = parse_and_validate_actor(f"user:{user.id}", org.id)
    assert actor
    assert actor.id == user.id
    assert actor.actor_type == ActorType.USER

    # Teams require membership in the org
    with pytest.raises(serializers.ValidationError):
        parse_and_validate_actor(f"team:{other_team.id}", org.id)
    actor = parse_and_validate_actor(f"team:{team.id}", org.id)
    assert actor
    assert actor.id == team.id
    assert actor.actor_type == ActorType.TEAM
