from sentry.relay.projectconfig_debounce_cache.redis import RedisProjectConfigDebounceCache


def test_key_lifecycle():
    # This lifecycle checks and inserts in one operation.
    cache = RedisProjectConfigDebounceCache()
    kwargs = {
        "public_key": "abc",
        "project_id": None,
        "organization_id": None,
    }

    assert not cache.is_debounced(**kwargs)
    cache.debounce(**kwargs)

    assert cache.is_debounced(**kwargs)

    cache.mark_task_done(**kwargs)
    assert not cache.is_debounced(**kwargs)


def test_split_debounce_lifecycle():
    # The lifecycle where checking and inserting is done separately like in the
    # sentry.tasks.relay.* tasks.
    cache = RedisProjectConfigDebounceCache()
    kwargs = {
        "public_key": "abc",
        "project_id": None,
        "organization_id": None,
    }

    assert not cache.is_debounced(**kwargs)

    cache.debounce(**kwargs)
    assert cache.is_debounced(**kwargs)

    # This could happen in a race, should be idempotent.
    cache.debounce(**kwargs)
    assert cache.is_debounced(**kwargs)

    cache.mark_task_done(**kwargs)
    assert not cache.is_debounced(**kwargs)

    # This shouldn't normally happen, still better to be idempotent.
    cache.mark_task_done(**kwargs)
    assert not cache.is_debounced(**kwargs)


def test_default_prefix():
    cache = RedisProjectConfigDebounceCache()
    kwargs = {
        "public_key": "abc",
        "project_id": None,
        "organization_id": None,
    }

    cache.debounce(**kwargs)

    expected_key = "relayconfig-debounce:k:abc"
    redis = cache._get_redis_client(expected_key)

    assert redis.get(expected_key) == b"1"


def test_custom_prefix():
    cache = RedisProjectConfigDebounceCache(key_prefix="hello:world")
    kwargs = {
        "public_key": "abc",
        "project_id": None,
        "organization_id": None,
    }

    cache.debounce(**kwargs)

    expected_key = "hello:world:k:abc"
    redis = cache._get_redis_client(expected_key)

    assert redis.get(expected_key) == b"1"
