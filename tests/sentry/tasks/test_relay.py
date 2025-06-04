import contextlib
from unittest import mock
from unittest.mock import call, patch

import pytest
from django.db import router, transaction

from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.models.options.project_option import ProjectOption
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus
from sentry.relay.projectconfig_cache.redis import RedisProjectConfigCache
from sentry.relay.projectconfig_debounce_cache.redis import RedisProjectConfigDebounceCache
from sentry.tasks.relay import (
    _schedule_invalidate_project_config,
    build_project_config,
    invalidate_project_config,
    schedule_build_project_config,
    schedule_invalidate_project_config,
)
from sentry.testutils.helpers.task_runner import BurstTaskRunner
from sentry.testutils.hybrid_cloud import simulated_transaction_watermarks
from sentry.testutils.pytest.fixtures import django_db_all


def _cache_keys_for_project(project):
    for key in ProjectKey.objects.filter(project_id=project.id):
        yield key.public_key


@pytest.fixture(autouse=True)
def disable_auto_on_commit():
    simulated_transaction_watermarks.state["default"] = -1
    with in_test_hide_transaction_boundary():
        yield


@pytest.fixture
def emulate_transactions(django_capture_on_commit_callbacks):
    # This contraption helps in testing the usage of `transaction.on_commit` in
    # schedule_build_project_config. Normally tests involving transactions would
    # require us to use the transactional testcase (or
    # `pytest.mark.django_db(transaction=True)`), but that incurs a 2x slowdown
    # in test speed and we're trying to keep our testcases fast.
    @contextlib.contextmanager
    def inner(assert_num_callbacks=1):
        with BurstTaskRunner() as burst:
            with django_capture_on_commit_callbacks(execute=True) as callbacks:
                yield

                # Assert there are no relay-related jobs in the queue yet, as we should have
                # some on_commit callbacks instead. If we don't, then the model
                # hook has scheduled the build_project_config task prematurely.
                #
                # Remove any other jobs from the queue that may have been triggered via model hooks
                assert not any("relay" in task.__name__ for task, _, _ in burst.queue)
                burst.queue.clear()

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
            burst(max_jobs=20)

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

    return cache


@pytest.fixture
def debounce_cache(monkeypatch):
    monkeypatch.setattr(
        "django.conf.settings.SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE",
        "sentry.relay.projectconfig_debounce_cache.redis.RedisProjectConfigDebounceCache",
    )

    cache = RedisProjectConfigDebounceCache()
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.backend.mark_task_done", cache.mark_task_done
    )
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.backend.debounce", cache.debounce
    )
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.backend.is_debounced", cache.is_debounced
    )

    return cache


@pytest.fixture
def invalidation_debounce_cache(monkeypatch):
    debounce_cache = RedisProjectConfigDebounceCache()
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.invalidation.mark_task_done",
        debounce_cache.mark_task_done,
    )
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.invalidation.debounce",
        debounce_cache.debounce,
    )
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.invalidation.is_debounced",
        debounce_cache.is_debounced,
    )

    return debounce_cache


@django_db_all
def test_debounce(
    monkeypatch,
    default_projectkey,
    default_organization,
    debounce_cache,
    django_cache,
):
    tasks = []

    def apply_async(args, kwargs):
        assert not args
        tasks.append(kwargs)

    monkeypatch.setattr("sentry.tasks.relay.build_project_config.apply_async", apply_async)

    schedule_build_project_config(public_key=default_projectkey.public_key)
    schedule_build_project_config(public_key=default_projectkey.public_key)

    assert len(tasks) == 1
    assert tasks[0]["public_key"] == default_projectkey.public_key


@django_db_all
def test_generate(
    monkeypatch,
    default_project,
    default_organization,
    default_projectkey,
    redis_cache,
    django_cache,
):
    # redis_cache.delete_many([default_projectkey.public_key])
    assert not redis_cache.get(default_projectkey.public_key)

    build_project_config(default_projectkey.public_key)

    cfg = redis_cache.get(default_projectkey.public_key)

    assert cfg["organizationId"] == default_organization.id
    assert cfg["projectId"] == default_project.id
    assert cfg["publicKeys"] == [
        {
            "isEnabled": True,
            "publicKey": default_projectkey.public_key,
            "numericId": default_projectkey.id,
        }
    ]


@django_db_all
def test_project_update_option(
    default_projectkey,
    default_project,
    emulate_transactions,
    redis_cache,
    django_cache,
):
    # Put something in the cache, otherwise triggers/the invalidation task won't compute
    # anything.
    redis_cache.set_many({default_projectkey.public_key: {"dummy": "dummy"}})

    # XXX: there should only be one hook triggered, regardless of debouncing
    with emulate_transactions(assert_num_callbacks=2):
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

    # They should be recalculated.  Note that oddly enough we actually get the same rule
    # twice.  once for the org and once for the project
    for cache_key in _cache_keys_for_project(default_project):
        cache = redis_cache.get(cache_key)
        assert cache["config"]["piiConfig"]["applications"] == {
            "$string": ["@creditcard:mask", "@creditcard:mask"]
        }


