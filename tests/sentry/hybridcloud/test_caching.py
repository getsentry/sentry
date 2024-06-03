from collections.abc import Generator, Iterator
from random import Random

from django.core.cache import cache

from sentry.hybridcloud.rpc.services.caching import (
    back_with_silo_cache,
    control_caching_service,
    region_caching_service,
)
from sentry.hybridcloud.rpc.services.caching.impl import CacheBackend
from sentry.services.hybrid_cloud.organization.model import RpcOrganizationSummary
from sentry.services.hybrid_cloud.organization.service import organization_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, no_silo_test
from sentry.types.region import get_local_region


@django_db_all(transaction=True)
def test_caching_function() -> None:
    cache.clear()

    @back_with_silo_cache(base_key="my-test-key", silo_mode=SiloMode.REGION, t=RpcUser)
    def get_user(user_id: int) -> RpcUser:
        return user_service.get_many(filter=dict(user_ids=[user_id]))[0]

    users = [Factories.create_user() for _ in range(3)]
    old: list[RpcUser] = []

    for u in users:
        next_user = get_user(u.id)
        assert next_user
        assert next_user == get_user.cb(u.id)
        old.append(next_user)

    for user in users:
        with assume_test_silo_mode(SiloMode.CONTROL):
            user.update(username=user.username + "moocow")

    # Does not include updates
    for u in old:
        next_user = get_user(u.id)
        assert next_user == u

        region_caching_service.clear_key(
            region_name=get_local_region().name, key=get_user.key_from(u.id)
        )

    for u, cached in zip(users, get_user.get_many([u.id for u in users])):
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

    for o, cached in zip(orgs, get_org.get_many([o.id for o in orgs])):
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
