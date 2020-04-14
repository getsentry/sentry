from __future__ import absolute_import

import pytest

from sentry.utils.compat import mock
from sentry import options
from time import time

from sentry import quotas
from sentry.event_manager import EventManager, HashDiscarded
from sentry.plugins.base.v2 import Plugin2
from sentry.tasks.store import preprocess_event, process_event, save_event, symbolicate_event
from sentry.testutils.helpers.features import Feature

EVENT_ID = "cc3e6c2bb6b6498097f336d1e6979f4b"


class BasicPreprocessorPlugin(Plugin2):
    def get_event_preprocessors(self, data):
        def remove_extra(data):
            del data["extra"]
            return data

        def put_on_hold(data):
            data["unprocessed"] = True
            return data

        if data.get("platform") == "mattlang":
            return [remove_extra, lambda x: None]

        if data.get("platform") == "noop":
            return [lambda data: None]

        if data.get("platform") == "holdmeclose":
            return [put_on_hold]

        return []

    def is_enabled(self, project=None):
        return True


@pytest.fixture
def register_plugin(request, monkeypatch):
    def inner(cls):
        from sentry.plugins.base import plugins

        monkeypatch.setitem(globals(), cls.__name__, cls)
        plugins.register(cls)
        request.addfinalizer(lambda: plugins.unregister(cls))

    return inner


@pytest.fixture
def mock_save_event():
    with mock.patch("sentry.tasks.store.save_event") as m:
        yield m


@pytest.fixture
def mock_process_event():
    with mock.patch("sentry.tasks.store.process_event") as m:
        yield m


@pytest.fixture
def mock_symbolicate_event():
    with mock.patch("sentry.tasks.store.symbolicate_event") as m:
        yield m


@pytest.fixture
def mock_get_symbolication_function():
    with mock.patch("sentry.lang.native.processing.get_symbolication_function") as m:
        yield m


@pytest.fixture
def mock_default_cache():
    with mock.patch("sentry.tasks.store.default_cache") as m:
        yield m


@pytest.fixture
def mock_refund():
    with mock.patch.object(quotas, "refund") as m:
        yield m