@django_db_all
def test_project_delete_option(
    default_projectkey,
    default_project,
    emulate_transactions,
    redis_cache,
    django_cache,
):
    # Put something in the cache, otherwise triggers/the invalidation task won't compute
    # anything.
    redis_cache.set_many({default_projectkey.public_key: {"dummy": "dummy"}})

    # XXX: there should only be one hook triggered, regardless of debouncing
    with emulate_transactions(assert_num_callbacks=1):
        default_project.delete_option("sentry:relay_pii_config")

    assert redis_cache.get(default_projectkey)["config"]["piiConfig"] == {}


@django_db_all
def test_project_get_option_does_not_reload(
    default_project,
    emulate_transactions,
    monkeypatch,
    django_cache,
):
    ProjectOption.objects._option_cache.clear()
    with emulate_transactions(assert_num_callbacks=0):
        with patch("sentry.utils.cache.cache.get", return_value=None):
            with patch("sentry.tasks.relay.schedule_build_project_config") as build_project_config:
                default_project.get_option(
                    "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
                )

    assert not build_project_config.called


@django_db_all
def test_invalidation_project_deleted(
    default_project,
    emulate_transactions,
    redis_cache,
    django_cache,
):
    # Ensure we have a ProjectKey
    project_key = next(_cache_keys_for_project(default_project))
    assert project_key

    # Ensure we have a config in the cache.
    build_project_config(public_key=project_key)
    assert redis_cache.get(project_key)["disabled"] is False

    project_id = default_project.id

    # Delete the project normally, this will delete it from the cache
    with emulate_transactions(assert_num_callbacks=4):
        default_project.delete()
    assert redis_cache.get(project_key)["disabled"]

    # Duplicate invoke the invalidation task, this needs to be fine with the missing project.
    invalidate_project_config(project_id=project_id, trigger="testing-double-delete")
    assert redis_cache.get(project_key)["disabled"]


@django_db_all
def test_projectkeys(
    default_project,
    emulate_transactions,
    redis_cache,
    django_cache,
):
    # When a projectkey is deleted the invalidation task should be triggered and the project
    # should be cached as disabled.

    # XXX: there should only be one hook triggered, regardless of debouncing
    with emulate_transactions(assert_num_callbacks=2):
        deleted_pks = list(ProjectKey.objects.filter(project=default_project))
        for key in deleted_pks:
            key.delete()

        pk = ProjectKey(project=default_project)
        pk.save()

    for key in deleted_pks:
        assert redis_cache.get(key.public_key)["disabled"]

    (pk_json,) = redis_cache.get(pk.public_key)["publicKeys"]
    assert pk_json["publicKey"] == pk.public_key

    with emulate_transactions():
        pk.status = ProjectKeyStatus.INACTIVE
        pk.save()

    assert redis_cache.get(pk.public_key)["disabled"]

    with emulate_transactions():
        pk.delete()

    assert redis_cache.get(pk.public_key)["disabled"]

    for key in ProjectKey.objects.filter(project_id=default_project.id):
        assert not redis_cache.get(key.public_key)


@django_db_all(transaction=True)
def test_db_transaction(
    default_project,
    default_projectkey,
    redis_cache,
    task_runner,
    django_cache,
):
    # Put something in the cache, otherwise triggers/the invalidation task won't compute
    # anything.
    redis_cache.set_many({default_projectkey.public_key: {"dummy": "dummy"}})

    with task_runner(), transaction.atomic(router.db_for_write(ProjectOption)):
        default_project.update_option(
            "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
        )

        # Assert that cache entry hasn't been created yet, only after the
        # transaction has committed.
        assert redis_cache.get(default_projectkey.public_key) == {"dummy": "dummy"}

    assert redis_cache.get(default_projectkey.public_key)["config"]["piiConfig"] == {
        "applications": {"$string": ["@creditcard:mask"]}
    }

    try:
        with task_runner(), transaction.atomic(router.db_for_write(ProjectOption)):
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


