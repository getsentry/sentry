import base64
from collections.abc import Generator, Iterator
from contextlib import contextmanager
from random import Random

import pytest
from cryptography.fernet import Fernet
from django.core.cache import cache
from django.test import override_settings

from sentry.hybridcloud.models.cacheversion import CellCacheVersion, ControlCacheVersion
from sentry.hybridcloud.rpc.caching import (
    back_with_silo_cache,
    back_with_silo_cache_list,
    back_with_silo_cache_many,
    cell_caching_service,
    control_caching_service,
)
from sentry.hybridcloud.rpc.caching.encryption import CacheEncrypter, EncryptionMethod
from sentry.hybridcloud.rpc.caching.impl import CacheBackend, _consume_generator, _versioned_key
from sentry.hybridcloud.rpc.caching.service import MAX_BASE_KEY_LENGTH, MAX_CACHE_KEY_LENGTH
from sentry.organizations.services.organization.model import (
    RpcOrganizationMember,
    RpcOrganizationSummary,
)
from sentry.organizations.services.organization.service import organization_service
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, no_silo_test
from sentry.types.cell import get_local_cell
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils import json
from sentry.utils.security.encrypted_field_key_store import FernetKeyStore

FERNET_KEY_ID = "key_id_1"


@contextmanager
def fernet_encryption() -> Generator[None]:
    """
    Load a single in-memory Fernet key and select it as the primary key,
    mirroring the fixtures in tests/sentry/db/models/fields/encryption/conftest.py.
    """
    original_keys = FernetKeyStore._keys
    original_is_loaded = FernetKeyStore._is_loaded
    FernetKeyStore._keys = {FERNET_KEY_ID: Fernet(Fernet.generate_key())}
    FernetKeyStore._is_loaded = True
    try:
        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": FERNET_KEY_ID}
        ):
            yield
    finally:
        FernetKeyStore._keys = original_keys
        FernetKeyStore._is_loaded = original_is_loaded


def _cache_version(key: str, silo_mode: SiloMode) -> int:
    version_model = CellCacheVersion if silo_mode == SiloMode.CELL else ControlCacheVersion
    return version_model.get_version_map([key]).get(key, 0)


def _raw_cache_value(key: str, silo_mode: SiloMode) -> str | None:
    """Read the stored value for a cache key at its current version, bypassing the decorator."""
    return cache.get(_versioned_key(key, _cache_version(key, silo_mode)))


def _overwrite_cache_value(key: str, value: str, silo_mode: SiloMode) -> None:
    cache.set(_versioned_key(key, _cache_version(key, silo_mode)), value)


@django_db_all(transaction=True)
def test_caching_function() -> None:
    cache.clear()

    @back_with_silo_cache(base_key="my-test-key", silo_mode=SiloMode.CELL, t=RpcUser)
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

        cell_caching_service.clear_key(
            cell_name=get_local_cell().name, key=get_user.key_from(old_u.id)
        )

    cached_users = [get_user.get_one(u.id) for u in users]
    for u, cached in zip(users, cached_users):
        assert cached
        assert cached.username == u.username


@back_with_silo_cache(base_key="multiple-params", silo_mode=SiloMode.CELL, t=RpcUser)
def get_active_user(user_id: int, is_active: bool) -> RpcUser | None:
    results = user_service.get_many(filter=dict(user_ids=[user_id], is_active=is_active))
    if len(results):
        return results[0]
    return None


@back_with_silo_cache(
    base_key="this-base-key-is-32-chars-loonng", silo_mode=SiloMode.CELL, t=RpcUser
)
def get_active_user_equal(user_id: int, padding: str) -> RpcUser | None:
    results = user_service.get_many(filter=dict(user_ids=[user_id]))
    if len(results):
        return results[0]
    return None


@django_db_all(transaction=True)
def test_caching_function_multiple_parameters() -> None:
    cache.clear()

    user = Factories.create_user()

    first = get_active_user(user.id, True)
    assert first
    assert first.id == user.id
    assert first.username == user.username

    # Each parameter combination is a separate cache entry, so the non-matching
    # combination is a miss rather than a hit on the entry written above.
    assert get_active_user(user.id, False) is None

    with assume_test_silo_mode(SiloMode.CONTROL):
        user.update(username=user.username + "moocow")

    # The second read of the same parameters is served from cache, so it does not
    # observe the update. Calling through to the wrapped function does.
    cached = get_active_user(user.id, True)
    assert cached
    assert cached.username == first.username
    assert cached.username != user.username

    direct = get_active_user.cb(user.id, True)
    assert direct
    assert direct.username == user.username

    assert get_active_user.key_from(user.id, True) != get_active_user.key_from(user.id, False)
    assert get_active_user.key_from(user.id, True) != get_active_user.key_from(user.id + 1, True)


