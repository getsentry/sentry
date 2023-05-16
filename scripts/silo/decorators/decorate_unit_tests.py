#!/usr/bin/env sentry exec

from __future__ import annotations

from sentry.testutils.modelmanifest import ModelManifest
from sentry.utils.silo.decorate_unit_tests import decorate_unit_tests

"""Add silo mode decorators to unit test cases en masse.

Unlike `add_silo_decorators`, this script can't really reflect on interpreted
Python code in order to distinguish unit tests. It instead relies on an external
`pytest` run to collect the list of test cases, and does some kludgey regex
business in order to apply the decorators.

Instructions for use:

From the Sentry project root, do
    pytest --collect-only | ./scripts/silo/decorators/decorate_unit_tests.py

Running `pytest` to collect unit test cases can be quite slow. To speed up
repeated runs, you can instead do
    pytest --collect-only > pytest-collect.txt
    ./scripts/silo/decorators/decorate_unit_tests.py < pytest-collect.txt
"""

_MODEL_MANIFEST_FILE_PATH = "./model-manifest.json"  # os.getenv("SENTRY_MODEL_MANIFEST_FILE_PATH")
global _model_manifest
_model_manifest = ModelManifest.open(_MODEL_MANIFEST_FILE_PATH)

if __name__ == "__main__":
    decorate_unit_tests(_model_manifest)
