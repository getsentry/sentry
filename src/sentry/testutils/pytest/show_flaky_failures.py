from _pytest.terminal import TerminalReporter


def pytest_terminal_summary(terminalreporter: TerminalReporter) -> None:
    return terminalreporter.summary_failures_combined("rerun", "FLAKES")
