import pytest

from tools.mypy_helpers.mypy_output import InvalidMypyOutput, parse_mypy_output


def test_notes_and_multiline_messages_do_not_count_as_errors() -> None:
    run = parse_mypy_output(
        b"src/sentry/a.py: note: retained context\n"
        b"src/sentry/a.py:4: error: invalid value [arg-type]\n"
        b"    extra detail\n"
        b"src/sentry/a.py: note: expanded from here\n"
        b"Found 1 error in 1 file (checked 2 source files)\n",
        b"",
        1,
    )

    assert run.checked_sources == 2
    assert len(run.errors) == 1
    assert run.errors[0].filename == "src/sentry/a.py"
    assert run.errors[0].code == "arg-type"


@pytest.mark.parametrize(
    ("stdout", "stderr", "exit_status"),
    [
        (b"Fatal: plugin crashed\n", b"", 2),
        (b"Success: no issues found in 1 source file\n", b"warning", 0),
        (b"Success: no issues found in 1 source file\n", b"", 1),
        (
            b"src/a.py:1: error: bad [misc]\nFound 2 errors in 1 file (checked 1 source file)\n",
            b"",
            1,
        ),
        (b"Success: no issues found in 1 source", b"", 0),
    ],
)
def test_invalid_or_incomplete_mypy_output_is_rejected(
    stdout: bytes, stderr: bytes, exit_status: int
) -> None:
    with pytest.raises(InvalidMypyOutput):
        parse_mypy_output(stdout, stderr, exit_status)
