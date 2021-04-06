# NOTE: This is run external to sentry as well as part of the setup
# process.  Thus we do not want to import non stdlib things here.

# Import the stdlib json instead of sentry.utils.json, since this command is
# run at build time
import json  # NOQA
import logging
import multiprocessing
import multiprocessing.dummy
import os
import sys
import time
from urllib.request import urlopen

import sentry

BASE_URL = "https://docs.sentry.io/_platforms/{}"

# Also see INTEGRATION_DOC_FOLDER in setup.py
DOC_FOLDER = os.environ.get("INTEGRATION_DOC_FOLDER") or os.path.abspath(
    os.path.join(os.path.dirname(sentry.__file__), "integration-docs")
)

"""
Looking to add a new framework/language to /settings/install?

In the appropriate client SDK repository (e.g. raven-js), edit docs/sentry-doc-config.json.
Add the new language/framework.

Example: https://github.com/getsentry/raven-js/blob/master/docs/sentry-doc-config.json

Once the docs have been deployed, you can run `sentry repair --with-docs` to pull down
the latest list of integrations and serve them in your local Sentry install.
"""

logger = logging.getLogger("sentry")


def iteritems(d, **kw):
    return iter(d.items(**kw))


def echo(what):
    sys.stdout.write(what + "\n")
    sys.stdout.flush()


def dump_doc(path, data):
    fn = os.path.join(DOC_FOLDER, path + ".json")
    directory = os.path.dirname(fn)
    try:
        os.makedirs(directory)
    except OSError:
        pass
    with open(fn, "wt", encoding="utf-8") as f:
        f.write(json.dumps(data, indent=2))
        f.write("\n")


def load_doc(path):
    if "/" in path:
        return None
    fn = os.path.join(DOC_FOLDER, path + ".json")
    try:
        with open(fn, encoding="utf-8") as f:
            return json.load(f)
    except OSError:
        return None


def get_integration_id(platform_id, integration_id):
    if integration_id == "_self":
        return platform_id
    return f"{platform_id}-{integration_id}"


def urlopen_with_retries(url, timeout=5, retries=10):
    for i in range(retries):
        try:
            return urlopen(url, timeout=timeout)
        except Exception:
            if i == retries - 1:
                raise
            time.sleep(i * 0.01)


def sync_docs(quiet=False):
    if not quiet:
        echo("syncing documentation (platform index)")
    body = urlopen_with_retries(BASE_URL.format("_index.json")).read().decode("utf-8")
    data = json.loads(body)
    platform_list = []
    for platform_id, integrations in iteritems(data["platforms"]):
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
                    for i_id, i_data in sorted(iteritems(integrations), key=lambda x: x[1]["name"])
                ],
            }
        )

    platform_list.sort(key=lambda x: x["name"])

    dump_doc("_platforms", {"platforms": platform_list})

    # This value is derived from https://docs.python.org/3/library/concurrent.futures.html#threadpoolexecutor
    MAX_THREADS = 32
    # TODO(python3): Migrate this to concurrent.futures.ThreadPoolExecutor context manager
    executor = multiprocessing.dummy.Pool(
        min(len(data["platforms"]), multiprocessing.cpu_count() * 5, MAX_THREADS)
    )
    for platform_id, platform_data in iteritems(data["platforms"]):
        for integration_id, integration in iteritems(platform_data):
            executor.apply_async(
                sync_integration_docs, (platform_id, integration_id, integration["details"], quiet)
            )
    executor.close()
    executor.join()


def sync_integration_docs(platform_id, integration_id, path, quiet=False):
    if not quiet:
        echo(f"  syncing documentation for {platform_id}.{integration_id} integration")

    data = json.load(urlopen_with_retries(BASE_URL.format(path)))

    key = get_integration_id(platform_id, integration_id)

    dump_doc(key, {"id": key, "name": data["name"], "html": data["body"], "link": data["doc_link"]})


def integration_doc_exists(integration_id):
    # We use listdir() here as integration_id comes from user data
    # and using os.path.join() would allow directory traversal vulnerabilities
    # which we don't want.
    docs = os.listdir(DOC_FOLDER)
    filename = f"{integration_id}.json"
    return filename in docs