@django_db_all(transaction=True)
def test_caching_function_with_overflow_parameters() -> None:
    cache.clear()

    user = Factories.create_user()
    # The json encoding will push the key past max length
    padding_len = MAX_CACHE_KEY_LENGTH - len(str(user.id))

    first = get_active_user_equal(user.id, "a" * padding_len)
    assert first
    assert first.id == user.id
    assert first.username == user.username

    reload = get_active_user_equal(user.id, "a" * padding_len)
    assert reload
    assert reload.id == first.id


@django_db_all(transaction=True)
def test_caching_function_multiple_parameters_clear_key() -> None:
    cache.clear()

    users = [Factories.create_user() for _ in range(2)]
    before = [get_active_user(u.id, True) for u in users]
    assert all(before)

    with assume_test_silo_mode(SiloMode.CONTROL):
        for u in users:
            u.update(username=u.username + "moocow")

    # Clearing a key built from the same parameters evicts that entry only.
    cell_caching_service.clear_key(
        cell_name=get_local_cell().name, key=get_active_user.key_from(users[0].id, True)
    )

    cleared = get_active_user(users[0].id, True)
    assert cleared
    assert cleared.username == users[0].username

    untouched = get_active_user(users[1].id, True)
    assert untouched == before[1]


@django_db_all(transaction=True)
def test_caching_function_other_silo_mode() -> None:
    cache.clear()

    user = Factories.create_user()
    cached = get_active_user(user.id, True)
    assert cached

    with assume_test_silo_mode(SiloMode.CONTROL):
        user.update(username=user.username + "moocow")

    # A silo that does not own this cache bypasses it and forwards every parameter
    # to the wrapped function.
    with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
        fresh = get_active_user(user.id, True)
    assert fresh
    assert fresh.username == user.username
    assert fresh.username != cached.username


@back_with_silo_cache(base_key="key-encoding", silo_mode=SiloMode.CELL, t=RpcUser)
def get_by_one_param(value: object) -> RpcUser | None:
    return None


@back_with_silo_cache(base_key="key-encoding-two", silo_mode=SiloMode.CELL, t=RpcUser)
def get_by_two_params(first: object, second: object) -> RpcUser | None:
    return None


def test_base_key_length_check() -> None:
    key_len = MAX_BASE_KEY_LENGTH + 1
    base_key = "a" * key_len

    with pytest.raises(ValueError) as err:

        @back_with_silo_cache(base_key=base_key, silo_mode=SiloMode.CELL, t=RpcUser)
        def get_thing(value: str) -> RpcUser | None:
            return None

    assert f"base_key '{base_key}' is {key_len} characters" in str(err.value)


def test_key_from_distinguishes_parameters() -> None:
    # Single key signature work with str representation so these keys are the same.
    # In practice this doesn't matter as a function's signature should prevent shadowing
    assert get_by_one_param.key_from(1) == get_by_one_param.key_from("1")

    # Multi-parameters signatures distinguish types
    assert get_by_two_params.key_from("1", "a") != get_by_two_params.key_from(1, "a")

    # Separators inside a parameter cannot be confused for parameter boundaries.
    assert get_by_two_params.key_from("a:b", "c") != get_by_two_params.key_from("a", "b:c")


def test_key_from_fits_cache_version_column() -> None:
    base_key = "a" * MAX_BASE_KEY_LENGTH

    @back_with_silo_cache(base_key=base_key, silo_mode=SiloMode.CELL, t=RpcUser)
    def get_thing(value: str) -> RpcUser | None:
        return None

    # Single parameter keys need to retain compatiblity with historical keys
    short_key = get_thing.key_from("1")
    assert short_key == f"{base_key}:1"

    # Parameters that would overflow CacheVersion.key are hashed down to fit.
    long_key = get_thing.key_from("x" * 500)
    assert len(long_key) <= MAX_CACHE_KEY_LENGTH
    assert long_key != short_key
    assert long_key != get_thing.key_from("y" * 500)


