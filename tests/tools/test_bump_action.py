import subprocess
from unittest import mock

import pytest

from tools.bump_action import main


@pytest.fixture
def workflow_and_action(tmp_path):
    base = tmp_path.joinpath("root")

    base.joinpath(".github/workflows").mkdir(parents=True)
    workflow = base.joinpath(".github/workflows/main.yml")

    base.joinpath(".github/actions/myaction").mkdir(parents=True)
    action = base.joinpath(".github/actions/myaction/action.yml")

    yield base, workflow, action


def test_main_noop(workflow_and_action, capsys):
    base, workflow, action = workflow_and_action

    workflow_src = """\
name: main
on:
  push:
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
    - run: echo hi
"""

    action_src = """\
name: my-action
inputs:
  arg:
    required: true

runs:
  using: composite
  steps:
  - run: echo hi
    shell: bash
"""

    workflow.write_text(workflow_src)
    action.write_text(action_src)

    assert main(("actions/whatever", "v1.2.3", f"--base-dir={base}")) == 0
    out, err = capsys.readouterr()
    assert out == err == ""


def test_main_upgrades_action(workflow_and_action, capsys):
    base, workflow, action = workflow_and_action

    workflow_src = """\
name: main
on:
  push:
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/whatever@v0.1.2
"""
    workflow_expected = """\
name: main
on:
  push:
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/whatever@v1.2.3
"""

    action_src = """\
name: my-action
inputs:
  arg:
    required: true

runs:
  using: composite
  steps:
  - uses: actions/whatever@v0.1.2
"""
    action_expected = """\
name: my-action
inputs:
  arg:
    required: true

runs:
  using: composite
  steps:
  - uses: actions/whatever@v1.2.3
"""

    workflow.write_text(workflow_src)
    action.write_text(action_src)

    with mock.patch.object(subprocess, "call", return_value=123):
        assert main(("actions/whatever", "v1.2.3", f"--base-dir={base}")) == 123

    out, err = capsys.readouterr()
    assert (
        out
        == f"""\
{workflow} upgrading actions/whatever...
{action} upgrading actions/whatever...
freezing...
"""
    )

    assert workflow.read_text() == workflow_expected
    assert action.read_text() == action_expected
