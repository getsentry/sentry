from __future__ import annotations

import subprocess
from unittest.mock import patch

from tools.mypy_helpers import find_easiest_modules


def test_ranks_only_errors_in_ascending_order_with_filename_ties(
    capsys,
) -> None:
    output = (
        b"src/sentry/z.py:1: error: z [misc]\n"
        b"src/sentry/a.py:2: error: a1 [misc]\n"
        b"src/sentry/a.py:3: error: a2 [misc]\n"
        b"src/sentry/b.py: note: this is not an error\n"
        b"Found 3 errors in 2 files (checked 3 source files)\n"
    )
    with patch.object(
        find_easiest_modules.subprocess,
        "run",
        return_value=subprocess.CompletedProcess([], 1, output, b""),
    ):
        assert find_easiest_modules.main(()) == 0

    assert capsys.readouterr().out == "1\tsrc/sentry/z.py\n2\tsrc/sentry/a.py\n"
