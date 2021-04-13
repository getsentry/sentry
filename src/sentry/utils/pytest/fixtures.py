"""
A number of generic default fixtures to use with tests.

All model-related fixtures defined here require the database, and should imply as much by
including ``db`` fixture in the function resolution scope.
"""

import difflib
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import pytest
import requests
import yaml

import sentry

# These chars cannot be used in Windows paths so replace them:
# https://docs.microsoft.com/en-us/windows/desktop/FileIO/naming-a-file#naming-conventions
UNSAFE_PATH_CHARS = ("<", ">", ":", '"', " | ", "?", "*")


DIRECTORY_GROUPING_CHARS = ("::", "-", "[", "]", "\\")


DEFAULT_EVENT_DATA = {
    "extra": {
        "loadavg": [0.97607421875, 0.88330078125, 0.833984375],
        "sys.argv": [
            "/Users/dcramer/.virtualenvs/sentry/bin/raven",
            "test",
            "https://ebc35f33e151401f9deac549978bda11:f3403f81e12e4c24942d505f086b2cad@sentry.io/1",
        ],
        "user": "dcramer",
    },
    "modules": {"raven": "3.1.13"},
    "request": {
        "cookies": {},
        "data": {},
        "env": {},
        "headers": {},
        "method": "GET",
        "query_string": "",
        "url": "http://example.com",
    },
    "stacktrace": {
        "frames": [
            {
                "abs_path": "www/src/sentry/models/foo.py",
                "context_line": "                        string_max_length=self.string_max_length)",
                "filename": "sentry/models/foo.py",
                "function": "build_msg",
                "in_app": True,
                "lineno": 29,
                "module": "raven.base",
                "post_context": [
                    "                },",
                    "            })",
                    "",
                    "        if 'stacktrace' in data:",
                    "            if self.include_paths:",
                ],
                "pre_context": [
                    "",
                    "            data.update({",
                    "                'stacktrace': {",
                    "                    'frames': get_stack_info(frames,",
                    "                        list_max_length=self.list_max_length,",
                ],
                "vars": {
                    "culprit": "raven.scripts.runner",
                    "date": "datetime.datetime(2013, 2, 14, 20, 6, 33, 479471)",
                    "event_id": "598fb19363e745ec8be665e6ba88b1b2",
                    "event_type": "raven.events.Message",
                    "frames": "<generator object iter_stack_frames at 0x103fef050>",
                    "handler": "<raven.events.Message object at 0x103feb710>",
                    "k": "logentry",
                    "public_key": None,
                    "result": {
                        "logentry": "{'message': 'This is a test message generated using ``raven test``', 'params': []}"
                    },
                    "self": "<raven.base.Client object at 0x104397f10>",
                    "stack": True,
                    "tags": None,
                    "time_spent": None,
                },
            },
            {
                "abs_path": "/Users/dcramer/.virtualenvs/sentry/lib/python2.7/site-packages/raven/base.py",
                "context_line": "                        string_max_length=self.string_max_length)",
                "filename": "raven/base.py",
                "function": "build_msg",
                "in_app": False,
                "lineno": 290,
                "module": "raven.base",
                "post_context": [
                    "                },",
                    "            })",
                    "",
                    "        if 'stacktrace' in data:",
                    "            if self.include_paths:",
                ],
                "pre_context": [
                    "",
                    "            data.update({",
                    "                'stacktrace': {",
                    "                    'frames': get_stack_info(frames,",
                    "                        list_max_length=self.list_max_length,",
                ],
                "vars": {
                    "culprit": "raven.scripts.runner",
                    "date": "datetime.datetime(2013, 2, 14, 20, 6, 33, 479471)",
                    "event_id": "598fb19363e745ec8be665e6ba88b1b2",
                    "event_type": "raven.events.Message",
                    "frames": "<generator object iter_stack_frames at 0x103fef050>",
                    "handler": "<raven.events.Message object at 0x103feb710>",
                    "k": "logentry",
                    "public_key": None,
                    "result": {
                        "logentry": "{'message': 'This is a test message generated using ``raven test``', 'params': []}"
                    },
                    "self": "<raven.base.Client object at 0x104397f10>",
                    "stack": True,
                    "tags": None,
                    "time_spent": None,
                },
            },
        ]
    },
    "tags": [],
    "platform": "python",
}


@pytest.fixture
def task_runner():
    from sentry.testutils.helpers.task_runner import TaskRunner

    return TaskRunner


@pytest.fixture
def burst_task_runner():
    from sentry.testutils.helpers.task_runner import BurstTaskRunner

    return BurstTaskRunner


@pytest.fixture()
def dyn_sampling_data():
    # return a function that returns fresh config so we don't accidentally get tests interfering with each other
    def inner():
        return {
            "rules": [
                {
                    "sampleRate": 0.7,
                    "type": "trace",
                    "condition": {
                        "op": "and",
                        "inner": [
                            {"op": "eq", "ignoreCase": True, "name": "field1", "value": ["val"]},
                            {"op": "glob", "name": "field1", "value": ["val"]},
                        ],
                    },
                }
            ]
        }

    return inner


