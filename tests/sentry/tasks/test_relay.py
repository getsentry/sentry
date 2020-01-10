from __future__ import absolute_import

import pytest

from sentry.tasks.relay import schedule_update_config_cache
from sentry.relay.config import ProjectConfig


@pytest.fixture
def redis_cache(monkeypatch):
    monkeypatch.setattr(
        "django.conf.settings.SENTRY_RELAY_PROJECTCONFIG_CACHE",
        "sentry.relay.projectconfig_cache.redis.RedisProjectConfigCache",
    )

    from sentry.relay import projectconfig_cache

    return projectconfig_cache


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
        {"generate": True, "project_id": default_project.id, "organization_id": None},
        {"generate": True, "project_id": None, "organization_id": default_organization.id},
    ]


@pytest.mark.django_db
@pytest.mark.parametrize("entire_organization", (True, False))
def test_generate(
    monkeypatch,
    default_project,
    default_organization,
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

    redis_cache.set_many([ProjectConfig(default_project, foo="bar")])
    assert redis_cache.get(default_project.id) == {"foo": "bar"}

    if not entire_organization:
        kwargs = {"project_id": default_project.id}
    else:
        kwargs = {"organization_id": default_organization.id}

    with task_runner():
        schedule_update_config_cache(generate=False, **kwargs)

    assert not redis_cache.get(default_project.id)
