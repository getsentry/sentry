"""Extend the pytest-json-report plugin with "reruns" and "subtests" attributes.

Each test will (if it's run more than once) store its prior results in a
`reruns` array attribute, where each item may have `setup` `call` `teardown`
and `subtests` sections.

pytest 9 subtests (the `subtests` fixture) log one extra `call` report per
subtest under the parent's nodeid. pytest-json-report stores each of them as
the test's `call` stage, which made every subtest look like a rerun. They are
kept in a separate `subtests` array instead, next to the `call` they ran in,
each with its `context` (the `msg` and `kwargs` given to `subtests.test()`).
A passing subtest leaves the test's top-level `outcome` alone; a failing one
sets it to "failed".

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
        # pytest-rerunfailures holds back an attempt's setup/call/teardown
        # reports until the attempt ends, but subtest reports are logged live
        # from inside the call. Buffer them until the call they belong to.
        self.pending_subtests: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)

    @pytest.hookimpl(wrapper=True)
    def pytest_runtest_logreport(
        self, report: pytest.TestReport
    ) -> Generator[None, object, object]:
        if not isinstance(report, pytest.SubtestReport):
            return (yield)

        # JSONReport's own hook writes every report to json_testitem[report.when]
        # and may replace the outcome (e.g. with "subtests passed"). Undo both.
        missing = object()
        before = self.json_tests.get(report.nodeid, {})
        prior_stage = before.get(report.when, missing)
        prior_outcome = before.get("outcome", "passed")

        result = yield

        json_testitem = self.json_tests[report.nodeid]
        stage = json_testitem.pop(report.when)
        if prior_stage is not missing:
            json_testitem[report.when] = prior_stage
        # The parent's own report only turns "failed" when the subtests plugin
        # on the same process counted the failure, which isn't the case on an
        # xdist controller.
        json_testitem["outcome"] = "failed" if report.failed else prior_outcome

        context = report.context
        self.pending_subtests[report.nodeid].append(
            {
                **stage,
                # kwargs can hold arbitrary objects (factories, classes), so
                # keep the repr pytest prints in SUBFAILED lines.
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