def test_key_from_is_memcached_safe() -> None:
    @back_with_silo_cache(base_key="unsafe-chars", silo_mode=SiloMode.CELL, t=RpcUser)
    def get_thing(value: str) -> RpcUser | None:
        return None

    # Memcached rejects whitespace and control characters, so parameters containing
    # them are hashed rather than embedded in the key.
    for value in ("has a space", "has\ttab", "has\nnewline", "café"):
        key = get_thing.key_from(value)
        assert all(0x21 <= ord(c) <= 0x7E for c in key), f"unsafe key for {value!r}: {key!r}"

    assert get_thing.key_from("has a space") != get_thing.key_from("has-a-space")


@django_db_all(transaction=True)
def test_key_from_equal_to_max_length() -> None:
    cache.clear()
    user = Factories.create_user()
    id_len = len(str(user.id))
    # 6 accounts for :[,""]
    padding_len = MAX_CACHE_KEY_LENGTH - id_len - 6

    key = get_active_user_equal.key_from(user.id, "a" * padding_len)
    assert len(key) <= MAX_CACHE_KEY_LENGTH
    version = CellCacheVersion.incr_version(key)
    assert version > 0


@django_db_all(transaction=True)
def test_key_from_parameter_overflow_key_length() -> None:
    cache.clear()
    user = Factories.create_user()
    # The combined length of padding + id_len + wrapping json will overflow key length
    id_len = len(str(user.id))
    padding_len = MAX_CACHE_KEY_LENGTH - id_len + 1

    key = get_active_user_equal.key_from(user.id, "a" * padding_len)
    assert len(key) <= MAX_CACHE_KEY_LENGTH

    version = CellCacheVersion.incr_version(key)
    assert version > 0


@django_db_all(transaction=True)
def test_clear_key_with_hashed_parameters() -> None:
    cache.clear()

    @back_with_silo_cache(base_key="a" * MAX_BASE_KEY_LENGTH, silo_mode=SiloMode.CELL, t=RpcUser)
    def get_user_by_long_key(user_id: int, padding: str) -> RpcUser | None:
        results = user_service.get_many(filter=dict(user_ids=[user_id]))
        if len(results):
            return results[0]
        return None

    user = Factories.create_user()
    padding = "x" * 500

    before = get_user_by_long_key(user.id, padding)
    assert before

    with assume_test_silo_mode(SiloMode.CONTROL):
        user.update(username=user.username + "moocow")

    # Writing a version row for a hashed key must not overflow CacheVersion.key.
    cell_caching_service.clear_key(
        cell_name=get_local_cell().name,
        key=get_user_by_long_key.key_from(user.id, padding),
    )

    after = get_user_by_long_key(user.id, padding)
    assert after
    assert after.username == user.username


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
        with assume_test_silo_mode(SiloMode.CELL):
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
        last_length = 0

        while True:
            results = yield from CacheBackend.get_cache([shared_key], SiloMode.CELL)
            value = next(iter(results.values()))
            if isinstance(value, str):
                assert len(value) >= last_length, (
                    "Read after write broken -- never read a more stale value than has been observed written"
                )
                assert all(c == "a" for c in value)
            else:
                version = value
                copied_local_value = true_value
                yield
                yield from CacheBackend.set_cache(shared_key, copied_local_value, version)
                last_length = len(copied_local_value)

    def writer() -> Generator[None]:
        nonlocal true_value
        while True:
            for i in range(5):
                yield
            true_value += "a"
            yield from CacheBackend.delete_cache(shared_key, SiloMode.CELL)

    def cache_death_event() -> Generator[None]:
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

    @back_with_silo_cache_many(base_key="get_users", silo_mode=SiloMode.CELL, t=RpcUser)
    def get_users(user_ids: list[int]) -> list[RpcUser]:
        return user_service.get_many(filter=dict(user_ids=user_ids))

    users = [Factories.create_user() for _ in range(3)]
    user_ids = [u.id for u in users]

    wrapped_result = sorted(get_users(user_ids), key=lambda u: u.id)
    direct_result = sorted(get_users.cb(user_ids), key=lambda u: u.id)
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
        cell_caching_service.clear_key(
            cell_name=get_local_cell().name, key=get_users.key_from(u.id)
        )

    cached_users = sorted(get_users(user_ids), key=lambda u: u.id)
    users_by_id = sorted(users, key=lambda u: u.id)
    for user, cached in zip(users_by_id, cached_users):
        assert cached
        assert cached.username.endswith("moo")
        assert cached.username == user.username


