from unittest import mock

import pytest

from sentry.tasks.store import preprocess_event
from sentry.tasks.symbolication import symbolicate_event
from sentry.testutils.pytest.fixtures import django_db_all

EVENT_ID = "cc3e6c2bb6b6498097f336d1e6979f4b"


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
def mock_get_symbolication_function_for_platform():
    with mock.patch("sentry.tasks.symbolication.get_symbolication_function_for_platform") as m:
        yield m


@pytest.fixture
def mock_event_processing_store():
    with mock.patch("sentry.eventstore.processing.event_processing_store") as m:
        yield m


@django_db_all
def test_move_to_symbolicate_event(
    default_project, mock_process_event, mock_save_event, mock_symbolicate_event
):
    data = {
        "platform": "native",
        "project": default_project.id,
        "event_id": EVENT_ID,
    }

    preprocess_event(cache_key="", data=data)

    assert mock_symbolicate_event.delay.call_count == 1
    assert mock_process_event.delay.call_count == 0
    assert mock_save_event.delay.call_count == 0


@django_db_all
def test_symbolicate_event_doesnt_call_process_inline(
    default_project,
    mock_event_processing_store,
    mock_process_event,
    mock_save_event,
    mock_get_symbolication_function_for_platform,
):
    data = {
        "platform": "native",
        "project": default_project.id,
        "event_id": EVENT_ID,
    }
    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    symbolicated_data = {"type": "error"}

    mock_get_symbolication_function_for_platform.return_value = (
        lambda _symbolicator, _event: symbolicated_data
    )

    with mock.patch("sentry.tasks.store.do_process_event") as mock_do_process_event:
        symbolicate_event(cache_key="e:1", start_time=1)

    # The event mutated, so make sure we save it back
    ((_, (event,), _),) = mock_event_processing_store.store.mock_calls

    assert event == symbolicated_data

    assert mock_save_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 1
    assert mock_do_process_event.call_count == 0
