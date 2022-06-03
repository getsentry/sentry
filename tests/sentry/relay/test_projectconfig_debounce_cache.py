from sentry.relay.projectconfig_debounce_cache.redis import RedisProjectConfigDebounceCache


def test_key_lifecycle():
    # This lifecycle checks and inserts in one operation.
    cache = RedisProjectConfigDebounceCache()
    kwargs = {
        "public_key": "abc",
        "project_id": None,
        "organization_id": None,
    }

    assert not cache.check_is_debounced(**kwargs)

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

    cache.mark_task_done(**kwargs)
    assert not cache.is_debounced(**kwargs)