@django_db_all(transaction=True)
def test_caching_many_partial() -> None:
    cache.clear()

    @back_with_silo_cache_many(base_key="get_users", silo_mode=SiloMode.CELL, t=RpcUser)
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

    @back_with_silo_cache_many(base_key="get_users", silo_mode=SiloMode.CELL, t=RpcUser)
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
    cache_results = _consume_generator(CacheBackend.get_cache(cache_keys, SiloMode.CELL))
    assert len(cache_results) == 3

    assert cache_results[get_users.key_from(user_ids[0])] != 0, "should be a hit"
    assert cache_results[get_users.key_from(user_ids[1])] != 0, "should be a hit"

    missing_key = user_ids[-1]
    assert cache_results[get_users.key_from(missing_key)] == 0, "should be a miss"


@django_db_all(transaction=True)
def test_caching_many_versioning() -> None:
    cache.clear()

    @back_with_silo_cache_many(base_key="get_users", silo_mode=SiloMode.CELL, t=RpcUser)
    def get_users(user_ids: list[int]) -> list[RpcUser]:
        return user_service.get_many(filter=dict(user_ids=user_ids))

    users = [Factories.create_user() for _ in range(2)]
    user_ids = [u.id for u in users]
    cache_keys = [get_users.key_from(id) for id in user_ids]
    before_results = get_users(user_ids)
    assert len(before_results) == 2

    # Clear cache to simulate outbox processing
    for user in users:
        cell_caching_service.clear_key(
            cell_name=get_local_cell().name, key=get_users.key_from(user.id)
        )

    # Read from the cache directly and drain the generator
    cache_results = _consume_generator(CacheBackend.get_cache(cache_keys, SiloMode.CELL))
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

    with assume_test_silo_mode(SiloMode.CELL):
        org = Factories.create_organization()
        members = [
            Factories.create_member(organization=org, user=user, role="owner") for user in users
        ]

    wrapped_result = sorted(get_org_members(org.id), key=lambda m: m.id)
    direct_result = sorted(get_org_members.cb(org.id), key=lambda m: m.id)

    assert len(wrapped_result) == len(direct_result)
    for wrapped, direct in zip(wrapped_result, direct_result):
        assert wrapped == direct

    with assume_test_silo_mode(SiloMode.CELL):
        for member in members:
            member.update(role="member")

    # Read from cache - does not include updates made to db
    after_update_wrapped = get_org_members(org.id)
    for member in after_update_wrapped:
        assert member.role == "owner"

    # DB read is updated
    after_update_direct = get_org_members.cb(org.id)
    for member in after_update_direct:
        assert member.role == "member"

    # Clear cache simulating outbox logic
    control_caching_service.clear_key(key=get_org_members.key_from(org.id))

    cached_members = get_org_members(org.id)
    assert len(cached_members) == 0, "with members updated none are owners"


@django_db_all(transaction=True)
def test_caching_function_encrypt_contents_fernet() -> None:
    cache.clear()

    @back_with_silo_cache(
        base_key="encrypted-user", silo_mode=SiloMode.CELL, t=RpcUser, encrypt_contents=True
    )
    def get_user(user_id: int) -> RpcUser | None:
        return user_service.get_many(filter=dict(user_ids=[user_id]))[0]

    user = Factories.create_user()

    with fernet_encryption():
        first = get_user(user.id)
        assert first
        assert first == get_user.cb(user.id)

        raw = _raw_cache_value(get_user.key_from(user.id), SiloMode.CELL)
        assert isinstance(raw, str)
        assert raw.startswith(f"enc:fernet:{FERNET_KEY_ID}:")
        assert user.username not in raw
        assert user.email not in raw

        # Served from cache: does not observe the update, but decrypts to the same object.
        with assume_test_silo_mode(SiloMode.CONTROL):
            user.update(username=user.username + "moocow")
        second = get_user(user.id)
        assert second == first
        assert second.username != user.username


