# we need this so we don't exceed ARGS_MAX on linux/macos

import sys
from pathlib import Path

import pytest

if len(sys.argv) < 2:
    print("Usage: pytest-args-wrapper.py <testlist.txt> [pytest args...]")
    sys.exit(1)

testlist_file = Path(sys.argv[1])
if not testlist_file.exists():
    print(f"Test list file not found: {testlist_file}")
    sys.exit(1)

with testlist_file.open() as f:
    test_ids = [line.strip() for line in f if line.strip()]

extra_args = sys.argv[2:]
pytest_args = test_ids + extra_args

sys.exit(pytest.main(pytest_args))
