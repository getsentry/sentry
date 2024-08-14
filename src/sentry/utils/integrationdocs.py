from __future__ import annotations

import os
from typing import Any

import orjson

import sentry

DOC_FOLDER = os.path.abspath(os.path.join(os.path.dirname(sentry.__file__), "integration-docs"))


class SuspiciousDocPathOperation(Exception):
    """A suspicious operation was attempted while accessing the doc path"""


"""
Looking to add a new framework/language to /settings/install?

In the appropriate client SDK repository (e.g. raven-js), edit docs/sentry-doc-config.json.
Add the new language/framework.

Example: https://github.com/getsentry/raven-js/blob/master/docs/sentry-doc-config.json

Once the docs have been deployed, you can run `make build-platform-assets` to pull down
the latest list of integrations and serve them in your local Sentry install.
"""


def load_doc(path: str) -> dict[str, Any] | None:
    expected_commonpath = os.path.realpath(DOC_FOLDER)
    doc_path = os.path.join(DOC_FOLDER, f"{path}.json")
    doc_real_path = os.path.realpath(doc_path)

    if expected_commonpath != os.path.commonpath([expected_commonpath, doc_real_path]):
        raise SuspiciousDocPathOperation("illegal path access")

    try:
        with open(doc_path, encoding="utf-8") as f:
            return orjson.loads(f.read())
    except OSError:
        return None