@django_db_all(transaction=True)
def test_caching_function_default_not_encrypted() -> None:
    cache.clear()

    @back_with_silo_cache(base_key="plain-user", silo_mode=SiloMode.CELL, t=RpcUser)
    def get_user(user_id: int) -> RpcUser | None:
        return user_service.get_many(filter=dict(user_ids=[user_id]))[0]

    user = Factories.create_user()

    with fernet_encryption():
        result = get_user(user.id)
        assert result

        raw = _raw_cache_value(get_user.key_from(user.id), SiloMode.CELL)
        assert isinstance(raw, str)
        assert not raw.startswith("enc:")
        assert json.loads(raw) == json.loads(result.json())


@django_db_all(transaction=True)
def test_caching_function_encrypt_contents_corrupt_ciphertext() -> None:
    cache.clear()

    @back_with_silo_cache(
        base_key="encrypted-user", silo_mode=SiloMode.CELL, t=RpcUser, encrypt_contents=True
    )
    def get_user(user_id: int) -> RpcUser | None:
        return user_service.get_many(filter=dict(user_ids=[user_id]))[0]

    user = Factories.create_user()
    key = get_user.key_from(user.id)
    garbage = base64.b64encode(b"not a fernet token").decode("ascii")

    with fernet_encryption():
        primed = get_user(user.id)
        assert primed
        version_before = _cache_version(key, SiloMode.CELL)

        # Ciphertext that fails authentication under a known key.
        _overwrite_cache_value(key, f"enc:fernet:{FERNET_KEY_ID}:{garbage}", SiloMode.CELL)
        result = get_user(user.id)
        assert result == get_user.cb(user.id)
        assert _cache_version(key, SiloMode.CELL) == version_before + 1

        raw = _raw_cache_value(key, SiloMode.CELL)
        assert isinstance(raw, str)
        assert raw.startswith(f"enc:fernet:{FERNET_KEY_ID}:")
        assert get_user(user.id) == result

        # Ciphertext referencing a key this process does not have.
        _overwrite_cache_value(key, f"enc:fernet:unknown-key:{garbage}", SiloMode.CELL)
        result = get_user(user.id)
        assert result == get_user.cb(user.id)
        assert _cache_version(key, SiloMode.CELL) == version_before + 2

        # Valid ciphertext whose plaintext is not valid UTF-8.
        token = FernetKeyStore.get_fernet_for_key_id(FERNET_KEY_ID).encrypt(b"\xff\xfe")
        non_utf8 = base64.b64encode(token).decode("ascii")
        _overwrite_cache_value(key, f"enc:fernet:{FERNET_KEY_ID}:{non_utf8}", SiloMode.CELL)
        result = get_user(user.id)
        assert result == get_user.cb(user.id)
        assert _cache_version(key, SiloMode.CELL) == version_before + 3


@django_db_all(transaction=True)
def test_caching_function_encrypt_contents_reads_legacy_plain_json() -> None:
    cache.clear()

    @back_with_silo_cache(
        base_key="encrypted-user", silo_mode=SiloMode.CELL, t=RpcUser, encrypt_contents=True
    )
    def get_user(user_id: int) -> RpcUser | None:
        return user_service.get_many(filter=dict(user_ids=[user_id]))[0]

    user = Factories.create_user()
    key = get_user.key_from(user.id)
    rpc_user = user_service.get_many(filter=dict(user_ids=[user.id]))[0]

    with fernet_encryption():
        # An entry written before encryption was enabled.
        _overwrite_cache_value(key, rpc_user.json(), SiloMode.CELL)
        version_before = _cache_version(key, SiloMode.CELL)

        with assume_test_silo_mode(SiloMode.CONTROL):
            user.update(username=user.username + "moocow")

        result = get_user(user.id)
        assert result == rpc_user, "legacy entry should be served from cache, not refetched"
        assert result.username != user.username
        assert _cache_version(key, SiloMode.CELL) == version_before


@django_db_all(transaction=True)
def test_caching_function_unencrypted_reads_encrypted_value() -> None:
    cache.clear()

    @back_with_silo_cache(base_key="plain-user", silo_mode=SiloMode.CELL, t=RpcUser)
    def get_user(user_id: int) -> RpcUser | None:
        return user_service.get_many(filter=dict(user_ids=[user_id]))[0]

    user = Factories.create_user()
    key = get_user.key_from(user.id)
    rpc_user = user_service.get_many(filter=dict(user_ids=[user.id]))[0]

    with fernet_encryption():
        # An entry written while encrypt_contents was enabled, read after rollback.
        encrypted = CacheEncrypter.encrypt(rpc_user.json(), EncryptionMethod.FERNET)
        _overwrite_cache_value(key, encrypted, SiloMode.CELL)
        version_before = _cache_version(key, SiloMode.CELL)

        result = get_user(user.id)
        assert result == get_user.cb(user.id)
        assert _cache_version(key, SiloMode.CELL) == version_before + 1

        raw = _raw_cache_value(key, SiloMode.CELL)
        assert isinstance(raw, str)
        assert not raw.startswith("enc:")


