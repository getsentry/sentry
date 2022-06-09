import contextlib
from unittest.mock import patch

import pytest
from django.db import transaction

from sentry.models import ProjectKey, ProjectKeyStatus, ProjectOption
from sentry.relay.projectconfig_cache.redis import RedisProjectConfigCache
from sentry.relay.projectconfig_debounce_cache.redis import RedisProjectConfigDebounceCache
from sentry.tasks.relay import schedule_update_config_cache


def _cache_keys_for_project(project):
    for key in ProjectKey.objects.filter(project_id=project.id):
        yield key.public_key


@pytest.fixture
def emulate_transactions(burst_task_runner, django_capture_on_commit_callbacks):
    # This contraption helps in testing the usage of `transaction.on_commit` in
    # schedule_update_config_cache. Normally tests involving transactions would
    # require us to use the transactional testcase (or
    # `pytest.mark.django_db(transaction=True)`), but that incurs a 2x slowdown
    # in test speed and we're trying to keep our testcases fast.
    @contextlib.contextmanager
    def inner(assert_num_callbacks=1):
        with burst_task_runner() as burst:
            with django_capture_on_commit_callbacks(execute=True) as callbacks:
                yield

                # Assert there are no jobs in the queue yet, as we should have
                # some on_commit callbacks instead. If we don't, then the model
                # hook has scheduled the update_config_cache task
                # prematurely.
                burst(max_jobs=0)

            # for some reason, the callbacks array is only populated by
            # pytest-django's implementation after the context manager has
            # exited, not while they are being registered
            assert len(callbacks) == assert_num_callbacks

        # Callbacks have been executed, job(s) should've been scheduled now, so
        # let's execute them.
        #
        # Note: We can't directly assert that the data race has not occured, as
        # there are no real DB transactions available in this testcase. The
        # entire test runs in one transaction because that's how pytest-django
        # sets up things unless one uses
        # pytest.mark.django_db(transaction=True).
        burst(max_jobs=10)

    return inner


@pytest.fixture
def redis_cache(monkeypatch):
    monkeypatch.setattr(
        "django.conf.settings.SENTRY_RELAY_PROJECTCONFIG_CACHE",
        "sentry.relay.projectconfig_cache.redis.RedisProjectConfigCache",
    )

    cache = RedisProjectConfigCache()
    monkeypatch.setattr("sentry.relay.projectconfig_cache.set_many", cache.set_many)
    monkeypatch.setattr("sentry.relay.projectconfig_cache.delete_many", cache.delete_many)
    monkeypatch.setattr("sentry.relay.projectconfig_cache.get", cache.get)

    monkeypatch.setattr(
        "django.conf.settings.SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE",
        "sentry.relay.projectconfig_debounce_cache.redis.RedisProjectConfigDebounceCache",
    )

    return cache


@pytest.fixture
def debounce_cache(monkeypatch):
    debounce_cache = RedisProjectConfigDebounceCache()
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.mark_task_done",
        debounce_cache.mark_task_done,
    )
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.check_is_debounced",
        debounce_cache.check_is_debounced,
    )
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.debounce",
        debounce_cache.debounce,
    )
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.is_debounced",
        debounce_cache.is_debounced,
    )

    return debounce_cache


@pytest.fixture
def always_update_cache(monkeypatch):
    monkeypatch.setattr("sentry.tasks.relay.should_update_cache", lambda *args, **kwargs: True)


@pytest.mark.django_db
def test_debounce(
    monkeypatch,
    default_project,
    default_organization,
    debounce_cache,
    emulate_transactions,
):
    tasks = []

    def apply_async(args, kwargs):
        assert not args
        tasks.append(kwargs)

    monkeypatch.setattr("sentry.tasks.relay.update_config_cache.apply_async", apply_async)

    debounce_cache.mark_task_done(None, default_project.id, None)

    with emulate_transactions():
        schedule_update_config_cache(generate=True, project_id=default_project.id)
    with emulate_transactions():
        schedule_update_config_cache(generate=False, project_id=default_project.id)

    debounce_cache.mark_task_done(None, None, default_organization.id)
    with emulate_transactions():
        schedule_update_config_cache(generate=True, organization_id=default_organization.id)
    with emulate_transactions():
        schedule_update_config_cache(generate=False, organization_id=default_organization.id)

    assert tasks == [
        {
            "generate": True,
            "project_id": default_project.id,
            "organization_id": None,
            "public_key": None,
            "update_reason": None,
        },
        {
            "generate": True,
            "project_id": None,
            "organization_id": default_organization.id,
            "public_key": None,
            "update_reason": None,
        },
    ]


