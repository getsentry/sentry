import pyperf

from sentry.utils.pytest.sentry import pytest_configure

pytest_configure({})

from sentry.ownership.grammar import Matcher

runner = pyperf.Runner()


example_issue_data = {
    "stacktrace": {
        "frames": [{"filename": "foo/file.py"}, {"abs_path": "/usr/local/src/other/app.py"}]
    }
}


def baseline_func():
    Matcher("codeowners", "*.js").test(example_issue_data)


def improved_func():
    Matcher("codeowners", "*.js").test(example_issue_data, True)


runner.bench_func("baseline_func", baseline_func)
runner.bench_func("improved_func", improved_func)
