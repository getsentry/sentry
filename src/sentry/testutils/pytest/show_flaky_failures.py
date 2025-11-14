from typing import int
from _pytest.reports import BaseReport
from _pytest.terminal import TerminalReporter


# see also: TerminalReporter.print_teardown_sections
def print_section(terminalreporter: TerminalReporter, secname: str, content: str) -> None:
    terminalreporter.write_sep("-", secname)
    if content[-1:] == "\n":
        content = content[:-1]
    terminalreporter.line(content)


# see also: TerminalReporter._handle_teardown_sections
def _handle_teardown_sections(terminalreporter: TerminalReporter, nodeid: str) -> None:
    reports = terminalreporter.getreports("")
    for report in reports:
        if report.when == "teardown" and report.nodeid == nodeid:
            for secname, content in report.sections:
                if "teardown" in secname:
                    print_section(terminalreporter, secname, content)
                    return


def pytest_terminal_summary(
    terminalreporter: TerminalReporter,
) -> None:
    """lightly customized, from terminalreporter.summary_failures_combined"""
    flakes: list[BaseReport] = terminalreporter.getreports("rerun")
    if not flakes:
        return

    header_done = False

    # "hard" failures are already reported, elsewhere
    test_seen: set[str] = set()
    for flake in flakes:
        # we only care to see the _first_ flaky failure in the log
        if flake.nodeid in test_seen:
            continue
        else:
            test_seen.add(flake.nodeid)

        if not header_done:
            terminalreporter.write_sep("=", "FLAKES (original error)")
            header_done = True

        terminalreporter.write_sep("_", flake.head_line, red=True, bold=True)
        terminalreporter._outrep_summary(flake)
        _handle_teardown_sections(terminalreporter, flake.nodeid)