_snapshot_writeback = os.environ.get("SENTRY_SNAPSHOTS_WRITEBACK") or "0"
if _snapshot_writeback in ("true", "1", "overwrite"):
    _snapshot_writeback = "overwrite"
elif _snapshot_writeback != "new":
    _snapshot_writeback = None
_test_base = os.path.realpath(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(sentry.__file__))))
)
_yaml_snap_re = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n(.*)$", re.DOTALL)


@pytest.fixture
def log():
    def inner(x):
        return sys.stdout.write(x + "\n")

    return inner


class ReadableYamlDumper(yaml.dumper.SafeDumper):
    """Disable pyyaml aliases for identical object references"""

    def ignore_aliases(self, data):
        return True


@pytest.fixture
def insta_snapshot(request, log):
    def inner(output, reference_file=None, subname=None):
        if reference_file is None:
            name = request.node.name
            for c in UNSAFE_PATH_CHARS:
                name = name.replace(c, "@")
            for c in DIRECTORY_GROUPING_CHARS:
                name = name.replace(c, "/")
            name = name.strip("/")

            if subname is not None:
                name += f"_{subname}"

            reference_file = os.path.join(
                os.path.dirname(str(request.node.fspath)),
                "snapshots",
                os.path.splitext(os.path.basename(request.node.parent.name))[0],
                name + ".pysnap",
            )
        elif subname is not None:
            raise ValueError(
                "subname only works if you don't provide your own entire reference_file"
            )

        if not isinstance(output, str):
            output = yaml.dump(
                output, indent=2, default_flow_style=False, Dumper=ReadableYamlDumper
            )

        try:
            with open(reference_file, encoding="utf-8") as f:
                match = _yaml_snap_re.match(f.read())
                if match is None:
                    raise OSError()
                _header, refval = match.groups()
        except OSError:
            refval = ""

        refval = refval.rstrip()
        output = output.rstrip()

        if _snapshot_writeback is not None and refval != output:
            if not os.path.isdir(os.path.dirname(reference_file)):
                os.makedirs(os.path.dirname(reference_file))
            source = os.path.realpath(str(request.node.fspath))
            if source.startswith(_test_base + os.path.sep):
                source = source[len(_test_base) + 1 :]
            if _snapshot_writeback == "new":
                reference_file += ".new"
            with open(reference_file, "w") as f:
                f.write(
                    "---\n%s\n---\n%s\n"
                    % (
                        yaml.safe_dump(
                            {
                                "created": datetime.utcnow().isoformat() + "Z",
                                "creator": "sentry",
                                "source": source,
                            },
                            indent=2,
                            default_flow_style=False,
                        ).rstrip(),
                        output,
                    )
                )
        elif refval != output:
            __tracebackhide__ = True
            _print_insta_diff(reference_file, refval, output)

    yield inner


def _print_insta_diff(reference_file, a, b):
    __tracebackhide__ = True
    pytest.fail(
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n"
        "Snapshot {} changed!\n\n"
        "Re-run pytest with SENTRY_SNAPSHOTS_WRITEBACK=new and then use 'make review-python-snapshots' to review.\n"
        "Or: Use SENTRY_SNAPSHOTS_WRITEBACK=1 to update snapshots directly.\n\n"
        "{}\n"
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n".format(
            reference_file, "\n".join(difflib.unified_diff(a.splitlines(), b.splitlines()))
        )
    )


@pytest.fixture
def call_snuba(settings):
    def inner(endpoint):
        return requests.post(settings.SENTRY_SNUBA + endpoint)

    return inner


@pytest.fixture
def reset_snuba(call_snuba):
    init_endpoints = (
        "/tests/events/drop",
        "/tests/groupedmessage/drop",
        "/tests/transactions/drop",
        "/tests/sessions/drop",
    )

    assert all(
        response.status_code == 200
        for response in ThreadPoolExecutor(4).map(call_snuba, init_endpoints)
    )


@pytest.fixture(scope="function")
def default_fixtures():
    from sentry.testutils.fixtures import Fixtures

    return Fixtures()


def _produce_default_fixtures(locals):
    def _produce(propname):
        def default_fixture(default_fixtures):
            return getattr(default_fixtures, propname)

        default_fixture.__name__ = name = f"default_{propname}"

        locals[name] = pytest.fixture(scope="function")(default_fixture)

    # This list of fixtures to export is hardcoded because at this time we
    # cannot actually import Fixtures for inspection.
    for propname in [
        "session",
        "projectkey",
        "user",
        "organization",
        "team",
        "project",
        "release",
        "environment",
        "group",
        "event",
        "activity",
    ]:
        _produce(propname)


_produce_default_fixtures(locals())
