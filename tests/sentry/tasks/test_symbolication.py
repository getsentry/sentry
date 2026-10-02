import itertools
from unittest import mock

import pytest

from sentry.lang.native.symbolicator import Symbolicator, SymbolicatorFunction
from sentry.services.eventstore.processing import event_processing_store
from sentry.tasks.store import preprocess_event
from sentry.tasks.symbolication import (
    symbolicate_event,
    symbolicate_js_event,
    symbolicate_jvm_event,
)
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.testutils.pytest.fixtures import django_db_all

EVENT_ID = "cc3e6c2bb6b6498097f336d1e6979f4b"


@django_db_all
def test_inline_preprocess_keeps_backup_and_samples_canonical_event_id(
    default_project,
    mock_symbolicate_event,
):
    data = {"platform": "native", "project": default_project.id, "event_id": "a" * 32}
    with (
        override_options(
            {"store.enable-inline-payloads": 0.7, "store.disable-processing-store": True}
        ),
        mock.patch.object(
            event_processing_store, "store", wraps=event_processing_store.store
        ) as store,
    ):
        preprocess_event(data=data, event_id="b" * 32)

    store.assert_called_once_with(data, unprocessed=True)
    kwargs = mock_symbolicate_event.delay.call_args.kwargs
    assert kwargs["data"] == data
    assert kwargs["event_id"] == "a" * 32
    assert kwargs["cache_key"] is None


@django_db_all
@pytest.mark.parametrize(
    "cache_key,expected_writes,expected_reads", [(None, 0, 0), ("e:working", 3, 1)]
)
@pytest.mark.parametrize("has_changed", (False, True))
def test_inline_chained_symbolication_survives_rate_rollback(
    default_project,
    mock_event_processing_store,
    mock_process_event,
    mock_symbolication_function,
    cache_key,
    expected_writes,
    expected_reads,
    has_changed,
):
    data = {
        "platform": "native",
        "project": default_project.id,
        "event_id": EVENT_ID,
        "_attachments": [{"id": 0, "key": "attachment-key", "name": "dump.dmp"}],
    }
    enriched = dict(data, message="symbolicated")
    mock_symbolication_function.return_value = {False: None, True: enriched}[has_changed]
    mock_event_processing_store.store.return_value = cache_key
    mock_event_processing_store.get.return_value = {False: data, True: enriched}[has_changed]

    with (
        override_options(
            {"store.enable-inline-payloads": 1.0, "store.disable-processing-store": True}
        ),
        mock.patch.object(symbolicate_js_event, "delay") as submit_js,
    ):
        symbolicate_event(
            cache_key=cache_key,
            data=data,
            has_attachments=True,
            symbolicate_functions=["js", "jvm"],
        )
    js_kwargs = submit_js.call_args.kwargs
    assert js_kwargs["data"] == {False: data, True: enriched}[has_changed]
    assert js_kwargs["cache_key"] == cache_key

    with (
        override_options(
            {"store.enable-inline-payloads": 0.0, "store.disable-processing-store": True}
        ),
        mock.patch.object(symbolicate_jvm_event, "delay") as submit_jvm,
    ):
        symbolicate_js_event(**js_kwargs)
        jvm_kwargs = submit_jvm.call_args.kwargs
        symbolicate_jvm_event(**jvm_kwargs)

    assert mock_symbolication_function.call_count == 3
    assert mock_event_processing_store.get.call_count == expected_reads
    assert mock_event_processing_store.store.call_count == expected_writes
    expected_data = {False: data, True: enriched}[has_changed]
    assert (
        mock_event_processing_store.store.call_args_list
        == [mock.call(expected_data)] * expected_writes
    )
    final_kwargs = mock_process_event.delay.call_args.kwargs
    expected_inline_data = {None: expected_data, "e:working": None}[cache_key]
    assert final_kwargs.get("data") == expected_inline_data
    assert jvm_kwargs.get("data") == expected_inline_data
    assert final_kwargs["cache_key"] == cache_key
    assert final_kwargs["has_attachments"] is True
    assert final_kwargs["data_has_changed"] is has_changed


@django_db_all
def test_inline_symbolication_error_forwards_error_flags(
    default_project,
    mock_event_processing_store,
    mock_process_event,
    mock_symbolication_function,
):
    data = {"platform": "native", "project": default_project.id, "event_id": EVENT_ID}
    mock_symbolication_function.side_effect = RuntimeError("symbolication failed")
    with override_options(
        {"store.enable-inline-payloads": 1.0, "store.disable-processing-store": True}
    ):
        symbolicate_event(data=data)

    payload = mock_process_event.delay.call_args.kwargs["data"]
    assert payload["_metrics"]["flag.processing.error"] is True
    assert payload["_metrics"]["flag.processing.fatal"] is True
    assert mock_process_event.delay.call_args.kwargs["data_has_changed"] is True
    mock_event_processing_store.get.assert_not_called()
    mock_event_processing_store.store.assert_not_called()


def test_inline_symbolication_load_shedding_keeps_payload(
    mock_event_processing_store,
    mock_process_event,
):
    data = {"project": 1, "event_id": EVENT_ID, "platform": "native"}
    with (
        override_options(
            {"store.enable-inline-payloads": 0.0, "store.disable-processing-store": True}
        ),
        mock.patch("sentry.tasks.symbolication.killswitch_matches_context", return_value=True),
    ):
        symbolicate_event(data=data, symbolicate_functions=["js"])

    assert mock_process_event.delay.call_args.kwargs["data"] == data
    mock_event_processing_store.get.assert_not_called()
    mock_event_processing_store.store.assert_not_called()


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
