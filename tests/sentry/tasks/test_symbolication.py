from unittest import mock

import pytest

from sentry.tasks.store import preprocess_event
from sentry.tasks.symbolication import symbolicate_event
from sentry.testutils.helpers import Feature
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
    with mock.patch("sentry.services.eventstore.processing.event_processing_store") as m:
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


@pytest.fixture
def mock_teapot_hook():
    """Mocks the two task-level entry points into the teapot hook.

    Returns (detect_mock, process_mock). Tests assert on
    `process_mock.call_count` to verify whether the hook fired.
    """

    with (
        mock.patch("sentry.tasks.symbolication.has_gpu_crash_dump_attachment") as detect,
        mock.patch("sentry.tasks.symbolication.process_gpu_crash_dump") as process,
    ):
        process.side_effect = lambda data, _project, _event_id: data
        yield detect, process


@django_db_all
def test_teapot_hook_fires_when_flag_on_and_attachment_present(
    default_project,
    mock_event_processing_store,
    mock_process_event,
    mock_save_event,
    mock_get_symbolication_function_for_platform,
    mock_teapot_hook,
) -> None:
    """Flag on + native platform + attachment present → teapot runs."""

    detect, process = mock_teapot_hook
    detect.return_value = True

    data = {
        "platform": "native",
        "project": default_project.id,
        "event_id": EVENT_ID,
    }
    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    mock_get_symbolication_function_for_platform.return_value = lambda _symbolicator, event: event

    with (
        Feature("organizations:gpu-crash-symbolication"),
        mock.patch("sentry.tasks.store.do_process_event"),
    ):
        symbolicate_event(cache_key="e:1", start_time=1)

    assert process.call_count == 1


@django_db_all
def test_teapot_hook_skipped_when_flag_off(
    default_project,
    mock_event_processing_store,
    mock_process_event,
    mock_save_event,
    mock_get_symbolication_function_for_platform,
    mock_teapot_hook,
) -> None:
    """Flag off → teapot never runs, even with attachment present."""

    detect, process = mock_teapot_hook
    detect.return_value = True

    data = {
        "platform": "native",
        "project": default_project.id,
        "event_id": EVENT_ID,
    }
    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    mock_get_symbolication_function_for_platform.return_value = lambda _symbolicator, event: event

    with mock.patch("sentry.tasks.store.do_process_event"):
        symbolicate_event(cache_key="e:1", start_time=1)

    assert process.call_count == 0


@django_db_all
def test_teapot_hook_skipped_when_no_attachment(
    default_project,
    mock_event_processing_store,
    mock_process_event,
    mock_save_event,
    mock_get_symbolication_function_for_platform,
    mock_teapot_hook,
) -> None:
    """Flag on but no GPU attachment → teapot not invoked."""

    detect, process = mock_teapot_hook
    detect.return_value = False

    data = {
        "platform": "native",
        "project": default_project.id,
        "event_id": EVENT_ID,
    }
    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    mock_get_symbolication_function_for_platform.return_value = lambda _symbolicator, event: event

    with (
        Feature("organizations:gpu-crash-symbolication"),
        mock.patch("sentry.tasks.store.do_process_event"),
    ):
        symbolicate_event(cache_key="e:1", start_time=1)

    assert process.call_count == 0