@pytest.mark.django_db
def test_move_to_process_event(
    default_project, mock_process_event, mock_save_event, mock_symbolicate_event, register_plugin
):
    register_plugin(BasicPreprocessorPlugin)
    data = {
        "project": default_project.id,
        "platform": "mattlang",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    preprocess_event(data=data)

    assert mock_symbolicate_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 1
    assert mock_save_event.delay.call_count == 0


@pytest.mark.django_db
def test_move_to_symbolicate_event(
    default_project, mock_process_event, mock_save_event, mock_symbolicate_event, register_plugin
):
    register_plugin(BasicPreprocessorPlugin)
    data = {
        "project": default_project.id,
        "platform": "native",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    options.set("sentry:preprocess-use-new-behavior", True)
    preprocess_event(data=data)

    assert mock_symbolicate_event.delay.call_count == 1
    assert mock_process_event.delay.call_count == 0
    assert mock_save_event.delay.call_count == 0


@pytest.mark.django_db
def test_move_to_symbolicate_event_old(
    default_project, mock_process_event, mock_save_event, mock_symbolicate_event, register_plugin
):
    # Temporarily test old behavior
    register_plugin(BasicPreprocessorPlugin)
    data = {
        "project": default_project.id,
        "platform": "native",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    options.set("sentry:preprocess-use-new-behavior", False)
    preprocess_event(data=data)

    assert mock_symbolicate_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 1
    assert mock_save_event.delay.call_count == 0


@pytest.mark.django_db
def test_symbolicate_event_call_process_inline(
    default_project,
    mock_default_cache,
    mock_process_event,
    mock_save_event,
    mock_get_symbolication_function,
    register_plugin,
):
    register_plugin(BasicPreprocessorPlugin)
    data = {
        "project": default_project.id,
        "platform": "native",
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }
    mock_default_cache.get.return_value = data

    symbolicated_data = {"type": "error"}

    mock_get_symbolication_function.return_value = lambda _: symbolicated_data

    with mock.patch("sentry.tasks.store._do_process_event") as mock_do_process_event:
        symbolicate_event(cache_key="e:1", start_time=1)

    # The event mutated, so make sure we save it back
    ((_, (key, event, duration), _),) = mock_default_cache.set.mock_calls

    assert key == "e:1"
    assert event == symbolicated_data
    assert duration == 3600

    assert mock_save_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 0
    mock_do_process_event.assert_called_once_with(
        cache_key="e:1",
        start_time=1,
        event_id=EVENT_ID,
        process_task=mock_process_event,
        data=symbolicated_data,
        data_has_changed=True,
        new_process_behavior=True,
        from_symbolicate=True,
    )


@pytest.mark.django_db
def test_move_to_save_event(
    default_project, mock_process_event, mock_save_event, mock_symbolicate_event, register_plugin
):
    register_plugin(BasicPreprocessorPlugin)
    data = {
        "project": default_project.id,
        "platform": "NOTMATTLANG",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    preprocess_event(data=data)

    assert mock_symbolicate_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 0
    assert mock_save_event.delay.call_count == 1


@pytest.mark.django_db
def test_process_event_mutate_and_save(
    default_project, mock_default_cache, mock_save_event, register_plugin
):
    register_plugin(BasicPreprocessorPlugin)

    data = {
        "project": default_project.id,
        "platform": "mattlang",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    mock_default_cache.get.return_value = data

    process_event(cache_key="e:1", start_time=1)

    # The event mutated, so make sure we save it back
    ((_, (key, event, duration), _),) = mock_default_cache.set.mock_calls

    assert key == "e:1"
    assert "extra" not in event
    assert duration == 3600

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
    )


@pytest.mark.django_db
def test_process_event_no_mutate_and_save(
    default_project, mock_default_cache, mock_save_event, register_plugin
):
    register_plugin(BasicPreprocessorPlugin)

    data = {
        "project": default_project.id,
        "platform": "noop",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    mock_default_cache.get.return_value = data

    process_event(cache_key="e:1", start_time=1)

    # The event did not mutate, so we shouldn't reset it in cache
    assert mock_default_cache.set.call_count == 0

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
    )


@pytest.mark.django_db
def test_process_event_unprocessed(
    default_project, mock_default_cache, mock_save_event, register_plugin
):
    register_plugin(BasicPreprocessorPlugin)

    data = {
        "project": default_project.id,
        "platform": "holdmeclose",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    mock_default_cache.get.return_value = data

    process_event(cache_key="e:1", start_time=1)

    ((_, (key, event, duration), _),) = mock_default_cache.set.mock_calls
    assert key == "e:1"
    assert event["unprocessed"] is True
    assert duration == 3600

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
    )


@pytest.mark.django_db
def test_hash_discarded_raised(default_project, mock_refund, register_plugin):
    register_plugin(BasicPreprocessorPlugin)

    data = {
        "project": default_project.id,
        "platform": "NOTMATTLANG",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    now = time()
    mock_save = mock.Mock()
    mock_save.side_effect = HashDiscarded
    with mock.patch.object(EventManager, "save", mock_save):
        save_event(data=data, start_time=now)
        # should be caught


@pytest.fixture(params=["org", "project"])
def options_model(request, default_organization, default_project):
    if request.param == "org":
        return default_organization
    elif request.param == "project":
        return default_project
    else:
        raise ValueError(request.param)


@pytest.mark.django_db
@pytest.mark.parametrize("setting_method", ["datascrubbers", "piiconfig"])
def test_scrubbing_after_processing(
    default_project,
    default_organization,
    mock_save_event,
    register_plugin,
    mock_default_cache,
    setting_method,
    options_model,
):
    @register_plugin
    class TestPlugin(Plugin2):
        def get_event_enhancers(self, data):
            def more_extra(data):
                data["extra"]["aaa"] = "remove me"
                return data

            return [more_extra]

        def get_event_preprocessors(self, data):
            # Right now we do not scrub data from event preprocessors, only
            # from event enhancers.
            def more_extra(data):
                data["extra"]["aaa2"] = "event preprocessor"
                return data

            return [more_extra]

        def is_enabled(self, project=None):
            return True

    if setting_method == "datascrubbers":
        options_model.update_option("sentry:sensitive_fields", ["a"])
        options_model.update_option("sentry:scrub_data", True)
    elif setting_method == "piiconfig":
        options_model.update_option(
            "sentry:relay_pii_config", '{"applications": {"extra.aaa": ["@anything:replace"]}}'
        )
    else:
        raise ValueError(setting_method)

    data = {
        "project": default_project.id,
        "platform": "python",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {},
    }

    mock_default_cache.get.return_value = data

    with Feature({"organizations:datascrubbers-v2": True}):
        process_event(cache_key="e:1", start_time=1)

    ((_, (key, event, duration), _),) = mock_default_cache.set.mock_calls
    assert key == "e:1"
    assert event["extra"] == {u"aaa": u"[Filtered]", u"aaa2": u"event preprocessor"}
    assert duration == 3600

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
    )
