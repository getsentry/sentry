from unittest.mock import patch

import pytest

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


@pytest.mark.django_db
def test_debounce(
    monkeypatch,
    default_projectkey,
    default_organization,
    debounce_cache,
):
    tasks = []

    def apply_async(args, kwargs):
        assert not args
        tasks.append(kwargs)

    monkeypatch.setattr("sentry.tasks.relay.build_project_config.apply_async", apply_async)

    schedule_build_project_config(public_key=default_projectkey.public_key)
    schedule_build_project_config(public_key=default_projectkey.public_key)

    assert tasks == [{"public_key": default_projectkey.public_key}]


@pytest.mark.django_db
def test_generate(
    monkeypatch,
    default_project,
    default_organization,
    default_projectkey,
    task_runner,
    redis_cache,
):
    assert not redis_cache.get(default_projectkey.public_key)

    with task_runner():
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
def test_project_update_option(default_projectkey, default_project, task_runner, redis_cache):
    with task_runner():
        default_project.update_option(
            "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
        )

    assert redis_cache.get(default_projectkey.public_key)["config"]["piiConfig"] == {
        "applications": {"$string": ["@creditcard:mask"]}
    }

    with task_runner():
        default_project.organization.update_option(
            "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
        )

    for cache_key in _cache_keys_for_project(default_project):
        assert redis_cache.get(cache_key) is None


@pytest.mark.django_db
def test_project_delete_option(default_project, task_runner, redis_cache):
    with task_runner():
        default_project.delete_option("sentry:relay_pii_config")

    for cache_key in _cache_keys_for_project(default_project):
        assert redis_cache.get(cache_key)["config"]["piiConfig"] == {}


@pytest.mark.django_db
def test_project_get_option_does_not_reload(default_project, task_runner, monkeypatch):
    ProjectOption.objects._option_cache.clear()
    with task_runner():
        with patch("sentry.utils.cache.cache.get", return_value=None):
            with patch("sentry.tasks.relay.schedule_build_project_config") as build_project_config:
                default_project.get_option(
                    "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
                )

    assert not build_project_config.called


@pytest.mark.django_db
def test_invalidation_project_deleted(default_project, task_runner, redis_cache):
    # Ensure we have a ProjectKey
    project_key = next(_cache_keys_for_project(default_project))
    assert project_key

    # Ensure we have a config in the cache.
    build_project_config(public_key=project_key)
    assert redis_cache.get(project_key)["disabled"] is False

    project_id = default_project.id

    # Delete the project normally, this will delete it from the cache
    with task_runner():
        default_project.delete()
    assert redis_cache.get(project_key) is None

    # Duplicate invoke the invalidation task, this needs to be fine with the missing project.
    invalidate_project_config(project_id=project_id, trigger="testing-double-delete")
    assert redis_cache.get(project_key) is None


@pytest.mark.django_db
def test_projectkeys(default_project, task_runner, redis_cache):
    # When a projectkey is deleted the invalidation task should be triggered and the project
    # should be cached as disabled.
    with task_runner():
        deleted_pks = list(ProjectKey.objects.filter(project=default_project))
        for key in deleted_pks:
            key.delete()

        pk = ProjectKey(project=default_project)
        pk.save()

    for key in deleted_pks:
        assert redis_cache.get(key.public_key) is None

    (pk_json,) = redis_cache.get(pk.public_key)["publicKeys"]
    assert pk_json["publicKey"] == pk.public_key

    with task_runner():
        pk.status = ProjectKeyStatus.INACTIVE
        pk.save()

    assert redis_cache.get(pk.public_key)["disabled"]

    with task_runner():
        pk.delete()

    assert redis_cache.get(pk.public_key) is None

    for key in ProjectKey.objects.filter(project_id=default_project.id):
        assert not redis_cache.get(key.public_key)


class TestInvalidationTask:
    @pytest.fixture
    def debounce_cache(self, monkeypatch):
        debounce_cache = RedisProjectConfigDebounceCache()
        monkeypatch.setattr(
            "sentry.relay.projectconfig_debounce_cache.invalidation.mark_task_done",
            debounce_cache.mark_task_done,
        )
        monkeypatch.setattr(
            "sentry.relay.projectconfig_debounce_cache.invalidation.check_is_debounced",
            debounce_cache.check_is_debounced,
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
        self,
        monkeypatch,
        default_project,
        default_organization,
        debounce_cache,
    ):
        tasks = []

        def apply_async(args, kwargs):
            assert not args
            tasks.append(kwargs)

        monkeypatch.setattr("sentry.tasks.relay.invalidate_project_config.apply_async", apply_async)

        debounce_cache.mark_task_done(
            public_key=None, project_id=default_project.id, organization_id=None
        )
        schedule_invalidate_project_config(project_id=default_project.id, trigger="test")
        schedule_invalidate_project_config(project_id=default_project.id, trigger="test")

        debounce_cache.mark_task_done(
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
        task_runner,
        redis_cache,
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
            assert redis_cache.get(cache_key) is None
