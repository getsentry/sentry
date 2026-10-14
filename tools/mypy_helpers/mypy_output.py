from __future__ import annotations

import re
from dataclasses import dataclass


class InvalidMypyOutput(ValueError):
    pass


@dataclass(frozen=True)
class Diagnostic:
    filename: str | None
    severity: str
    code: str | None
    message: str


@dataclass(frozen=True)
class MypyRun:
    diagnostics: tuple[Diagnostic, ...]
    checked_sources: int
    exit_status: int

    @property
    def errors(self) -> tuple[Diagnostic, ...]:
        return tuple(item for item in self.diagnostics if item.severity == "error")


_DIAGNOSTIC = re.compile(
    r"^(?P<filename>.*?)(?::(?P<line>\d+)(?::\d+)?)?: "
    r"(?P<severity>error|note|warning): (?P<message>.*?)(?: \[(?P<code>[^]]+)\])?$"
)
_GLOBAL_ERROR = re.compile(r"^error: (?P<message>.*?)(?: \[(?P<code>[^]]+)\])?$")
_SUCCESS = re.compile(r"^Success: no issues found in (?P<checked>\d+) source files?$")
_FAILURE = re.compile(
    r"^Found (?P<errors>\d+) errors? in (?P<files>\d+) files? "
    r"\(checked (?P<checked>\d+) source files?\)$"
)


def parse_diagnostic_line(line: str) -> Diagnostic | None:
    match = _DIAGNOSTIC.fullmatch(line)
    if match is not None:
        return Diagnostic(
            match["filename"] or None,
            match["severity"],
            match["code"],
            match["message"].rstrip(),
        )
    global_error = _GLOBAL_ERROR.fullmatch(line)
    if global_error is not None:
        return Diagnostic(None, "error", global_error["code"], global_error["message"].rstrip())
    return None


def parse_mypy_output(stdout: bytes, stderr: bytes, exit_status: int) -> MypyRun:
    if stderr:
        raise InvalidMypyOutput("mypy wrote to stderr")
    try:
        output = stdout.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise InvalidMypyOutput("mypy output is not UTF-8") from exc
    if "\x00" in output:
        raise InvalidMypyOutput("mypy output contains a NUL byte")

    diagnostics: list[Diagnostic] = []
    summary: tuple[str, int, int | None] | None = None
    expected_files: int | None = None
    saw_summary = False
    for line in output.splitlines():
        if not line:
            continue
        success = _SUCCESS.fullmatch(line)
        failure = _FAILURE.fullmatch(line)
        if success is not None:
            if summary is not None:
                raise InvalidMypyOutput("mypy emitted multiple summaries")
            summary = ("success", int(success["checked"]), 0)
            saw_summary = True
            continue
        if failure is not None:
            if summary is not None:
                raise InvalidMypyOutput("mypy emitted multiple summaries")
            summary = ("failure", int(failure["checked"]), int(failure["errors"]))
            expected_files = int(failure["files"])
            saw_summary = True
            continue

        if saw_summary:
            raise InvalidMypyOutput("mypy wrote output after its summary")
        diagnostic = parse_diagnostic_line(line)
        if diagnostic is not None:
            diagnostics.append(diagnostic)
            continue
        if line.startswith((" ", "\t")) and diagnostics:
            continue
        raise InvalidMypyOutput(f"unrecognized mypy output line: {line}")

    if summary is None:
        raise InvalidMypyOutput("mypy did not emit a completion summary")

    kind, checked_sources, expected_errors = summary
    errors = [item for item in diagnostics if item.severity == "error"]
    if expected_errors != len(errors):
        raise InvalidMypyOutput("mypy summary error count does not match diagnostics")
    if kind == "failure":
        error_files = {item.filename for item in errors if item.filename is not None}
        if len(error_files) != expected_files:
            raise InvalidMypyOutput("mypy summary file count does not match diagnostics")
    expected_status = 0 if kind == "success" else 1
    if exit_status != expected_status:
        raise InvalidMypyOutput("mypy exit status does not match its completion summary")
    if any(item.filename is None for item in errors):
        raise InvalidMypyOutput("mypy reported an error without a source filename")
    return MypyRun(tuple(diagnostics), checked_sources, exit_status)
