from time import time
from unittest import mock

import pytest
from django.test.utils import override_settings

from sentry import quotas
from sentry.event_manager import EventManager
from sentry.exceptions import HashDiscarded
from sentry.plugins.base.v2 import Plugin2
from sentry.tasks.store import (
    preprocess_event,
    process_event,
    save_event,
    time_synthetic_monitoring_event,
)
from sentry.testutils.pytest.fixtures import django_db_all

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
def mock_save_event():
    with mock.patch("sentry.tasks.store.save_event") as m:
        yield m


@pytest.fixture
def mock_process_event():
    with mock.patch("sentry.tasks.store.process_event") as m:
        yield m


@pytest.fixture
def mock_symbolicate_event():
    with mock.patch("sentry.tasks.symbolication.symbolicate_event") as m:
        yield m


@pytest.fixture
def mock_symbolicate_event_low_priority():
    with mock.patch("sentry.tasks.symbolication.symbolicate_event_low_priority") as m:
        yield m


@pytest.fixture
def mock_get_symbolication_function():
    with mock.patch("sentry.lang.native.processing.get_native_symbolication_function") as m:
        yield m


@pytest.fixture
def mock_event_processing_store():
    with mock.patch("sentry.eventstore.processing.event_processing_store") as m:
        yield m


@pytest.fixture
def mock_refund():
    with mock.patch.object(quotas, "refund") as m:
        yield m


@pytest.fixture
def mock_metrics_timing():
    with mock.patch("sentry.tasks.store.metrics.timing") as m:
        yield m


@django_db_all
def test_move_to_process_event(
    default_project, mock_process_event, mock_save_event, mock_symbolicate_event, register_plugin
):
    register_plugin(globals(), BasicPreprocessorPlugin)
    data = {
        "project": default_project.id,
        "platform": "mattlang",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    preprocess_event(cache_key="", data=data)

    assert mock_symbolicate_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 1
    assert mock_save_event.delay.call_count == 0


@django_db_all
def test_move_to_save_event(
    default_project, mock_process_event, mock_save_event, mock_symbolicate_event, register_plugin
):
    register_plugin(globals(), BasicPreprocessorPlugin)
    data = {
        "project": default_project.id,
        "platform": "NOTMATTLANG",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    preprocess_event(cache_key="", data=data)

    assert mock_symbolicate_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 0
    assert mock_save_event.delay.call_count == 1


@django_db_all
def test_process_event_mutate_and_save(
    default_project, mock_event_processing_store, mock_save_event, register_plugin
):
    register_plugin(globals(), BasicPreprocessorPlugin)

    data = {
        "project": default_project.id,
        "platform": "mattlang",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    process_event(cache_key="e:1", start_time=1)

    # The event mutated, so make sure we save it back
    ((_, (event,), _),) = mock_event_processing_store.store.mock_calls

    assert "extra" not in event

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
    )


@django_db_all
def test_process_event_no_mutate_and_save(
    default_project, mock_event_processing_store, mock_save_event, register_plugin
):
    register_plugin(globals(), BasicPreprocessorPlugin)

    data = {
        "project": default_project.id,
        "platform": "noop",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    mock_event_processing_store.get.return_value = data

    process_event(cache_key="e:1", start_time=1)

    # The event did not mutate, so we shouldn't reset it in cache
    assert mock_event_processing_store.store.call_count == 0

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
    )


@django_db_all
def test_process_event_unprocessed(
    default_project, mock_event_processing_store, mock_save_event, register_plugin
):
    register_plugin(globals(), BasicPreprocessorPlugin)

    data = {
        "project": default_project.id,
        "platform": "holdmeclose",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    process_event(cache_key="e:1", start_time=1)

    ((_, (event,), _),) = mock_event_processing_store.store.mock_calls
    assert event["unprocessed"] is True

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
    )


@django_db_all
def test_hash_discarded_raised(default_project, mock_refund, register_plugin):
    register_plugin(globals(), BasicPreprocessorPlugin)

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


@django_db_all
@pytest.mark.parametrize("setting_method", ["datascrubbers", "piiconfig"])
def test_scrubbing_after_processing(
    default_project,
    default_organization,
    mock_save_event,
    register_plugin,
    mock_event_processing_store,
    setting_method,
    options_model,
):
    class TestPlugin(Plugin2):
        def get_event_preprocessors(self, data):
            # Right now we do not scrub data from event preprocessors
            def more_extra(data):
                data["extra"]["ooo2"] = "event preprocessor"
                return data

            return [more_extra]

        def is_enabled(self, project=None):
            return True

    register_plugin(globals(), TestPlugin)

    if setting_method == "datascrubbers":
        options_model.update_option("sentry:sensitive_fields", ["o"])
        options_model.update_option("sentry:scrub_data", True)
    elif setting_method == "piiconfig":
        options_model.update_option(
            "sentry:relay_pii_config", '{"applications": {"extra.ooo": ["@anything:replace"]}}'
        )
    else:
        raise ValueError(setting_method)

    data = {
        "project": default_project.id,
        "platform": "python",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"ooo": "remove me"},
    }

    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    # We pass data_has_changed=True to pretend that we've added "extra" attribute
    # to "data" shortly before (e.g. during symbolication).
    process_event(cache_key="e:1", start_time=1, data_has_changed=True)

    ((_, (event,), _),) = mock_event_processing_store.store.mock_calls
    assert event["extra"] == {"ooo": "[Filtered]", "ooo2": "event preprocessor"}

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:1", data=None, start_time=1, event_id=EVENT_ID, project_id=default_project.id
    )


def test_time_synthetic_monitoring_event_in_save_event_disabled(mock_metrics_timing):
    data = {"project": 1}
    with override_settings(SENTRY_SYNTHETIC_MONITORING_PROJECT_ID=None):
        assert time_synthetic_monitoring_event(data, 1, time()) is False
    assert mock_metrics_timing.call_count == 0


def test_time_synthetic_monitoring_event_in_save_event_not_matching_project(mock_metrics_timing):
    data = {"project": 1}
    with override_settings(SENTRY_SYNTHETIC_MONITORING_PROJECT_ID=2):
        assert time_synthetic_monitoring_event(data, 1, time()) is False
    assert mock_metrics_timing.call_count == 0


def test_time_synthetic_monitoring_event_in_save_event_missing_extra(mock_metrics_timing):
    data = {"project": 1}
    with override_settings(SENTRY_SYNTHETIC_MONITORING_PROJECT_ID=1):
        assert time_synthetic_monitoring_event(data, 1, time()) is False
    assert mock_metrics_timing.call_count == 0


def test_time_synthetic_monitoring_event_in_save_event(mock_metrics_timing):
    tags = {
        "source_region": "region-1",
        "target": "target.io",
        "source": "source-1",
    }
    extra = {"key": "value", "another": "val"}
    extra.update(tags)
    data = {
        "project": 1,
        "timestamp": time(),
        "extra": {"_sentry_synthetic_monitoring": extra},
    }
    with override_settings(SENTRY_SYNTHETIC_MONITORING_PROJECT_ID=1):
        assert time_synthetic_monitoring_event(data, 1, time()) is True

    to_ingest, to_process = mock_metrics_timing.mock_calls

    assert to_ingest.args == (
        "events.synthetic-monitoring.time-to-ingest-total",
        mock.ANY,
    )
    assert to_ingest.kwargs == {"tags": tags, "sample_rate": 1.0}

    assert to_process.args == (
        "events.synthetic-monitoring.time-to-process",
        mock.ANY,
    )
    assert to_process.kwargs == {"tags": tags, "sample_rate": 1.0}
