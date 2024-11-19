from collections.abc import Generator, Iterator
from random import Random

from django.core.cache import cache

from sentry.hybridcloud.rpc.caching import (
    back_with_silo_cache,
    back_with_silo_cache_list,
    back_with_silo_cache_many,
    control_caching_service,
    region_caching_service,
)
from sentry.hybridcloud.rpc.caching.impl import CacheBackend, _consume_generator
from sentry.organizations.services.organization.model import (
    RpcOrganizationMember,
    RpcOrganizationSummary,
)
from sentry.organizations.services.organization.service import organization_service
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, no_silo_test
from sentry.types.region import get_local_region
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service


@django_db_all(transaction=True)
def test_caching_function() -> None:
    cache.clear()

    @back_with_silo_cache(base_key="my-test-key", silo_mode=SiloMode.REGION, t=RpcUser)
    def get_user(user_id: int) -> RpcUser:
        return user_service.get_many(filter=dict(user_ids=[user_id]))[0]

    users = [Factories.create_user() for _ in range(3)]
    old = []

    for u in users:
        next_user = get_user(u.id)
        assert next_user
        assert next_user == get_user.cb(u.id)
        old.append(next_user)

    for user in users:
        with assume_test_silo_mode(SiloMode.CONTROL):
            user.update(username=user.username + "moocow")

    # Does not include updates
    for old_u in old:
        next_user = get_user(old_u.id)
        assert next_user == old_u

        region_caching_service.clear_key(
            region_name=get_local_region().name, key=get_user.key_from(old_u.id)
        )

    cached_users = [get_user.get_one(u.id) for u in users]
    for u, cached in zip(users, cached_users):
        assert cached
        assert cached.username == u.username


@control_silo_test
@django_db_all(transaction=True)
def test_caching_function_control() -> None:
    cache.clear()

    @back_with_silo_cache(
        base_key="my-test-key", silo_mode=SiloMode.CONTROL, t=RpcOrganizationSummary
    )
    def get_org(org_id: int) -> RpcOrganizationSummary | None:
        return organization_service.get_org_by_id(id=org_id)

    user = Factories.create_user()
    orgs = [Factories.create_organization(owner=user) for _ in range(2)]
    old: list[RpcOrganizationSummary] = []

    for org in orgs:
        next_org = get_org(org.id)
        assert next_org
        assert next_org == get_org.cb(org.id)
        old.append(next_org)

    for org in orgs:
        with assume_test_silo_mode(SiloMode.REGION):
            org.update(name=org.name + " updated")

    # Does not include updates
    for org in old:
        next_org = get_org(org.id)
        assert next_org == org

        control_caching_service.clear_key(key=get_org.key_from(org.id))

    cached_orgs = [get_org.get_one(o.id) for o in orgs]
    for o, cached in zip(orgs, cached_orgs):
        assert cached
        assert cached.name == o.name


@control_silo_test
@django_db_all(transaction=True)
def test_caching_function_none_value() -> None:
    cache.clear()

    @back_with_silo_cache(
        base_key="my-test-key", silo_mode=SiloMode.CONTROL, t=RpcOrganizationSummary, timeout=900
    )
    def get_org(org_id: int) -> RpcOrganizationSummary | None:
        return organization_service.get_org_by_id(id=org_id)

    result = get_org(9999)
    assert result is None

    result = get_org(9999)
    assert result is None


@django_db_all(transaction=True)
@no_silo_test
def test_cache_versioning() -> None:
    cache.clear()

    shared_key = "my-key"
    true_value = "a"

    def reader() -> Iterator[None]:
        nonlocal true_value
        last_length = 0

        while True:
            results = yield from CacheBackend.get_cache([shared_key], SiloMode.REGION)
            value = next(iter(results.values()))
            if isinstance(value, str):
                assert (
                    len(value) >= last_length
                ), "Read after write broken -- never read a more stale value than has been observed written"
                assert all(c == "a" for c in value)
            else:
                version = value
                copied_local_value = true_value
                yield
                yield from CacheBackend.set_cache(shared_key, copied_local_value, version)
                last_length = len(copied_local_value)

    def writer() -> Generator[None, None, None]:
        nonlocal true_value
        while True:
            for i in range(5):
                yield
            true_value += "a"
            yield from CacheBackend.delete_cache(shared_key, SiloMode.REGION)

    def cache_death_event() -> Generator[None, None, None]:
        while True:
            for i in range(20):
                yield
            cache.clear()

    reader1 = reader()
    reader2 = reader()
    writer1 = writer()
    cache_death = cache_death_event()
    random = Random(84716393)
    for i in range(10000):
        next(random.choice([reader1, reader2, writer1, cache_death]))