@django_db_all(transaction=True)
def test_caching_many_encrypt_contents_fernet() -> None:
    cache.clear()

    @back_with_silo_cache_many(
        base_key="encrypted-users", silo_mode=SiloMode.CELL, t=RpcUser, encrypt_contents=True
    )
    def get_users(user_ids: list[int]) -> list[RpcUser]:
        return user_service.get_many(filter=dict(user_ids=user_ids))

    users = [Factories.create_user() for _ in range(3)]
    user_ids = [u.id for u in users]

    with fernet_encryption():
        # Partial hit: prime one entry, then fetch all.
        single = get_users([user_ids[0]])
        assert len(single) == 1
        assert single[0].id == user_ids[0]

        wrapped_result = get_users(user_ids)
        direct_result = sorted(get_users.cb(user_ids), key=lambda u: u.id)
        assert [u.id for u in wrapped_result] == user_ids
        assert sorted(wrapped_result, key=lambda u: u.id) == direct_result

        for user in users:
            raw = _raw_cache_value(get_users.key_from(user.id), SiloMode.CELL)
            assert isinstance(raw, str)
            assert raw.startswith(f"enc:fernet:{FERNET_KEY_ID}:")
            assert user.username not in raw

        # Full hit decrypts every entry.
        assert get_users(user_ids) == wrapped_result


@django_db_all(transaction=True)
def test_caching_many_encrypt_contents_reads_legacy_plain_json() -> None:
    cache.clear()

    @back_with_silo_cache_many(
        base_key="encrypted-users", silo_mode=SiloMode.CELL, t=RpcUser, encrypt_contents=True
    )
    def get_users(user_ids: list[int]) -> list[RpcUser]:
        return user_service.get_many(filter=dict(user_ids=user_ids))

    users = [Factories.create_user() for _ in range(2)]
    user_ids = [u.id for u in users]
    legacy_user = user_service.get_many(filter=dict(user_ids=[user_ids[0]]))[0]
    legacy_key = get_users.key_from(legacy_user.id)

    with fernet_encryption():
        # An entry written before encryption was enabled.
        _overwrite_cache_value(legacy_key, legacy_user.json(), SiloMode.CELL)
        version_before = _cache_version(legacy_key, SiloMode.CELL)

        with assume_test_silo_mode(SiloMode.CONTROL):
            users[0].update(username=users[0].username + "moocow")

        result = get_users(user_ids)
        assert [u.id for u in result] == user_ids
        assert result[0] == legacy_user, "legacy entry should be served from cache"
        assert _cache_version(legacy_key, SiloMode.CELL) == version_before

        raw = _raw_cache_value(get_users.key_from(user_ids[1]), SiloMode.CELL)
        assert isinstance(raw, str)
        assert raw.startswith(f"enc:fernet:{FERNET_KEY_ID}:")


@django_db_all(transaction=True)
def test_caching_function_encrypt_contents_without_primary_key_returns_result() -> None:
    cache.clear()

    @back_with_silo_cache(
        base_key="encrypted-user", silo_mode=SiloMode.CELL, t=RpcUser, encrypt_contents=True
    )
    def get_user(user_id: int) -> RpcUser | None:
        return user_service.get_many(filter=dict(user_ids=[user_id]))[0]

    user = Factories.create_user()

    with (
        fernet_encryption(),
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": None}),
    ):
        # A cache write failure must not lose the RPC result.
        result = get_user(user.id)
        assert result == get_user.cb(user.id)
        assert _raw_cache_value(get_user.key_from(user.id), SiloMode.CELL) is None


