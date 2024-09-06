from __future__ import annotations

import argparse
import concurrent.futures
import json
import multiprocessing
import os.path

from sentry.build._download import urlopen_with_retries

_INTEGRATION_DOCS_URL = os.environ.get("INTEGRATION_DOCS_URL", "https://docs.sentry.io/_platforms/")

_HERE = os.path.dirname(os.path.abspath(__file__))
_TARGET = os.path.join(_HERE, "..", "integration-docs")


def _integration_id(platform_id: str, integration_id: str) -> str:
    if integration_id == "_self":
        return platform_id
    return f"{platform_id}-{integration_id}"


def _dump_doc(dest: str, path: str, data: object) -> None:
    expected_commonpath = os.path.realpath(dest)
    doc_path = os.path.join(dest, f"{path}.json")
    doc_real_path = os.path.realpath(doc_path)

    if expected_commonpath != os.path.commonpath([expected_commonpath, doc_real_path]):
        raise AssertionError("illegal path access")

    directory = os.path.dirname(doc_path)
    os.makedirs(directory, exist_ok=True)
    with open(doc_path, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, indent=2))
        f.write("\n")


def _sync_one(
    dest: str, platform_id: str, integration_id: str, path: str, quiet: bool = False
) -> None:
    if not quiet:
        print(f"  syncing documentation for {platform_id}.{integration_id} integration")

    data = json.load(urlopen_with_retries(f"{_INTEGRATION_DOCS_URL}{path}"))

    key = _integration_id(platform_id, integration_id)

    _dump_doc(
        dest,
        key,
        {
            "id": key,
            "name": data["name"],
            "html": data["body"],
            "link": data["doc_link"],
            "wizard_setup": data.get("wizard_setup", None),
        },
    )


def _sync_docs(dest: str, *, quiet: bool = False) -> None:
    if not quiet:
        print("syncing documentation (platform index)")
    data = json.load(urlopen_with_retries(f"{_INTEGRATION_DOCS_URL}_index.json"))
    platform_list = []
    for platform_id, integrations in data["platforms"].items():
        platform_list.append(
            {
                "id": platform_id,
                "name": integrations["_self"]["name"],
                "integrations": [
                    {
                        "id": _integration_id(platform_id, i_id),
                        "name": i_data["name"],
                        "type": i_data["type"],
                        "link": i_data["doc_link"],
                    }
                    for i_id, i_data in sorted(integrations.items(), key=lambda x: x[1]["name"])
                ],
            }
        )

    platform_list.sort(key=lambda x: x["name"])

    _dump_doc(dest, "_platforms", {"platforms": platform_list})

    # This value is derived from https://docs.python.org/3/library/concurrent.futures.html#threadpoolexecutor
    MAX_THREADS = 32
    thread_count = min(len(data["platforms"]), multiprocessing.cpu_count() * 5, MAX_THREADS)
    with concurrent.futures.ThreadPoolExecutor(thread_count) as exe:
        for future in concurrent.futures.as_completed(
            exe.submit(
                _sync_one,
                dest,
                platform_id,
                integration_id,
                integration["details"],
                quiet=quiet,
            )
            for platform_id, platform_data in data["platforms"].items()
            for integration_id, integration in platform_data.items()
        ):
            future.result()  # needed to trigger exceptions


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dest", default=_TARGET)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    _sync_docs(args.dest, quiet=args.quiet)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
