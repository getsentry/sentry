import contextlib
from unittest.mock import patch

import pytest
from django.db import transaction

from sentry.models import Project, ProjectKey, ProjectKeyStatus, ProjectOption
from sentry.relay.projectconfig_cache.redis import RedisProjectConfigCache
from sentry.relay.projectconfig_debounce_cache.redis import RedisProjectConfigDebounceCache
from sentry.tasks.relay import (
    build_project_config,
    invalidate_project_config,
    schedule_build_project_config,
    schedule_invalidate_project_config,
)


def _cache_keys_for_project(project):
    for key in ProjectKey.objects.filter(project_id=project.id):
        yield key.public_key


def _cache_keys_for_org(org):
    # The `ProjectKey` model doesn't have any attribute we can use to filter by
    # org, and the `Project` model doesn't have a project key exposed. So using
    # the org we fetch the project, and then the project key.
    for proj in Project.objects.filter(organization_id=org.id):
        for key in ProjectKey.objects.filter(project_id=proj.id):
            yield key.public_key


@pytest.fixture
def emulate_transactions(burst_task_runner, django_capture_on_commit_callbacks):
    # This contraption helps in testing the usage of `transaction.on_commit` in
    # schedule_build_project_config. Normally tests involving transactions would
    # require us to use the transactional testcase (or
    # `pytest.mark.django_db(transaction=True)`), but that incurs a 2x slowdown
    # in test speed and we're trying to keep our testcases fast.
    @contextlib.contextmanager
    def inner(assert_num_callbacks=1):
        with burst_task_runner() as burst:
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

    return cache


@pytest.fixture
def debounce_cache(monkeypatch):
    monkeypatch.setattr(
        "django.conf.settings.SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE",
        "sentry.relay.projectconfig_debounce_cache.redis.RedisProjectConfigDebounceCache",
    )

    cache = RedisProjectConfigDebounceCache()
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.mark_task_done", cache.mark_task_done
    )
    monkeypatch.setattr("sentry.relay.projectconfig_debounce_cache.debounce", cache.debounce)
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.is_debounced", cache.is_debounced
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


@pytest.mark.django_db
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


@pytest.mark.django_db
def test_generate(
    monkeypatch,
    default_project,
    default_organization,
    default_projectkey,
    redis_cache,
    django_cache,
):
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
            "quotas": [],
        }
    ]


@pytest.mark.django_db
def test_project_update_option(
    default_projectkey, default_project, emulate_transactions, redis_cache, django_cache
):
    # Put something in the cache, otherwise triggers/the invalidation task won't compute
    # anything.
    redis_cache.set_many({default_projectkey.public_key: "dummy"})

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

    # They should be recalculated.  Note that oddly enough we actually get the same rule
    # twice.  once for the org and once for the project
    for cache_key in _cache_keys_for_project(default_project):
        cache = redis_cache.get(cache_key)
        assert cache["config"]["piiConfig"]["applications"] == {
            "$string": ["@creditcard:mask", "@creditcard:mask"]
        }


@pytest.mark.django_db
def test_project_delete_option(
    default_projectkey, default_project, emulate_transactions, redis_cache, django_cache
):
    # Put something in the cache, otherwise triggers/the invalidation task won't compute
    # anything.
    redis_cache.set_many({default_projectkey.public_key: "dummy"})

    # XXX: there should only be one hook triggered, regardless of debouncing
    with emulate_transactions(assert_num_callbacks=3):
        default_project.delete_option("sentry:relay_pii_config")

    assert redis_cache.get(default_projectkey)["config"]["piiConfig"] == {}


@pytest.mark.django_db
def test_project_get_option_does_not_reload(
    default_project, emulate_transactions, monkeypatch, django_cache
):
    ProjectOption.objects._option_cache.clear()
    with emulate_transactions(assert_num_callbacks=0):
        with patch("sentry.utils.cache.cache.get", return_value=None):
            with patch("sentry.tasks.relay.schedule_build_project_config") as build_project_config:
                default_project.get_option(
                    "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
                )

    assert not build_project_config.called


@pytest.mark.django_db
def test_invalidation_project_deleted(
    default_project, emulate_transactions, redis_cache, django_cache
):
    # Ensure we have a ProjectKey
    project_key = next(_cache_keys_for_project(default_project))
    assert project_key

    # Ensure we have a config in the cache.
    build_project_config(public_key=project_key)
    assert redis_cache.get(project_key)["disabled"] is False

    project_id = default_project.id

    # Delete the project normally, this will delete it from the cache
    with emulate_transactions(assert_num_callbacks=5):
        default_project.delete()
    assert redis_cache.get(project_key)["disabled"]

    # Duplicate invoke the invalidation task, this needs to be fine with the missing project.
    invalidate_project_config(project_id=project_id, trigger="testing-double-delete")
    assert redis_cache.get(project_key)["disabled"]


@pytest.mark.django_db
def test_projectkeys(default_project, emulate_transactions, redis_cache, django_cache):
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


@pytest.mark.django_db(transaction=True)
def test_db_transaction(
    default_project, default_projectkey, redis_cache, task_runner, django_cache
):
    # Put something in the cache, otherwise triggers/the invalidation task won't compute
    # anything.
    redis_cache.set_many({default_projectkey.public_key: "dummy"})

    with task_runner(), transaction.atomic():
        default_project.update_option(
            "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
        )

        # Assert that cache entry hasn't been created yet, only after the
        # transaction has committed.
        assert redis_cache.get(default_projectkey.public_key) == "dummy"

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


class TestInvalidationTask:
    @pytest.mark.django_db
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

    @pytest.mark.django_db
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
            cfg = redis_cache.get(cache_key)
            assert "dummy-key" not in cfg
            assert cfg["disabled"] is False
            assert cfg["projectId"] == default_project.id

    @pytest.mark.django_db
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


@pytest.mark.django_db
def test_invalidate_hierarchy(
    monkeypatch,
    burst_task_runner,
    default_project,
    default_projectkey,
    redis_cache,
    debounce_cache,
    invalidation_debounce_cache,
    django_cache,
):
    # Put something in the cache, otherwise the invalidation task won't compute anything.
    redis_cache.set_many({default_projectkey.public_key: "dummy"})

    orig_apply_async = invalidate_project_config.apply_async
    calls = []

    def proxy(*args, **kwargs):
        calls.append((args, kwargs))
        orig_apply_async(*args, **kwargs)

    monkeypatch.setattr(invalidate_project_config, "apply_async", proxy)

    with burst_task_runner() as run:
        schedule_invalidate_project_config(
            organization_id=default_project.organization.id, trigger="test"
        )
        schedule_invalidate_project_config(project_id=default_project.id, trigger="test")
        run(max_jobs=10)

    assert len(calls) == 1
    cache = redis_cache.get(default_projectkey)
    assert cache["disabled"] is False