@django_db_all(transaction=True)
def test_caching_many_encrypt_contents_without_primary_key_returns_result() -> None:
    cache.clear()

    @back_with_silo_cache_many(
        base_key="encrypted-users", silo_mode=SiloMode.CELL, t=RpcUser, encrypt_contents=True
    )
    def get_users(user_ids: list[int]) -> list[RpcUser]:
        return user_service.get_many(filter=dict(user_ids=user_ids))

    users = [Factories.create_user() for _ in range(2)]
    user_ids = [u.id for u in users]

    with (
        fernet_encryption(),
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": None}),
    ):
        result = get_users(user_ids)
        assert [u.id for u in result] == user_ids
        assert _raw_cache_value(get_users.key_from(user_ids[0]), SiloMode.CELL) is None
        assert _raw_cache_value(get_users.key_from(user_ids[1]), SiloMode.CELL) is None


@control_silo_test
@django_db_all(transaction=True)
def test_caching_list_encrypt_contents_fernet() -> None:
    cache.clear()

    @back_with_silo_cache_list(
        base_key="encrypted-owner-members",
        silo_mode=SiloMode.CONTROL,
        t=RpcOrganizationMember,
        encrypt_contents=True,
    )
    def get_org_members(organization_id: int) -> list[RpcOrganizationMember]:
        return organization_service.get_organization_owner_members(organization_id=organization_id)

    users = [Factories.create_user() for _ in range(3)]

    with assume_test_silo_mode(SiloMode.CELL):
        org = Factories.create_organization()
        for user in users:
            Factories.create_member(organization=org, user=user, role="owner")

    with fernet_encryption():
        wrapped_result = sorted(get_org_members(org.id), key=lambda m: m.id)
        direct_result = sorted(get_org_members.cb(org.id), key=lambda m: m.id)
        assert len(wrapped_result) == 3
        assert wrapped_result == direct_result

        raw = _raw_cache_value(get_org_members.key_from(org.id), SiloMode.CONTROL)
        assert isinstance(raw, str)
        assert raw.startswith(f"enc:fernet:{FERNET_KEY_ID}:")
        for user in users:
            assert user.email not in raw

        assert sorted(get_org_members(org.id), key=lambda m: m.id) == wrapped_result


@control_silo_test
@django_db_all(transaction=True)
def test_caching_list_encrypt_contents_reads_legacy_plain_json() -> None:
    cache.clear()

    @back_with_silo_cache_list(
        base_key="encrypted-owner-members",
        silo_mode=SiloMode.CONTROL,
        t=RpcOrganizationMember,
        encrypt_contents=True,
    )
    def get_org_members(organization_id: int) -> list[RpcOrganizationMember]:
        return organization_service.get_organization_owner_members(organization_id=organization_id)

    users = [Factories.create_user() for _ in range(2)]

    with assume_test_silo_mode(SiloMode.CELL):
        org = Factories.create_organization()
        members = [
            Factories.create_member(organization=org, user=user, role="owner") for user in users
        ]

    key = get_org_members.key_from(org.id)
    legacy_members = get_org_members.cb(org.id)

    with fernet_encryption():
        # An entry written before encryption was enabled.
        _overwrite_cache_value(
            key, json.dumps([m.dict() for m in legacy_members]), SiloMode.CONTROL
        )
        version_before = _cache_version(key, SiloMode.CONTROL)

        with assume_test_silo_mode(SiloMode.CELL):
            for member in members:
                member.update(role="member")

        result = get_org_members(org.id)
        assert result == legacy_members, "legacy entry should be served from cache"
        assert _cache_version(key, SiloMode.CONTROL) == version_before


@control_silo_test
@django_db_all(transaction=True)
def test_caching_list_encrypt_contents_without_primary_key_returns_result() -> None:
    cache.clear()

    @back_with_silo_cache_list(
        base_key="encrypted-owner-members",
        silo_mode=SiloMode.CONTROL,
        t=RpcOrganizationMember,
        encrypt_contents=True,
    )
    def get_org_members(organization_id: int) -> list[RpcOrganizationMember]:
        return organization_service.get_organization_owner_members(organization_id=organization_id)

    user = Factories.create_user()

    with assume_test_silo_mode(SiloMode.CELL):
        org = Factories.create_organization()
        Factories.create_member(organization=org, user=user, role="owner")

    with (
        fernet_encryption(),
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": None}),
    ):
        result = get_org_members(org.id)
        assert result == get_org_members.cb(org.id)
        assert _raw_cache_value(get_org_members.key_from(org.id), SiloMode.CONTROL) is None
