from unittest.mock import patch
from uuid import uuid4

import pytest
from django.urls import reverse
from sentry_relay.auth import generate_key_pair

from sentry.models.relay import Relay
from sentry.relay.config import ProjectConfig
from sentry.tasks.relay import update_config_cache
from sentry.utils import json


@pytest.fixture
def key_pair():
    return generate_key_pair()


@pytest.fixture
def public_key(key_pair):
    return key_pair[1]


@pytest.fixture
def private_key(key_pair):
    return key_pair[0]


@pytest.fixture
def relay_id():
    return str(uuid4())


@pytest.fixture
def relay(relay_id, public_key):
    return Relay.objects.create(relay_id=relay_id, public_key=str(public_key), is_internal=True)


@pytest.fixture
def call_endpoint(client, relay, private_key, default_projectkey):
    def inner(full_config, public_keys=None):
        path = reverse("sentry-api-0-relay-projectconfigs") + "?version=3"

        if public_keys is None:
            public_keys = [str(default_projectkey.public_key)]

        if full_config is None:
            raw_json, signature = private_key.pack({"publicKeys": public_keys, "no_cache": False})
        else:
            raw_json, signature = private_key.pack(
                {"publicKeys": public_keys, "fullConfig": full_config, "no_cache": False}
            )

        resp = client.post(
            path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=relay.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        return json.loads(resp.content), resp.status_code

    return inner


@pytest.fixture(autouse=True)
def max_sample_rate():
    from sentry import options

    options.set("relay.project-config-v3-enable", 1)


@pytest.fixture
def projectconfig_cache_get_mock_config(monkeypatch):
    monkeypatch.setattr(
        "sentry.relay.projectconfig_cache.get", lambda *args, **kwargs: {"is_mock_config": True}
    )


@pytest.fixture
def single_mock_proj_cached(monkeypatch):
    def cache_get(*args, **kwargs):
        if args[0] == "must_exist":
            return {"is_mock_config": True}
        return None

    monkeypatch.setattr("sentry.relay.projectconfig_cache.get", cache_get)


@pytest.fixture
def projectconfig_debounced_cache(monkeypatch):
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.is_debounced", lambda *args, **kargs: True
    )


@pytest.fixture
def project_config_get_mock(monkeypatch):
    monkeypatch.setattr(
        "sentry.relay.config.get_project_config",
        lambda *args, **kwargs: ProjectConfig("mock_project", is_mock_config=True),
    )


@pytest.mark.django_db
def test_return_full_config_if_in_cache(
    call_endpoint, default_projectkey, projectconfig_cache_get_mock_config
):
    result, status_code = call_endpoint(full_config=True)
    assert status_code < 400
    assert result == {
        "configs": {default_projectkey.public_key: {"is_mock_config": True}},
        "pending": [],
    }


@pytest.mark.django_db
def test_return_partial_config_if_in_cache(
    monkeypatch,
    call_endpoint,
    default_projectkey,
    default_project,
):
    # Partial configs are handled as ``v2``, even if the param is ``v3``
    monkeypatch.setattr(
        "sentry.relay.config.get_project_config",
        lambda *args, **kwargs: ProjectConfig(default_project, is_mock_config=True),
    )

    result, status_code = call_endpoint(full_config=False)
    assert status_code < 400
    expected = {
        "configs": {default_projectkey.public_key: {"is_mock_config": True}},
    }
    assert result == expected


@pytest.mark.django_db
def test_proj_in_cache_and_another_pending(
    call_endpoint, default_projectkey, single_mock_proj_cached
):
    result, status_code = call_endpoint(
        full_config=True, public_keys=["must_exist", default_projectkey.public_key]
    )
    assert status_code < 400
    assert result == {
        "configs": {"must_exist": {"is_mock_config": True}},
        "pending": [default_projectkey.public_key],
    }


@patch("sentry.tasks.relay.build_project_config.delay")
@pytest.mark.django_db
def test_enqueue_task_if_config_not_cached_not_queued(
    schedule_mock,
    call_endpoint,
    default_projectkey,
):
    result, status_code = call_endpoint(full_config=True)
    assert status_code < 400
    assert result == {"configs": {}, "pending": [default_projectkey.public_key]}
    assert schedule_mock.call_count == 1


@patch("sentry.tasks.relay.update_config_cache.delay")
@pytest.mark.django_db
def test_debounce_task_if_proj_config_not_cached_already_enqueued(
    task_mock,
    call_endpoint,
    default_projectkey,
    projectconfig_debounced_cache,
):
    result, status_code = call_endpoint(full_config=True)
    assert status_code < 400
    assert result == {"configs": {}, "pending": [default_projectkey.public_key]}
    assert task_mock.call_count == 0


@patch("sentry.relay.projectconfig_cache.set_many")
@pytest.mark.django_db
def test_task_writes_config_into_cache(
    cache_set_many_mock,
    default_projectkey,
    project_config_get_mock,
):
    update_config_cache(
        generate=True,
        organization_id=None,
        project_id=None,
        public_key=default_projectkey.public_key,
        update_reason="test",
    )

    assert cache_set_many_mock.call_count == 1
    # Using a tuple because that's the format `.args` uses
    assert cache_set_many_mock.call_args.args == (
        {default_projectkey.public_key: {"is_mock_config": True}},
    )
