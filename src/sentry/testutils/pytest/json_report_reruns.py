import pytest_jsonreport.plugin


class PytestRerunJSONReporter:
    json_tests: None | dict[str, object] = None

    def pytest_plugin_registered(self, plugin, manager):
        del manager
        if isinstance(plugin, pytest_jsonreport.plugin.JSONReport):
            self.json_tests = plugin._json_tests

    def pytest_json_runtest_stage(self, report):
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


def pytest_configure(config):
    config.pluginmanager.register(PytestRerunJSONReporter())
