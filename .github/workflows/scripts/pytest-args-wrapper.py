# we need this so we don't exceed ARGS_MAX on linux/macos
# trying to pass large strings directly to pytest cli

import sys

import pytest

if len(sys.argv) < 2:
    print("Usage: pytest-args-wrapper.py <test-node-ids.txt> [pytest args...]")
    sys.exit(1)

testnodeids_file = sys.argv[1]
with open(testnodeids_file) as f:
    nodeids = [line.strip() for line in f.readlines() if line.strip()]

pytest_args = sys.argv[2:]
sys.exit(pytest.main(pytest_args + nodeids))
