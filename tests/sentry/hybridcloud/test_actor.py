import pytest

from sentry.models.team import Team
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all(transaction=True)
def test_many_from_object_users():
    users = [Factories.create_user(), Factories.create_user()]
    actors = RpcActor.many_from_object(users)
    assert len(actors) == len(users)
    assert all([isinstance(a, RpcActor) for a in actors])
    assert actors[0].id == users[0].id
    assert actors[0].actor_type == ActorType.USER

    assert actors[1].id == users[1].id
    assert actors[1].actor_type == ActorType.USER


@django_db_all(transaction=True)
def test_from_identifier():
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    team = Factories.create_team(organization=org)

    actor = RpcActor.from_identifier(user.id)
    assert actor
    assert actor.id == user.id
    assert actor.actor_type == ActorType.USER

    actor = RpcActor.from_identifier(str(user.id))
    assert actor
    assert actor.id == user.id
    assert actor.actor_type == ActorType.USER

    actor = RpcActor.from_identifier(f"user:{user.id}")
    assert actor
    assert actor.id == user.id
    assert actor.actor_type == ActorType.USER

    actor = RpcActor.from_identifier(user.username)
    assert actor
    assert actor.id == user.id
    assert actor.actor_type == ActorType.USER

    actor = RpcActor.from_identifier(user.email)
    assert actor
    assert actor.id == user.id
    assert actor.actor_type == ActorType.USER
    assert actor.identifier == f"user:{user.id}"

    actor = RpcActor.from_identifier(f"team:{team.id}")
    assert actor
    assert actor.id == team.id
    assert actor.actor_type == ActorType.TEAM
    assert actor.identifier == f"team:{team.id}"


def test_from_id():
    actor = RpcActor.from_id(team_id=1)
    assert actor
    assert actor.id == 1
    assert actor.actor_type == ActorType.TEAM

    actor = RpcActor.from_id(user_id=11)
    assert actor
    assert actor.id == 11
    assert actor.actor_type == ActorType.USER

    with pytest.raises(ValueError):
        RpcActor.from_id(user_id=11, team_id=99)
    with pytest.raises(ValueError):
        RpcActor.from_id(user_id=None)


@django_db_all(transaction=True)
def test_many_from_object_rpc_users():
    orm_users = [Factories.create_user(), Factories.create_user()]
    user_ids = [u.id for u in orm_users]
    rpc_users = user_service.get_many(filter={"user_ids": user_ids})

    actors = RpcActor.many_from_object(rpc_users)
    assert len(actors) == len(rpc_users)
    assert all([isinstance(a, RpcActor) for a in actors])
    assert actors[0].id == rpc_users[0].id
    assert actors[0].actor_type == ActorType.USER

    assert actors[1].id == rpc_users[1].id
    assert actors[1].actor_type == ActorType.USER


@django_db_all(transaction=True)
def test_many_from_object_teams():
    organization = Factories.create_organization()
    teams = [
        Factories.create_team(organization=organization),
        Factories.create_team(organization=organization),
    ]
    actors = RpcActor.many_from_object(teams)

    assert len(actors) == 2
    assert actors[0].id == teams[0].id
    assert actors[0].actor_type == ActorType.TEAM
    assert actors[0].slug

    assert len(actors) == 2
    assert actors[1].id == teams[1].id
    assert actors[1].actor_type == ActorType.TEAM
    assert actors[1].slug


@django_db_all(transaction=True)
def test_many_from_object_mixed():
    organization = Factories.create_organization()
    teams = [
        Factories.create_team(organization=organization),
        Factories.create_team(organization=organization),
    ]
    actors = RpcActor.many_from_object(teams)

    assert len(actors) == 2
    assert actors[0].id == teams[0].id
    assert actors[0].actor_type == ActorType.TEAM
    assert actors[0].slug

    assert len(actors) == 2
    assert actors[1].id == teams[1].id
    assert actors[1].actor_type == ActorType.TEAM
    assert actors[1].slug


@django_db_all(transaction=True)
def test_resolve_many():
    organization = Factories.create_organization()
    team_one = Factories.create_team(organization=organization)
    team_two = Factories.create_team(organization=organization)
    user_one = Factories.create_user()
    user_two = Factories.create_user()

    members = [user_one, user_two, team_two, team_one]
    actors = [RpcActor.from_object(m) for m in members]
    resolved = RpcActor.resolve_many(actors)
    assert len(resolved) == len(actors)

    assert isinstance(resolved[0], RpcUser)
    assert resolved[0].id == user_one.id

    assert isinstance(resolved[1], RpcUser)
    assert resolved[1].id == user_two.id

    assert isinstance(resolved[2], Team)
    assert resolved[2].id == team_two.id

    assert isinstance(resolved[3], Team)
    assert resolved[3].id == team_one.id