@django_db_all(transaction=True)
class TestInvalidationTask:
    def test_debounce(
        self,
        monkeypatch,
        default_project,
        default_organization,
        invalidation_debounce_cache,
        django_cache,
    ):
        tasks = []

        def apply_async(args=None, kwargs=None, countdown=None):
            assert not args
            tasks.append(kwargs)

        monkeypatch.setattr("sentry.tasks.relay.invalidate_project_config.apply_async", apply_async)

        invalidation_debounce_cache.mark_task_done(
            public_key=None, project_id=default_project.id, organization_id=None
        )
        schedule_invalidate_project_config(project_id=default_project.id, trigger="test")
        schedule_invalidate_project_config(project_id=default_project.id, trigger="test")

        invalidation_debounce_cache.mark_task_done(
            public_key=None, project_id=None, organization_id=default_organization.id
        )
        schedule_invalidate_project_config(organization_id=default_organization.id, trigger="test")
        schedule_invalidate_project_config(organization_id=default_organization.id, trigger="test")

        assert tasks == [
            {
                "project_id": default_project.id,
                "organization_id": None,
                "public_key": None,
                "trigger": "test",
            },
            {
                "project_id": None,
                "organization_id": default_organization.id,
                "public_key": None,
                "trigger": "test",
            },
        ]

    def test_invalidate(
        self,
        monkeypatch,
        default_project,
        default_organization,
        default_projectkey,
        task_runner,
        redis_cache,
        django_cache,
    ):
        cfg = {"dummy-key": "val"}
        redis_cache.set_many({default_projectkey.public_key: cfg})
        assert redis_cache.get(default_projectkey.public_key) == cfg

        with task_runner():
            schedule_invalidate_project_config(project_id=default_project.id, trigger="test")

        for cache_key in _cache_keys_for_project(default_project):
            cfg_from_cache = redis_cache.get(cache_key)
            assert "dummy-key" not in cfg_from_cache
            assert cfg_from_cache["disabled"] is False
            assert cfg_from_cache["projectId"] == default_project.id

    def test_invalidate_org(
        self,
        monkeypatch,
        default_project,
        default_organization,
        default_projectkey,
        redis_cache,
        task_runner,
        django_cache,
    ):
        # Currently for org-wide we delete the config instead of computing it.
        cfg = {"dummy-key": "val"}
        redis_cache.set_many({default_projectkey.public_key: cfg})
        assert redis_cache.get(default_projectkey.public_key) == cfg

        with task_runner():
            schedule_invalidate_project_config(
                organization_id=default_organization.id, trigger="test"
            )

        for cache_key in _cache_keys_for_project(default_project):
            new_cfg = redis_cache.get(cache_key)
            assert new_cfg is not None
            assert new_cfg != cfg

    @mock.patch(
        "sentry.tasks.relay._schedule_invalidate_project_config",
        wraps=_schedule_invalidate_project_config,
    )
    @mock.patch("django.db.transaction.on_commit", wraps=transaction.on_commit)
    def test_project_config_invalidations_after_commit(
        self,
        oncommit,
        schedule_inner,
        default_project,
    ):
        schedule_invalidate_project_config(
            trigger="test", project_id=default_project.id, countdown=2
        )

        assert oncommit.call_count == 1
        assert schedule_inner.call_count == 1
        assert schedule_inner.call_args == call(
            trigger="test",
            organization_id=None,
            project_id=default_project.id,
            public_key=None,
            countdown=2,
        )

    @mock.patch("sentry.tasks.relay._schedule_invalidate_project_config")
    def test_project_config_invalidations_delayed(
        self,
        schedule_inner,
        default_project,
    ):
        with transaction.atomic(router.db_for_write(ProjectOption)):
            schedule_invalidate_project_config(
                trigger="inside-transaction", project_id=default_project, countdown=2
            )
            assert schedule_inner.call_count == 0

        assert schedule_inner.call_count == 1
        schedule_invalidate_project_config(
            trigger="outside-transaction", project_id=default_project, countdown=2
        )
        assert schedule_inner.call_count == 2


@django_db_all(transaction=True)
def test_invalidate_hierarchy(
    monkeypatch,
    default_project,
    default_projectkey,
    redis_cache,
    debounce_cache,
    invalidation_debounce_cache,
    django_cache,
):
    # Put something in the cache, otherwise the invalidation task won't compute anything.
    redis_cache.set_many({default_projectkey.public_key: {"dummy": "dummy"}})

    orig_apply_async = invalidate_project_config.apply_async
    calls = []

    def proxy(*args, **kwargs):
        calls.append((args, kwargs))
        orig_apply_async(*args, **kwargs)

    monkeypatch.setattr(invalidate_project_config, "apply_async", proxy)

    with BurstTaskRunner() as run:
        schedule_invalidate_project_config(
            organization_id=default_project.organization.id, trigger="test"
        )
        schedule_invalidate_project_config(project_id=default_project.id, trigger="test")
        run(max_jobs=10)

    assert len(calls) == 1
    cache = redis_cache.get(default_projectkey)
    assert cache["disabled"] is False
