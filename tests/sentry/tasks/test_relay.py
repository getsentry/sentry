from __future__ import absolute_import

import pytest

from sentry.utils.compat.mock import patch

from sentry.tasks.relay import schedule_update_config_cache
from sentry.relay.projectconfig_cache.redis import RedisProjectConfigCache
from sentry.relay.projectconfig_debounce_cache.redis import RedisProjectConfigDebounceCache

from sentry.models import ProjectKey


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

    debounce_cache = RedisProjectConfigDebounceCache()
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.mark_task_done", debounce_cache.mark_task_done
    )
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.check_is_debounced",
        debounce_cache.check_is_debounced,
    )

    return cache


@pytest.mark.django_db
def test_no_cache(monkeypatch, default_project):
    def apply_async(*a, **kw):
        assert False

    monkeypatch.setattr("sentry.tasks.relay.update_config_cache.apply_async", apply_async)
    schedule_update_config_cache(generate=True, project_id=default_project.id)


@pytest.mark.django_db
def test_debounce(monkeypatch, default_project, default_organization, redis_cache):
    tasks = []

    def apply_async(args, kwargs):
        assert not args
        tasks.append(kwargs)

    monkeypatch.setattr("sentry.tasks.relay.update_config_cache.apply_async", apply_async)

    schedule_update_config_cache(generate=True, project_id=default_project.id)
    schedule_update_config_cache(generate=False, project_id=default_project.id)

    schedule_update_config_cache(generate=True, organization_id=default_organization.id)
    schedule_update_config_cache(generate=False, organization_id=default_organization.id)

    assert tasks == [
        {
            "generate": True,
            "project_id": default_project.id,
            "organization_id": None,
            "update_reason": None,
        },
        {
            "generate": True,
            "project_id": None,
            "organization_id": default_organization.id,
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
    task_runner,
    entire_organization,
    redis_cache,
):
    assert not redis_cache.get(default_project.id)

    if not entire_organization:
        kwargs = {"project_id": default_project.id}
    else:
        kwargs = {"organization_id": default_organization.id}

    with task_runner():
        schedule_update_config_cache(generate=True, **kwargs)

    cfg = redis_cache.get(default_project.id)

    assert cfg["organizationId"] == default_organization.id
    assert cfg["projectId"] == default_project.id
    assert cfg["publicKeys"] == [
        {
            "publicKey": default_projectkey.public_key,
            "isEnabled": True,
            "numericId": default_projectkey.id,
            "quotas": [],
        }
    ]


@pytest.mark.django_db
@pytest.mark.parametrize("entire_organization", (True, False))
def test_invalidate(
    monkeypatch,
    default_project,
    default_organization,
    task_runner,
    entire_organization,
    redis_cache,
):

    cfg = {"foo": "bar"}
    redis_cache.set_many({default_project.id: cfg})
    assert redis_cache.get(default_project.id) == cfg

    if not entire_organization:
        kwargs = {"project_id": default_project.id}
    else:
        kwargs = {"organization_id": default_organization.id}

    with task_runner():
        schedule_update_config_cache(generate=False, **kwargs)

    assert not redis_cache.get(default_project.id)


@pytest.mark.django_db
def test_project_update_option(default_project, task_runner, redis_cache):
    with task_runner():
        default_project.update_option(
            "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
        )

    assert redis_cache.get(default_project.id)["config"]["piiConfig"] == {
        "applications": {"$string": ["@creditcard:mask"]}
    }

    with task_runner():
        default_project.organization.update_option(
            "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
        )

    assert redis_cache.get(default_project.id) is None


@pytest.mark.django_db
def test_project_delete_option(default_project, task_runner, redis_cache):
    with task_runner():
        default_project.delete_option("sentry:relay_pii_config")

    assert redis_cache.get(default_project.id)["config"]["piiConfig"] == {}


@pytest.mark.django_db
def test_project_get_option_does_not_reload(default_project, task_runner, monkeypatch):
    from sentry.models import ProjectOption

    ProjectOption.objects._option_cache.clear()

    with task_runner():
        with patch("sentry.models.projectoption.cache.get", return_value=None):
            with patch(
                "sentry.models.projectoption.schedule_update_config_cache"
            ) as update_config_cache:
                default_project.get_option(
                    "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
                )

    update_config_cache.assert_not_called()  # noqa


@pytest.mark.django_db
def test_projectkeys(default_project, task_runner, redis_cache):
    with task_runner():
        ProjectKey.objects.filter(project=default_project).delete()
        pk = ProjectKey(project=default_project)
        pk.save()

    (pk_json,) = redis_cache.get(default_project.id)["publicKeys"]
    assert pk_json["publicKey"] == pk.public_key
    assert pk_json["isEnabled"]

    with task_runner():
        pk.delete()

    assert not redis_cache.get(default_project.id)["publicKeys"]
