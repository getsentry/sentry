import itertools
from unittest import mock

import pytest

from sentry.lang.native.symbolicator import Symbolicator, SymbolicatorFunction
from sentry.tasks.store import preprocess_event
from sentry.tasks.symbolication import symbolicate_event
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
def mock_symbolication_function():
    """Mocks the symbolication function invoked via `SymbolicatorFunction.__call__`."""
    with mock.patch.object(SymbolicatorFunction, "__call__") as m:
        yield m


@pytest.fixture
def mock_event_processing_store():
    with mock.patch("sentry.services.eventstore.processing.event_processing_store") as m:
        yield m


@django_db_all
@pytest.mark.parametrize("inline", (False, True))
@pytest.mark.parametrize(
    "inline_backup,legacy,unprocessed_inline,redis_backups",
    [(0.0, False, False, 1), (1.0, True, True, 1), (1.0, False, True, 0)],
)
def test_move_to_symbolicate_event(
    default_project,
    mock_process_event,
    mock_save_event,
    mock_symbolicate_event,
    mock_event_processing_store,
    inline,
    inline_backup,
    legacy,
    unprocessed_inline,
    redis_backups,
):
    data = {"platform": "native", "project": default_project.id, "event_id": EVENT_ID}
    cache_key = None if inline else "e:1"
    mock_event_processing_store.store.return_value = "e:1"
    with (
        override_options(
            {
                "store.enable-inline-payloads": float(inline),
                "store.disable-processing-store": inline,
                "store.reprocessing-inline-backup.rollout": inline_backup,
                "store.reprocessing-inline-backup.legacy": legacy,
            }
        ),
        mock.patch("sentry.tasks.store.reprocessing2.backup_unprocessed_event") as backup,
    ):
        preprocess_event(cache_key=cache_key, data=data)

    assert backup.call_args_list == [mock.call(data=data)] * redis_backups
    assert mock_symbolicate_event.delay.call_count == 1
    kwargs = mock_symbolicate_event.delay.call_args.kwargs
    assert (kwargs["unprocessed"] == data) is unprocessed_inline
    assert kwargs["data"] == (data if inline else None)
    assert kwargs["cache_key"] == cache_key
    assert mock_process_event.delay.call_count == 0
    assert mock_save_event.delay.call_count == 0


@django_db_all
@pytest.mark.parametrize("inline", (False, True))
@pytest.mark.parametrize(
    "error,load_shed,symbolicate_functions,expected_metrics",
    [
        (
            RuntimeError("symbolication failed"),
            False,
            [],
            {"flag.processing.error": True, "flag.processing.fatal": True},
        ),
        (None, True, ["js"], {}),
    ],
)
def test_symbolication_continues_after_error_or_load_shedding(
    default_project,
    mock_event_processing_store,
    mock_process_event,
    mock_symbolication_function,
    error,
    load_shed,
    expected_metrics,
    symbolicate_functions,
    inline,
):
    data = {"platform": "native", "project": default_project.id, "event_id": EVENT_ID}
    cache_key = None if inline else "e:1"
    mock_event_processing_store.get.return_value = data
    mock_event_processing_store.store.return_value = cache_key
    mock_symbolication_function.side_effect = error
    with (
        override_options(
            {
                "store.enable-inline-payloads": float(inline),
                "store.disable-processing-store": inline,
            }
        ),
        mock.patch("sentry.tasks.symbolication.killswitch_matches_context", return_value=load_shed),
    ):
        symbolicate_event(
            cache_key=cache_key,
            data=data if inline else None,
            symbolicate_functions=symbolicate_functions,
        )

    mock_process_event.delay.assert_called_once()
    kwargs = mock_process_event.delay.call_args.kwargs
    assert kwargs["data"] == (data if inline else None)
    assert kwargs["cache_key"] == cache_key
    assert data.get("_metrics", {}) == expected_metrics
    assert kwargs["data_has_changed"] is (error is not None)
    assert mock_event_processing_store.get.call_count == (0 if inline else 1)
    assert mock_event_processing_store.store.call_args_list == [mock.call(data)] * (not inline)


@django_db_all
@pytest.mark.parametrize("inline", (False, True))
def test_symbolicate_minidump_and_native_stacktrace(
    default_project, mock_event_processing_store, mock_process_event, mock_save_event, inline
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

    cache_key = None if inline else _store(data)

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
        override_options(
            {
                "store.enable-inline-payloads": float(inline),
                "store.disable-processing-store": inline,
            }
        ),
        mock.patch("sentry.tasks.store.do_process_event") as mock_do_process_event,
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
    final_data = (
        mock_process_event.delay.call_args.kwargs["data"]
        if inline
        else stored_data[final_cache_key]
    )
    assert bool(final_cache_key) is not inline
    assert mock_event_processing_store.store.call_count == (0 if inline else 3)
    assert mock_event_processing_store.get.call_count == (0 if inline else 2)
    mock_save_event.delay.assert_not_called()
    mock_do_process_event.assert_not_called()
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
