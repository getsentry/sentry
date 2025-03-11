import pytest
import pytest_jsonreport.plugin  # type:ignore[import-untyped]

TestItem = dict[str, list[object]]


class PytestRerunJSONReporter:
    json_tests: None | dict[str, TestItem] = None

    def pytest_plugin_registered(self, plugin: object) -> None:
        if isinstance(plugin, pytest_jsonreport.plugin.JSONReport):
            self.json_tests = getattr(plugin, "_json_tests")

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


def pytest_configure(config: pytest.Config) -> None:
    config.pluginmanager.register(PytestRerunJSONReporter())
