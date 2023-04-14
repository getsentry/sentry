#!/usr/bin/env sentry exec

from __future__ import annotations

from scripts.silo.add_silo_decorators import SILO_KEYWORDS
from sentry.utils.silo.decorate_unit_tests import decorate_unit_tests

"""Add silo mode decorators to unit test cases en masse.

Unlike `add_silo_decorators`, this script can't really reflect on interpreted
Python code in order to distinguish unit tests. It instead relies on an external
`pytest` run to collect the list of test cases, and does some kludgey regex
business in order to apply the decorators.

Instructions for use:

From the Sentry project root, do
    pytest --collect-only | ./scripts/decorators/silo/decorate_unit_tests.py

Running `pytest` to collect unit test cases can be quite slow. To speed up
repeated runs, you can instead do
    pytest --collect-only > pytest-collect.txt
    ./scripts/decorators/silo/decorate_unit_tests.py < pytest-collect.txt
"""

if __name__ == "__main__":
    decorate_unit_tests(silo_keywords=SILO_KEYWORDS)
