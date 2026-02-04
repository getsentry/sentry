from __future__ import annotations

import pickle
from unittest.mock import MagicMock, patch

from sentry.utils.arroyo import STUCK_DETECTOR_TIMEOUT_SECONDS, _import_and_run


def _test_main_fn() -> None:
    pass


def _test_initializer() -> None:
    pass


def test_stuck_detector_used_when_enabled() -> None:
    """Test that arroyo's stuck_detector context manager is used when enabled."""
    main_fn_pickle = pickle.dumps(_test_main_fn)
    args_pickle = pickle.dumps(())

    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=None)
    mock_cm.__exit__ = MagicMock(return_value=None)

    with patch("sentry.utils.arroyo.stuck_detector", return_value=mock_cm) as mock_stuck_detector:
        _import_and_run(
            _test_initializer,
            main_fn_pickle,
            args_pickle,
            use_stuck_detector=True,
        )

        mock_stuck_detector.assert_called_once_with(
            timeout_seconds=STUCK_DETECTOR_TIMEOUT_SECONDS,
        )
        mock_cm.__enter__.assert_called_once()
        mock_cm.__exit__.assert_called_once()


def test_stuck_detector_not_used_when_disabled() -> None:
    """Test that stuck_detector is NOT used when disabled."""
    main_fn_pickle = pickle.dumps(_test_main_fn)
    args_pickle = pickle.dumps(())

    with patch("sentry.utils.arroyo.stuck_detector") as mock_stuck_detector:
        _import_and_run(
            _test_initializer,
            main_fn_pickle,
            args_pickle,
            use_stuck_detector=False,
        )

        mock_stuck_detector.assert_not_called()