@pytest.mark.django_db
@pytest.mark.parametrize("entire_organization", (True, False))
def test_generate(
    monkeypatch,
    default_project,
    default_organization,
    default_projectkey,
    entire_organization,
    redis_cache,
    always_update_cache,
    emulate_transactions,
):
    assert not redis_cache.get(default_projectkey.public_key)

    if not entire_organization:
        kwargs = {"project_id": default_project.id}
    else:
        kwargs = {"organization_id": default_organization.id}

    with emulate_transactions():
        schedule_update_config_cache(generate=True, **kwargs)

    cfg = redis_cache.get(default_projectkey.public_key)

    assert cfg["organizationId"] == default_organization.id
    assert cfg["projectId"] == default_project.id
    assert cfg["publicKeys"] == [
        {
            "isEnabled": True,
            "publicKey": default_projectkey.public_key,
            "numericId": default_projectkey.id,
            "quotas": [],
        }
    ]


@pytest.mark.django_db
@pytest.mark.parametrize("entire_organization", (True, False))
def test_invalidate(
    monkeypatch,
    default_project,
    default_projectkey,
    default_organization,
    emulate_transactions,
    entire_organization,
    redis_cache,
    always_update_cache,
):

    cfg = {"foo": "bar"}
    redis_cache.set_many({default_projectkey.public_key: cfg})
    assert redis_cache.get(default_projectkey.public_key) == cfg

    if not entire_organization:
        kwargs = {"project_id": default_project.id}
    else:
        kwargs = {"organization_id": default_organization.id}

    with emulate_transactions():
        schedule_update_config_cache(generate=False, **kwargs)

    for cache_key in _cache_keys_for_project(default_project):
        assert not redis_cache.get(cache_key)


@pytest.mark.django_db
def test_project_update_option(
    default_projectkey, default_project, emulate_transactions, redis_cache
):
    # XXX: there should only be one hook triggered, regardless of debouncing
    with emulate_transactions(assert_num_callbacks=4):
        default_project.update_option(
            "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
        )

    assert redis_cache.get(default_projectkey.public_key)["config"]["piiConfig"] == {
        "applications": {"$string": ["@creditcard:mask"]}
    }

    # XXX: there should only be one hook triggered, regardless of debouncing
    with emulate_transactions(assert_num_callbacks=2):
        default_project.organization.update_option(
            "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
        )

    for cache_key in _cache_keys_for_project(default_project):
        assert redis_cache.get(cache_key) is None


@pytest.mark.django_db
def test_project_delete_option(default_project, emulate_transactions, redis_cache):
    # XXX: there should only be one hook triggered, regardless of debouncing
    with emulate_transactions(assert_num_callbacks=3):
        default_project.delete_option("sentry:relay_pii_config")

    for cache_key in _cache_keys_for_project(default_project):
        assert redis_cache.get(cache_key)["config"]["piiConfig"] == {}


@pytest.mark.django_db
def test_project_get_option_does_not_reload(default_project, emulate_transactions, monkeypatch):
    ProjectOption.objects._option_cache.clear()
    with emulate_transactions(assert_num_callbacks=0):
        with patch("sentry.utils.cache.cache.get", return_value=None):
            with patch("sentry.tasks.relay.schedule_update_config_cache") as update_config_cache:
                default_project.get_option(
                    "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
                )

    update_config_cache.assert_not_called()


@pytest.mark.xfail(reason="XXX temporarily disabled")
@pytest.mark.django_db
def test_projectkeys(default_project, emulate_transactions, redis_cache):
    with emulate_transactions():
        deleted_pks = list(ProjectKey.objects.filter(project=default_project))
        for key in deleted_pks:
            key.delete()

        pk = ProjectKey(project=default_project)
        pk.save()

    for key in deleted_pks:
        assert redis_cache.get(key.public_key) == {"disabled": True}

    (pk_json,) = redis_cache.get(pk.public_key)["publicKeys"]
    assert pk_json["publicKey"] == pk.public_key

    with emulate_transactions():
        pk.status = ProjectKeyStatus.INACTIVE
        pk.save()

    assert redis_cache.get(pk.public_key)["disabled"]

    with emulate_transactions():
        pk.delete()

    assert redis_cache.get(pk.public_key) == {"disabled": True}

    for key in ProjectKey.objects.filter(project_id=default_project.id):
        assert not redis_cache.get(key.public_key)


@pytest.mark.django_db(transaction=True)
def test_db_transaction(default_project, default_projectkey, redis_cache, task_runner):
    with task_runner(), transaction.atomic():
        default_project.update_option(
            "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
        )

        # Assert that cache entry hasn't been created yet, only after the
        # transaction has committed.
        assert not redis_cache.get(default_projectkey.public_key)

    assert redis_cache.get(default_projectkey.public_key)["config"]["piiConfig"] == {
        "applications": {"$string": ["@creditcard:mask"]}
    }

    try:
        with task_runner(), transaction.atomic():
            default_project.update_option(
                "sentry:relay_pii_config", '{"applications": {"$string": ["@password:mask"]}}'
            )

            raise Exception("rollback!")

    except Exception:
        pass

    # Assert that database rollback is honored
    assert redis_cache.get(default_projectkey.public_key)["config"]["piiConfig"] == {
        "applications": {"$string": ["@creditcard:mask"]}
    }
