from time import time
from unittest import mock

import pytest

from sentry import options, quotas
from sentry.event_manager import EventManager
from sentry.exceptions import HashDiscarded
from sentry.plugins.base.v2 import Plugin2
from sentry.tasks.store import (
    is_process_disabled,
    preprocess_event,
    process_event,
    save_event,
    save_event_transaction,
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
def mock_save_event_transaction():
    with mock.patch("sentry.tasks.store.save_event_transaction") as m:
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
def mock_event_processing_store():
    with mock.patch("sentry.eventstore.processing.event_processing_store") as m:
        yield m


@pytest.fixture
def mock_transaction_processing_store():
    with mock.patch("sentry.eventstore.processing.transaction_processing_store") as m:
        yield m


@pytest.fixture
def mock_refund():
    with mock.patch.object(quotas, "refund") as m:
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
        raise AssertionError(request.param)


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
        raise AssertionError(setting_method)

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


@django_db_all
def test_killswitch():
    assert not is_process_disabled(1, "asdasdasd", "null")
    options.set("store.load-shed-process-event-projects-gradual", {1: 0.0})
    assert not is_process_disabled(1, "asdasdasd", "null")
    options.set("store.load-shed-process-event-projects-gradual", {1: 1.0})
    assert is_process_disabled(1, "asdasdasd", "null")
    options.set("store.load-shed-process-event-projects-gradual", {})


@django_db_all
def test_transactions_store(default_project, register_plugin, mock_transaction_processing_store):
    register_plugin(globals(), BasicPreprocessorPlugin)

    data = {
        "project": default_project.id,
        "platform": "transaction",
        "event_id": EVENT_ID,
        "type": "transaction",
        "transaction": "minimal_transaction",
        "timestamp": time(),
        "start_timestamp": time() - 1,
    }

    mock_transaction_processing_store.store.return_value = "e:1"
    mock_transaction_processing_store.get.return_value = data
    with mock.patch("sentry.event_manager.EventManager.save", return_value=None):
        save_event_transaction(
            cache_key="e:1",
            data=None,
            start_time=1,
            event_id=EVENT_ID,
            project_id=default_project.id,
        )

    mock_transaction_processing_store.get.assert_called_once_with("e:1")


@django_db_all
def test_store_consumer_type(
    default_project,
    mock_save_event,
    mock_save_event_transaction,
    register_plugin,
    mock_event_processing_store,
    mock_transaction_processing_store,
):
    register_plugin(globals(), BasicPreprocessorPlugin)

    data = {
        "project": default_project.id,
        "platform": "python",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
        "timestamp": time(),
    }

    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:2"

    process_event(cache_key="e:2", start_time=1)

    mock_event_processing_store.get.assert_called_once_with("e:2")

    mock_save_event.delay.assert_called_once_with(
        cache_key="e:2",
        data=None,
        start_time=1,
        event_id=EVENT_ID,
        project_id=default_project.id,
    )

    transaction_data = {
        "project": default_project.id,
        "platform": "transaction",
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
        "timestamp": time(),
        "start_timestamp": time() - 1,
    }

    mock_transaction_processing_store.get.return_value = transaction_data
    mock_transaction_processing_store.store.return_value = "tx:3"

    with mock.patch("sentry.event_manager.EventManager.save", return_value=None):
        save_event_transaction(
            cache_key="tx:3",
            data=None,
            start_time=1,
            event_id=EVENT_ID,
            project_id=default_project.id,
        )

    mock_transaction_processing_store.get.assert_called_once_with("tx:3")
    mock_transaction_processing_store.delete_by_key.assert_not_called()


@django_db_all
def test_transactions_do_post_process_in_save_deletes_from_processing_store(
    default_project,
    mock_transaction_processing_store,
):
    transaction_data = {
        "project": default_project.id,
        "platform": "transaction",
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
        "timestamp": time(),
        "start_timestamp": time() - 1,
    }

    mock_transaction_processing_store.get.return_value = transaction_data
    mock_transaction_processing_store.store.return_value = "tx:3"

    with mock.patch("sentry.event_manager.EventManager.save", return_value=None):
        save_event_transaction(
            cache_key="tx:3",
            data=None,
            start_time=1,
            event_id=EVENT_ID,
            project_id=default_project.id,
        )

    mock_transaction_processing_store.get.assert_called_once_with("tx:3")
    mock_transaction_processing_store.delete_by_key.assert_called_once_with("tx:3")
