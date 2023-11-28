from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
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
