import time
from unittest.mock import patch

from sentry.sentry_metrics.indexer.id_generator import _INDEXER_EPOCH_START, get_id


def test_get_id() -> None:
    # Function returns a different ID each time it's called
    assert get_id() != get_id()

    # IDs fit in 63 bits (leading bit must be a zero)
    assert get_id() < pow(2, 63)

    # Starts with 0100 (leading zero + version)
    id_binary_string = bin(get_id())[2:].zfill(64)
    assert id_binary_string.startswith("0100")


def test_get_id_time_since() -> None:
    """
    This verifies that the middle 32bits are the correct time since.

    (4bits)              (32bits)                        (28bits)
    version |         time since (s)           |          random            |

    0100    | 00000001001000101000000111100011 | 1110100001100010100101011111

    """
    hardcoded_time = time.time()

    with patch("time.time") as mock_time:
        mock_time.return_value = hardcoded_time

        id_string = bin(get_id())[2:].zfill(64)
        original_time = int(id_string[3:36], 2) + _INDEXER_EPOCH_START

        assert original_time == int(hardcoded_time)