@django_db_all(transaction=True)
def test_caching_many() -> None:
    cache.clear()

    @back_with_silo_cache_many(base_key="get_users", silo_mode=SiloMode.REGION, t=RpcUser)
    def get_users(user_ids: list[int]) -> list[RpcUser]:
        return user_service.get_many(filter=dict(user_ids=user_ids))

    users = [Factories.create_user() for _ in range(3)]
    user_ids = [u.id for u in users]

    wrapped_result = get_users(user_ids)
    direct_result = get_users.cb(user_ids)
    assert len(wrapped_result) == len(direct_result)
    for wrapped, direct in zip(wrapped_result, direct_result):
        assert wrapped == direct

    with assume_test_silo_mode(SiloMode.CONTROL):
        for user in users:
            user.update(username=user.username + "moo")

    # Does not include updates made to db
    after_update_wrapped = get_users(user_ids)
    for u in after_update_wrapped:
        assert not u.username.endswith("moo")
        # Clear cache simulating outbox logic
        region_caching_service.clear_key(
            region_name=get_local_region().name, key=get_users.key_from(u.id)
        )

    cached_users = get_users(user_ids)
    for user, cached in zip(users, cached_users):
        assert cached
        assert cached.username.endswith("moo")
        assert cached.username == user.username


@django_db_all(transaction=True)
def test_caching_many_partial() -> None:
    cache.clear()

    @back_with_silo_cache_many(base_key="get_users", silo_mode=SiloMode.REGION, t=RpcUser)
    def get_users(user_ids: list[int]) -> list[RpcUser]:
        return user_service.get_many(filter=dict(user_ids=user_ids))

    users = [Factories.create_user() for _ in range(3)]
    user_ids = [u.id for u in users]

    single_user = get_users([users[0].id])
    assert len(single_user) == 1
    assert single_user[0].id == users[0].id
    assert single_user[0].username == users[0].username

    all_users = get_users(user_ids)
    assert len(all_users) == len(users)
    for i, user in enumerate(all_users):
        assert user_ids[i] == user.id, "Results should be ordered based on id list"


@django_db_all(transaction=True)
def test_caching_many_missing_ids() -> None:
    cache.clear()

    @back_with_silo_cache_many(base_key="get_users", silo_mode=SiloMode.REGION, t=RpcUser)
    def get_users(user_ids: list[int]) -> list[RpcUser]:
        return user_service.get_many(filter=dict(user_ids=user_ids))

    users = [Factories.create_user() for _ in range(2)]
    user_ids = [u.id for u in users]
    # Add a user_id that won't exist.
    user_ids.append(max(user_ids) + 100)

    results = get_users(user_ids)
    assert len(results) == 2
    assert results[0].id == user_ids[0]
    assert results[1].id == user_ids[1]

    cache_keys = [get_users.key_from(id) for id in user_ids]
    cache_results = _consume_generator(CacheBackend.get_cache(cache_keys, SiloMode.REGION))
    assert len(cache_results) == 3

    assert cache_results[get_users.key_from(user_ids[0])] != 0, "should be a hit"
    assert cache_results[get_users.key_from(user_ids[1])] != 0, "should be a hit"

    missing_key = user_ids[-1]
    assert cache_results[get_users.key_from(missing_key)] == 0, "should be a miss"


@django_db_all(transaction=True)
def test_caching_many_versioning() -> None:
    cache.clear()

    @back_with_silo_cache_many(base_key="get_users", silo_mode=SiloMode.REGION, t=RpcUser)
    def get_users(user_ids: list[int]) -> list[RpcUser]:
        return user_service.get_many(filter=dict(user_ids=user_ids))

    users = [Factories.create_user() for _ in range(2)]
    user_ids = [u.id for u in users]
    cache_keys = [get_users.key_from(id) for id in user_ids]
    before_results = get_users(user_ids)
    assert len(before_results) == 2

    # Clear cache to simulate outbox processing
    for user in users:
        region_caching_service.clear_key(
            region_name=get_local_region().name, key=get_users.key_from(user.id)
        )

    # Read from the cache directly and drain the generator
    cache_results = _consume_generator(CacheBackend.get_cache(cache_keys, SiloMode.REGION))
    assert cache_results is not None
    for item in cache_results.values():
        assert isinstance(item, int), "Should be version as data was purged"

    after_clear = get_users(user_ids)
    assert len(after_clear) == 2


@control_silo_test
@django_db_all(transaction=True)
def test_caching_list() -> None:
    cache.clear()

    @back_with_silo_cache_list(
        base_key="get_owner_members", silo_mode=SiloMode.CONTROL, t=RpcOrganizationMember
    )
    def get_org_members(organization_id: int) -> list[RpcOrganizationMember]:
        return organization_service.get_organization_owner_members(organization_id=organization_id)

    users = [Factories.create_user() for _ in range(3)]

    with assume_test_silo_mode(SiloMode.REGION):
        org = Factories.create_organization()
        members = [
            Factories.create_member(organization=org, user=user, role="owner") for user in users
        ]

    wrapped_result = get_org_members(org.id)
    direct_result = get_org_members.cb(org.id)

    assert len(wrapped_result) == len(direct_result)
    for wrapped, direct in zip(wrapped_result, direct_result):
        assert wrapped == direct

    with assume_test_silo_mode(SiloMode.REGION):
        for member in members:
            member.update(role="member")

    # Does not include updates made to db
    after_update_wrapped = get_org_members(org.id)
    for member in after_update_wrapped:
        assert member.role == "owner"

        # Clear cache simulating outbox logic
        region_caching_service.clear_key(
            region_name=get_local_region().name, key=get_org_members.key_from(org.id)
        )

    cached_members = get_org_members(org.id)
    assert len(cached_members) == 0, "with members updated none are owners"
