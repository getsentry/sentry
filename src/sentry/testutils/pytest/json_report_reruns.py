from typing import int
"""Extend the pytest-json-report plugin with a new "reruns" attribute.

Each test will (if it's run more than once) store its prior results in a
`reruns` array attribute, where each item may have `setup` `call` and
`teardown` sections.

See also:
    * https://github.com/pytest-dev/pytest-rerunfailures
    * https://github.com/numirias/pytest-json-report
    * https://getsentry.atlassian.net/browse/DEVINFRA-630
"""

import pytest
import pytest_jsonreport.plugin

JSONTestItem = dict[str, list[object]]
JSONTestItems = dict[str, JSONTestItem]


def pytest_plugin_registered(plugin: object, manager: pytest.PytestPluginManager) -> None:
    """Only register if/when the plugin we're extending is registered."""
    if isinstance(plugin, pytest_jsonreport.plugin.JSONReport):
        json_tests = getattr(plugin, "_json_tests")
        manager.register(PytestRerunJSONReporter(json_tests))


class PytestRerunJSONReporter:
    def __init__(self, json_tests: JSONTestItems):
        self.json_tests = json_tests

    def pytest_json_runtest_stage(self, report: pytest.TestReport) -> None:
        assert self.json_tests is not None

        nodeid = report.nodeid
        json_testitem = self.json_tests[nodeid]
        if report.when in json_testitem:
            # this is a new result of some kind -- record all prior data as a
            # "rerun" and start over fresh
            reruns = json_testitem.setdefault("reruns", [])
            reruns.append(
                {
                    key: json_testitem.pop(key)
                    for key in ("setup", "call", "teardown")
                    if key in json_testitem
                }
            )
