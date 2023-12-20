from __future__ import annotations

import concurrent.futures

# Import the stdlib json instead of sentry.utils.json, since this command is
# run at build time
import json  # noqa: S003
import logging
import multiprocessing
import os
import sys
import time
from typing import IO, Any, TypedDict
from urllib.request import urlopen

import sentry

# NOTE: This is run external to sentry as well as part of the setup
# process.  Thus we do not want to import non stdlib things here.


class Integration(TypedDict):
    key: str
    type: str
    details: str
    doc_link: str
    name: str
    aliases: list[str]
    categories: list[str]


class Platform(TypedDict):
    id: str
    name: str
    integrations: list[dict[str, str]]


INTEGRATION_DOCS_URL = os.environ.get("INTEGRATION_DOCS_URL", "https://docs.sentry.io/_platforms/")
BASE_URL = INTEGRATION_DOCS_URL + "{}"

# Also see INTEGRATION_DOC_FOLDER in setup.py
DOC_FOLDER = os.environ.get("INTEGRATION_DOC_FOLDER") or os.path.abspath(
    os.path.join(os.path.dirname(sentry.__file__), "integration-docs")
)


class SuspiciousDocPathOperation(Exception):
    """A suspicious operation was attempted while accessing the doc path"""


"""
Looking to add a new framework/language to /settings/install?

In the appropriate client SDK repository (e.g. raven-js), edit docs/sentry-doc-config.json.
Add the new language/framework.

Example: https://github.com/getsentry/raven-js/blob/master/docs/sentry-doc-config.json

Once the docs have been deployed, you can run `sentry repair --with-docs` to pull down
the latest list of integrations and serve them in your local Sentry install.
"""

logger = logging.getLogger("sentry")


def echo(what: str) -> None:
    sys.stdout.write(what + "\n")
    sys.stdout.flush()


def dump_doc(path: str, data: dict[str, Any]) -> None:
    expected_commonpath = os.path.realpath(DOC_FOLDER)
    doc_path = os.path.join(DOC_FOLDER, f"{path}.json")
    doc_real_path = os.path.realpath(doc_path)

    if expected_commonpath != os.path.commonpath([expected_commonpath, doc_real_path]):
        raise SuspiciousDocPathOperation("illegal path access")

    directory = os.path.dirname(doc_path)
    try:
        os.makedirs(directory)
    except OSError:
        pass
    with open(doc_path, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, indent=2))
        f.write("\n")


def load_doc(path: str) -> dict[str, Any] | None:
    expected_commonpath = os.path.realpath(DOC_FOLDER)
    doc_path = os.path.join(DOC_FOLDER, f"{path}.json")
    doc_real_path = os.path.realpath(doc_path)

    if expected_commonpath != os.path.commonpath([expected_commonpath, doc_real_path]):
        raise SuspiciousDocPathOperation("illegal path access")

    try:
        with open(doc_path, encoding="utf-8") as f:
            return json.load(f)
    except OSError:
        return None


def get_integration_id(platform_id: str, integration_id: str) -> str:
    if integration_id == "_self":
        return platform_id
    return f"{platform_id}-{integration_id}"


def urlopen_with_retries(url: str, timeout: int = 5, retries: int = 10) -> IO[bytes]:
    for i in range(retries):
        try:
            return urlopen(url, timeout=timeout)
        except Exception:
            if i == retries - 1:
                raise
            time.sleep(i * 0.01)
    else:
        raise AssertionError("unreachable")


def sync_docs(quiet: bool = False) -> None:
    if not quiet:
        echo("syncing documentation (platform index)")
    data: dict[str, dict[str, dict[str, Integration]]]
    data = json.load(urlopen_with_retries(BASE_URL.format("_index.json")))
    platform_list: list[Platform] = []
    for platform_id, integrations in data["platforms"].items():
        platform_list.append(
            {
                "id": platform_id,
                "name": integrations["_self"]["name"],
                "integrations": [
                    {
                        "id": get_integration_id(platform_id, i_id),
                        "name": i_data["name"],
                        "type": i_data["type"],
                        "link": i_data["doc_link"],
                    }
                    for i_id, i_data in sorted(integrations.items(), key=lambda x: x[1]["name"])
                ],
            }
        )

    platform_list.sort(key=lambda x: x["name"])

    dump_doc("_platforms", {"platforms": platform_list})

    # This value is derived from https://docs.python.org/3/library/concurrent.futures.html#threadpoolexecutor
    MAX_THREADS = 32
    thread_count = min(len(data["platforms"]), multiprocessing.cpu_count() * 5, MAX_THREADS)
    with concurrent.futures.ThreadPoolExecutor(thread_count) as exe:
        for future in concurrent.futures.as_completed(
            exe.submit(
                sync_integration_docs,
                platform_id,
                integration_id,
                integration["details"],
                quiet,
            )
            for platform_id, platform_data in data["platforms"].items()
            for integration_id, integration in platform_data.items()
        ):
            future.result()  # needed to trigger exceptions


def sync_integration_docs(
    platform_id: str, integration_id: str, path: str, quiet: bool = False
) -> None:
    if not quiet:
        echo(f"  syncing documentation for {platform_id}.{integration_id} integration")

    data = json.load(urlopen_with_retries(BASE_URL.format(path)))

    key = get_integration_id(platform_id, integration_id)

    dump_doc(
        key,
        {
            "id": key,
            "name": data["name"],
            "html": data["body"],
            "link": data["doc_link"],
            "wizard_setup": data.get("wizard_setup", None),
        },
    )
