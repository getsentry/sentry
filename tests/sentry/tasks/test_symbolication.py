import itertools
from unittest import mock

import pytest

from sentry.lang.native.symbolicator import Symbolicator, SymbolicatorFunction
from sentry.tasks.store import preprocess_event
from sentry.tasks.symbolication import symbolicate_event
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
def mock_symbolication_function():
    """Mocks the symbolication function invoked via `SymbolicatorFunction.__call__`."""
    with mock.patch.object(SymbolicatorFunction, "__call__") as m:
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
    mock_symbolication_function,
):
    data = {
        "platform": "native",
        "project": default_project.id,
        "event_id": EVENT_ID,
    }
    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = "e:1"

    symbolicated_data = {"type": "error"}
    mock_symbolication_function.return_value = symbolicated_data

    with mock.patch("sentry.tasks.store.do_process_event") as mock_do_process_event:
        symbolicate_event(cache_key="e:1", start_time=1)

    # The event mutated, so make sure we save it back
    ((_, (event,), _),) = mock_event_processing_store.store.mock_calls

    assert event == symbolicated_data

    assert mock_save_event.delay.call_count == 0
    assert mock_process_event.delay.call_count == 1
    assert mock_do_process_event.call_count == 0


@django_db_all
def test_symbolicate_minidump_and_native_stacktrace(
    default_project, mock_event_processing_store, mock_process_event, mock_save_event
):
    """
    An event containing both a minidump and an additional raw native stacktrace
    (relay's `MinidumpMultiException` feature inserts the minidump placeholder
    as the first exception and preserves the others) is submitted to
    Symbolicator twice - once for the minidump, once for the native payload -
    and ends up with two symbolicated stacktraces.
    """
    data = {
        "platform": "native",
        "project": default_project.id,
        "event_id": EVENT_ID,
        "exception": {
            "values": [
                # The minidump placeholder, as written by relay's
                # `write_minidump_placeholder`.
                {
                    "type": "Minidump",
                    "value": "Invalid Minidump",
                    "mechanism": {"type": "minidump", "handled": False, "synthetic": True},
                },
                # A raw native stacktrace that came in alongside the minidump.
                {
                    "type": "EXCEPTION_ACCESS_VIOLATION_WRITE",
                    "stacktrace": {
                        "frames": [{"instruction_addr": "0x2a2a3d", "function": "<unknown>"}]
                    },
                },
            ]
        },
        # Attachment metadata as written by `store_attachments_for_event`. The
        # payload is never loaded because `Symbolicator.process_minidump` is
        # mocked below.
        "_attachments": [
            {
                "id": 0,
                "key": f"c:{default_project.id}:{EVENT_ID}",
                "name": "windows.dmp",
                "type": "event.minidump",
                "content_type": "application/octet-stream",
                "chunks": 0,
            }
        ],
    }

    # A stateful stand-in for the event processing store, so that the second
    # symbolication task picks up the data stored by the first one.
    stored_data = {}
    counter = itertools.count()

    def _store(event_data):
        key = f"e:{next(counter)}"
        stored_data[key] = event_data
        return key

    mock_event_processing_store.get.side_effect = stored_data.get
    mock_event_processing_store.store.side_effect = _store

    cache_key = _store(data)

    minidump_response = {
        "status": "completed",
        "crashed": True,
        "crash_reason": "EXCEPTION_ACCESS_VIOLATION_WRITE",
        "system_info": {"os_name": "Windows", "os_version": "10.0.14393", "cpu_arch": "x86"},
        "modules": [],
        "stacktraces": [
            {
                "is_requesting": True,
                "thread_id": 1636,
                "frames": [
                    {
                        "status": "symbolicated",
                        "original_index": 0,
                        "instruction_addr": "0x2a2a3d",
                        "trust": "context",
                        "function": "main",
                    }
                ],
            }
        ],
    }

    payload_response = {
        "status": "completed",
        "modules": [],
        "stacktraces": [
            {
                "frames": [
                    {
                        "status": "symbolicated",
                        "original_index": 0,
                        "instruction_addr": "0x2a2a3d",
                        "function": "worker_thread",
                    }
                ]
            },
        ],
    }

    with (
        mock.patch.object(
            Symbolicator, "process_minidump", return_value=minidump_response
        ) as mock_process_minidump,
        mock.patch.object(
            Symbolicator, "process_payload", return_value=payload_response
        ) as mock_process_payload,
        TaskRunner(),
    ):
        preprocess_event(cache_key=cache_key, data=data)

    # The event was sent to Symbolicator twice.
    assert mock_process_minidump.call_count == 1
    assert mock_process_payload.call_count == 1

    # Both symbolication rounds ran without errors and the event moved on to
    # processing.
    assert mock_process_event.delay.call_count == 1
    final_cache_key = mock_process_event.delay.call_args.kwargs["cache_key"]
    final_data = stored_data[final_cache_key]
    assert not final_data.get("_metrics", {}).get("flag.processing.error")

    exceptions = final_data["exception"]["values"]

    # The minidump placeholder was replaced with the symbolicated crash.
    assert exceptions[0]["type"] == "EXCEPTION_ACCESS_VIOLATION_WRITE"
    minidump_frames = exceptions[0]["stacktrace"]["frames"]
    assert [f["function"] for f in minidump_frames] == ["main"]
    assert [f["data"]["symbolicator_status"] for f in minidump_frames] == ["symbolicated"]

    # The raw native stacktrace was symbolicated as well.
    native_frames = exceptions[1]["stacktrace"]["frames"]
    assert [f["function"] for f in native_frames] == ["worker_thread"]
    assert [f["data"]["symbolicator_status"] for f in native_frames] == ["symbolicated"]
