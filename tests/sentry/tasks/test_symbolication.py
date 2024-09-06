from unittest import mock

import pytest
from django.test import override_settings

from sentry.lang.native.symbolicator import SymbolicatorPlatform, SymbolicatorTaskKind
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
def mock_get_symbolication_function_for_platform():
    with mock.patch("sentry.tasks.symbolication.get_symbolication_function_for_platform") as m:
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
def test_move_to_symbolicate_event_low_priority(
    default_project,
    mock_process_event,
    mock_save_event,
    mock_symbolicate_event,
    mock_symbolicate_event_low_priority,
):
    with override_options({"store.symbolicate-event-lpq-always": [default_project.id]}):
        data = {
            "platform": "native",
            "project": default_project.id,
            "event_id": EVENT_ID,
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


@django_db_all
def test_should_demote_symbolication_empty(default_project):
    assert not should_demote_symbolication(SymbolicatorPlatform.native, default_project.id)


@django_db_all
def test_should_demote_symbolication_always(default_project):
    with override_options({"store.symbolicate-event-lpq-always": [default_project.id]}):
        assert should_demote_symbolication(SymbolicatorPlatform.native, default_project.id)


@django_db_all
def test_should_demote_symbolication_never(default_project):
    with override_options({"store.symbolicate-event-lpq-never": [default_project.id]}):
        assert not should_demote_symbolication(SymbolicatorPlatform.native, default_project.id)


@django_db_all
def test_should_demote_symbolication_always_and_never(default_project):
    with override_options(
        {
            "store.symbolicate-event-lpq-never": [default_project.id],
            "store.symbolicate-event-lpq-always": [default_project.id],
        }
    ):
        assert not should_demote_symbolication(SymbolicatorPlatform.native, default_project.id)


@django_db_all
@override_settings(SENTRY_ENABLE_AUTO_LOW_PRIORITY_QUEUE=True)
def test_should_demote_symbolication_with_non_existing_lpq_projects(default_project):
    with override_options(
        {
            "store.symbolicate-event-lpq-never": [],
            "store.symbolicate-event-lpq-always": [],
        }
    ):
        assert not should_demote_symbolication(SymbolicatorPlatform.native, default_project.id)


@django_db_all
@mock.patch("sentry.event_manager.EventManager.save", return_value=None)
def test_submit_symbolicate_queue_switch(
    self,  # NOTE: the `self` here is load-bearing.
    # removing it will fail this test with a completely un-understandable error.
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

    is_low_priority = mock_should_demote_symbolication(
        SymbolicatorPlatform.native, default_project.id
    )
    assert is_low_priority
    with TaskRunner():
        task_kind = SymbolicatorTaskKind(
            platform=SymbolicatorPlatform.native, is_low_priority=is_low_priority
        )
        mock_submit_symbolicate(
            task_kind,
            cache_key="e:1",
            event_id=EVENT_ID,
            start_time=0,
        )
    assert mock_submit_symbolicate.call_count == 4
