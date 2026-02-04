from __future__ import annotations

import pickle
from unittest.mock import MagicMock, patch

from sentry.utils.arroyo import _import_and_run


def _test_main_fn() -> None:
    pass


def _test_initializer() -> None:
    pass


def test_stuck_detector_thread_started_when_enabled() -> None:
    """Test that stuck detector thread is started when enabled."""
    main_fn_pickle = pickle.dumps(_test_main_fn)
    args_pickle = pickle.dumps(())

    with patch("sentry.utils.arroyo.threading.Thread") as mock_thread_class:
        mock_thread = MagicMock()
        mock_thread_class.return_value = mock_thread

        _import_and_run(
            _test_initializer,
            main_fn_pickle,
            args_pickle,
            use_stuck_detector=True,
        )

        mock_thread_class.assert_called_once()
        assert mock_thread_class.call_args.kwargs["daemon"] is True
        assert mock_thread_class.call_args.kwargs["name"] == "stuck-detector"
        mock_thread.start.assert_called_once()


def test_stuck_detector_thread_not_started_when_disabled() -> None:
    """Test that stuck detector thread is NOT started when disabled."""
    main_fn_pickle = pickle.dumps(_test_main_fn)
    args_pickle = pickle.dumps(())

    with patch("sentry.utils.arroyo.threading.Thread") as mock_thread_class:
        _import_and_run(
            _test_initializer,
            main_fn_pickle,
            args_pickle,
            use_stuck_detector=False,
        )

        mock_thread_class.assert_not_called()


def test_init_done_set_after_initialization() -> None:
    """Test that init_done event is set after initialization completes."""
    events_set: list[str] = []
    main_fn_pickle = pickle.dumps(_test_main_fn)
    args_pickle = pickle.dumps(())

    with (
        patch("sentry.utils.arroyo.threading.Event") as mock_event_class,
        patch("sentry.utils.arroyo.threading.Thread") as mock_thread_class,
    ):
        mock_event = MagicMock()
        mock_event.is_set.return_value = True
        mock_event.set.side_effect = lambda: events_set.append("init_done")
        mock_event_class.return_value = mock_event

        mock_thread = MagicMock()
        mock_thread_class.return_value = mock_thread

        assert len(events_set) == 0

        _import_and_run(
            _test_initializer,
            main_fn_pickle,
            args_pickle,
            use_stuck_detector=True,
        )

        assert len(events_set) == 1


def test_stuck_detector_logs_warning_when_timeout_exceeded() -> None:
    """Test that stuck detector logs a warning with stack traces when timeout is exceeded."""
    import logging

    main_fn_pickle = pickle.dumps(_test_main_fn)
    args_pickle = pickle.dumps(())

    captured_target = None

    def capture_thread_target(*args, **kwargs):
        nonlocal captured_target
        captured_target = kwargs.get("target")
        mock_thread = MagicMock()
        return mock_thread

    time_values = [0, 0, 35]  # start, first check, second check (past 30s timeout)
    time_index = [0]

    def mock_time():
        val = time_values[min(time_index[0], len(time_values) - 1)]
        time_index[0] += 1
        return val

    mock_event = MagicMock()
    mock_event.is_set.return_value = False

    mock_logger = MagicMock()

    with (
        patch("sentry.utils.arroyo.threading.Thread", side_effect=capture_thread_target),
        patch("sentry.utils.arroyo.threading.Event", return_value=mock_event),
        patch("sentry.utils.arroyo.time.time", side_effect=mock_time),
        patch("sentry.utils.arroyo.time.sleep"),
        patch("arroyo.processing.processor.get_all_thread_stacks", return_value={"main": "stack"}),
        patch.object(logging, "getLogger", return_value=mock_logger),
    ):
        _import_and_run(
            _test_initializer,
            main_fn_pickle,
            args_pickle,
            use_stuck_detector=True,
        )

        assert captured_target is not None
        captured_target()

        mock_logger.warning.assert_called_once()
