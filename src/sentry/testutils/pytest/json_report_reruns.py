"""Extend the pytest-json-report plugin with "reruns" and "subtests" attributes.

Each test will (if it's run more than once) store its prior results in a
`reruns` array attribute, where each item may have `setup` `call` `teardown`
and `subtests` sections.

Subtest reports share the parent's nodeid and `when == "call"`, so they are
kept in a `subtests` array instead of looking like reruns of the call.

See also:
    * https://github.com/pytest-dev/pytest-rerunfailures
    * https://github.com/numirias/pytest-json-report
    * https://docs.pytest.org/en/stable/how-to/subtests.html
    * https://getsentry.atlassian.net/browse/DEVINFRA-630
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Generator
from typing import Any

import pytest
import pytest_jsonreport.plugin
from _pytest._io.saferepr import saferepr

JSONTestItem = dict[str, Any]
JSONTestItems = dict[str, JSONTestItem]

PHASES = ("setup", "call", "teardown")


def pytest_plugin_registered(plugin: object, manager: pytest.PytestPluginManager) -> None:
    """Only register if/when the plugin we're extending is registered."""
    if isinstance(plugin, pytest_jsonreport.plugin.JSONReport):
        json_tests = getattr(plugin, "_json_tests")
        manager.register(PytestRerunJSONReporter(json_tests))


class PytestRerunJSONReporter:
    def __init__(self, json_tests: JSONTestItems):
        self.json_tests = json_tests
        # rerunfailures logs an attempt's reports when it ends, but subtest
        # reports arrive live, so hold them until their attempt's call report.
        self.pending_subtests: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)

    @pytest.hookimpl(wrapper=True)
    def pytest_runtest_logreport(
        self, report: pytest.TestReport
    ) -> Generator[None, object, object]:
        if not isinstance(report, pytest.SubtestReport):
            return (yield)

        # JSONReport stores the subtest as the call stage and its outcome as
        # "subtests passed", so put both back.
        before = self.json_tests.get(report.nodeid, {})
        prior = {"outcome": "passed"} | {
            k: before[k] for k in (report.when, "outcome") if k in before
        }
        result = yield
        json_testitem = self.json_tests[report.nodeid]
        stage = json_testitem.pop(report.when)
        json_testitem.update(prior)
        # On an xdist controller the parent's report doesn't count failed subtests.
        if report.failed:
            json_testitem["outcome"] = "failed"

        context = report.context
        self.pending_subtests[report.nodeid].append(
            {
                **stage,
                "context": {
                    "msg": context.msg,
                    "kwargs": {str(k): saferepr(v) for k, v in context.kwargs.items()},
                },
            }
        )
        return result

    def pytest_json_runtest_stage(self, report: pytest.TestReport) -> None:
        if isinstance(report, pytest.SubtestReport):
            return

        json_testitem = self.json_tests[report.nodeid]
        if report.when in json_testitem:
            # this is a new result of some kind -- record all prior data as a
            # "rerun" and start over fresh
            reruns = json_testitem.setdefault("reruns", [])
            reruns.append(
                {
                    key: json_testitem.pop(key)
                    for key in (*PHASES, "subtests")
                    if key in json_testitem
                }
            )
        if report.when == "call":
            subtests = self.pending_subtests.pop(report.nodeid, None)
            if subtests:
                json_testitem["subtests"] = subtests
