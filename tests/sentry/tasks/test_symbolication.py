from unittest import mock
from unittest.mock import patch

import pytest

from sentry.lang.native.symbolicator import SymbolicatorTaskKind
from sentry.plugins.base.v2 import Plugin2
from sentry.tasks.store import preprocess_event
from sentry.tasks.symbolication import (
    should_demote_symbolication,
    submit_symbolicate,
    symbolicate_event,
)
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.task_runner import TaskRunner
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
def mock_should_demote_symbolication():
    with mock.patch(
        "sentry.tasks.symbolication.should_demote_symbolication",
        side_effect=[True, False, True, False, True],
    ) as m:
        yield m


@pytest.fixture
def mock_submit_symbolicate():
    with mock.patch("sentry.tasks.symbolication.submit_symbolicate", wraps=submit_symbolicate) as m:
        yield m


@django_db_all
def test_move_to_symbolicate_event(
    default_project, mock_process_event, mock_save_event, mock_symbolicate_event, register_plugin
):
    register_plugin(globals(), BasicPreprocessorPlugin)
    data = {
        "project": default_project.id,
        "platform": "native",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }

    preprocess_event(cache_key="", data=data)

    assert mock_symbolicate_event.delay.call_count == 1
    assert mock_process_event.delay.call_count == 0
    assert mock_save_event.delay.call_count == 0


@django_db_all
def test_move_to_symbolicate_event_low_priority(
    default_project,
    mock_process_event,
    mock_save_event,
    mock_symbolicate_event,
    mock_symbolicate_event_low_priority,
    register_plugin,
):
    with override_options({"store.symbolicate-event-lpq-always": [default_project.id]}):
        register_plugin(globals(), BasicPreprocessorPlugin)
        data = {
            "project": default_project.id,
            "platform": "native",
            "logentry": {"formatted": "test"},
            "event_id": EVENT_ID,
            "extra": {"foo": "bar"},
        }

        preprocess_event(cache_key="", data=data)

        assert mock_symbolicate_event_low_priority.delay.call_count == 1
        assert mock_symbolicate_event.delay.call_count == 0
        assert mock_process_event.delay.call_count == 0
        assert mock_save_event.delay.call_count == 0


@django_db_all
def test_symbolicate_event_doesnt_call_process_inline(
    default_project,
    mock_event_processing_store,
    mock_process_event,
    mock_save_event,
    mock_get_symbolication_function,
    register_plugin,
):
    register_plugin(globals(), BasicPreprocessorPlugin)
    data = {
        "project": default_project.id,
        "platform": "native",
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }
    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    symbolicated_data = {"type": "error"}

    mock_get_symbolication_function.return_value = lambda _symbolicator, _event: symbolicated_data

    with mock.patch("sentry.tasks.store.do_process_event") as mock_do_process_event:
        symbolicate_event(cache_key="e:1", start_time=1)

    # The event mutated, so make sure we save it back
    ((_, (event,), _),) = mock_event_processing_store.store.mock_calls

    assert event == symbolicated_data

    assert mock_save_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 1
    assert mock_do_process_event.call_count == 0


@pytest.fixture(params=["org", "project"])
def options_model(request, default_organization, default_project):
    if request.param == "org":
        return default_organization
    elif request.param == "project":
        return default_project
    else:
        raise ValueError(request.param)


@django_db_all
def test_should_demote_symbolication_empty(default_project):
    assert not should_demote_symbolication(default_project.id)


@django_db_all
def test_should_demote_symbolication_always(default_project):
    with override_options({"store.symbolicate-event-lpq-always": [default_project.id]}):
        assert should_demote_symbolication(default_project.id)


@django_db_all
def test_should_demote_symbolication_never(default_project):
    with override_options({"store.symbolicate-event-lpq-never": [default_project.id]}):
        assert not should_demote_symbolication(default_project.id)


@django_db_all
def test_should_demote_symbolication_always_and_never(default_project):
    with override_options(
        {
            "store.symbolicate-event-lpq-never": [default_project.id],
            "store.symbolicate-event-lpq-always": [default_project.id],
        }
    ):
        assert not should_demote_symbolication(default_project.id)


@django_db_all
@patch("sentry.event_manager.EventManager.save", return_value=None)
def test_submit_symbolicate_queue_switch(
    self,
    default_project,
    mock_should_demote_symbolication,
    mock_submit_symbolicate,
    mock_event_processing_store,
):
    data = {
        "project": default_project.id,
        "platform": "native",
        "logentry": {"formatted": "test"},
        "event_id": EVENT_ID,
        "extra": {"foo": "bar"},
    }
    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    is_low_priority = mock_should_demote_symbolication(default_project.id)
    assert is_low_priority
    with TaskRunner():
        task_kind = SymbolicatorTaskKind(is_low_priority=is_low_priority)
        mock_submit_symbolicate(
            task_kind,
            cache_key="e:1",
            event_id=EVENT_ID,
            start_time=0,
        )
    assert mock_submit_symbolicate.call_count == 4
