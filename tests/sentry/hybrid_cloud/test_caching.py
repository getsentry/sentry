from random import Random
from typing import List

from django.core.cache import cache

from sentry.hybridcloud.rpc.services.caching import back_with_silo_cache, region_caching_service
from sentry.hybridcloud.rpc.services.caching.impl import CacheBackend
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.silo import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode, no_silo_test, region_silo_test
from sentry.types.region import get_local_region


@django_db_all(transaction=True)
@region_silo_test
def test_caching_function():
    cache.clear()

    @back_with_silo_cache(base_key="my-test-key", silo_mode=SiloMode.REGION, t=RpcUser)
    def get_user(user_id: int) -> RpcUser:
        return user_service.get_many(filter=dict(user_ids=[user_id]))[0]

    users = [Factories.create_user() for _ in range(3)]
    old: List[RpcUser] = []

    for u in users:
        next_user = get_user(u.id)
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
        assert cached.username == u.username


@django_db_all(transaction=True)
@no_silo_test
def test_cache_versioning():
    cache.clear()

    shared_key = "my-key"
    true_value = "a"

    def reader():
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

    def writer():
        nonlocal true_value
        while True:
            for i in range(5):
                yield
            true_value += "a"
            yield from CacheBackend.delete_cache(shared_key, SiloMode.REGION)

    def cache_death_event():
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
