from __future__ import absolute_import

import pytest

from sentry.utils.compat import mock
from time import time

from sentry import quotas, tsdb
from sentry.save_event import HashDiscarded
from sentry.plugins.base.v2 import Plugin2
from sentry.tasks.store import preprocess_event, process_event, save_event
from sentry.utils.dates import to_datetime
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
def mock_default_cache():
    with mock.patch("sentry.tasks.store.default_cache") as m:
        yield m


@pytest.fixture
def mock_incr():
    with mock.patch.object(tsdb, "incr_multi") as m:
        yield m


@pytest.fixture
def mock_refund():
    with mock.patch.object(quotas, "refund") as m:
        yield m


@pytest.mark.django_db
def test_move_to_process_event(
    default_project, mock_process_event, mock_save_event, register_plugin
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

    assert mock_process_event.delay.call_count == 1
    assert mock_save_event.delay.call_count == 0


@pytest.mark.django_db
def test_move_to_save_event(default_project, mock_process_event, mock_save_event, register_plugin):
    register_plugin(BasicPreprocessorPlugin)
    data = {
        "project": default_project.id,
        "platform": "NOTMATTLANG",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    preprocess_event(data=data)

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
    (_, (key, event, duration), _), = mock_default_cache.set.mock_calls

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

    (_, (key, event, duration), _), = mock_default_cache.set.mock_calls
    assert key == "e:1"
    assert event["unprocessed"] is True
    assert duration == 3600

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
    )


@pytest.mark.django_db
def test_hash_discarded_raised(default_project, mock_refund, mock_incr, register_plugin):
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
    with mock.patch("sentry.tasks.store.save_event_impl", mock_save):
        save_event(data=data, start_time=now)
        mock_incr.assert_called_with(
            [
                (tsdb.models.project_total_received, default_project.id),
                (tsdb.models.organization_total_received, default_project.organization.id),
                (tsdb.models.project_total_blacklisted, default_project.id),
                (tsdb.models.organization_total_blacklisted, default_project.organization_id),
                (tsdb.models.project_total_received_discarded, default_project.id),
            ],
            timestamp=to_datetime(now),
        )


@pytest.mark.django_db
def test_scrubbing_after_processing(
    default_project, default_organization, mock_save_event, register_plugin, mock_default_cache
):
    @register_plugin
    class TestPlugin(Plugin2):
        def get_event_enhancers(self, data):
            def more_extra(data):
                data["extra"]["new_aaa"] = "remove me"
                return data

            return [more_extra]

        def get_event_preprocessors(self, data):
            # Right now we do not scrub data from event preprocessors, only
            # from event enhancers.
            def more_extra(data):
                data["extra"]["new_aaa2"] = "event preprocessor"
                return data

            return [more_extra]

        def is_enabled(self, project=None):
            return True

    default_project.update_option("sentry:sensitive_fields", ["a"])
    default_project.update_option("sentry:scrub_data", True)

    data = {
        "project": default_project.id,
        "platform": "python",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"aaa": "do not remove me"},
    }

    mock_default_cache.get.return_value = data

    with Feature({"organizations:datascrubbers-v2": True}):
        process_event(cache_key="e:1", start_time=1)

    (_, (key, event, duration), _), = mock_default_cache.set.mock_calls
    assert key == "e:1"
    assert event["extra"] == {
        u"aaa": u"do not remove me",
        u"new_aaa": u"[Filtered]",
        u"new_aaa2": u"event preprocessor",
    }
    assert duration == 3600

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
    )
