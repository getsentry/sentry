from __future__ import annotations

import os
from importlib import import_module
from typing import Any

import pytest

json_report_plugin = import_module("pytest_jsonreport.plugin")
JSONReport: Any = json_report_plugin.JSONReport
JSONReportWorker: Any = json_report_plugin.JSONReportWorker

_WORKER_ENV = "_PYTEST_PARALLEL_WORKER"


class JSONReportRouting:
    def __init__(self) -> None:
        self._controller_report: JSONReport | None = None

    @pytest.hookimpl(tryfirst=True)
    def pytest_plugin_registered(
        self,
        plugin: object,
        plugin_name: str,
        manager: pytest.PytestPluginManager,
    ) -> None:
        if isinstance(plugin, JSONReportWorker):
            if os.environ.get(_WORKER_ENV) == "1":
                return
            raise RuntimeError("pytest-json-report registered a worker collector in the controller")
        if not isinstance(plugin, JSONReport):
            return

        if os.environ.get(_WORKER_ENV) == "1":
            raise RuntimeError("pytest-json-report created a report writer in a parallel worker")
        self._controller_report = plugin

    @pytest.hookimpl(tryfirst=True)
    def pytest_configure(self, config: pytest.Config) -> None:
        if os.environ.get(_WORKER_ENV) == "1":
            json_report_plugin.__dict__["JSONReport"] = JSONReportWorker

    @pytest.hookimpl(trylast=True)
    def pytest_runtest_logreport(self, report: pytest.TestReport) -> None:
        if report.outcome != "passed" or self._controller_report is None:
            return
        item = self._controller_report._json_tests.get(report.nodeid)
        if item is not None and item.get("outcome") == "rerun":
            item["outcome"] = "passed"
