# NOTE: This is run external to sentry as well as part of the setup
# process.  Thus we do not want to import non stdlib things here.
from __future__ import absolute_import

import io
import multiprocessing
import multiprocessing.dummy
import os
import sys
import logging
import time

# Import the stdlib json instead of sentry.utils.json, since this command is
# run at build time
import json  # NOQA

import sentry

BASE_URL = "https://docs.sentry.io/_platforms/{}"

# Also see INTEGRATION_DOC_FOLDER in setup.py
DOC_FOLDER = os.environ.get("INTEGRATION_DOC_FOLDER") or os.path.abspath(
    os.path.join(os.path.dirname(sentry.__file__), "integration-docs")
)

# We cannot leverage six here, so we need to vendor
# bits that we need.
if sys.version_info[0] == 3:
    unicode = str  # NOQA

    def iteritems(d, **kw):
        return iter(d.items(**kw))

    from urllib.request import urlopen

else:

    def iteritems(d, **kw):
        return d.iteritems(**kw)  # NOQA

    from urllib2 import urlopen
"""
Looking to add a new framework/language to /settings/install?

In the appropriate client SDK repository (e.g. raven-js), edit docs/sentry-doc-config.json.
Add the new language/framework.

Example: https://github.com/getsentry/raven-js/blob/master/docs/sentry-doc-config.json

Once the docs have been deployed, you can run `sentry repair --with-docs` to pull down
the latest list of integrations and serve them in your local Sentry install.
"""

logger = logging.getLogger("sentry")


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
    with io.open(fn, "wt", encoding="utf-8") as f:
        # XXX: ideally, we use six.text_type here, but we can't use six.
        f.write(unicode(json.dumps(data, indent=2)))  # NOQA
        f.write(u"\n")


def load_doc(path):
    if "/" in path:
        return None
    fn = os.path.join(DOC_FOLDER, path + ".json")
    try:
        with io.open(fn, "rt", encoding="utf-8") as f:
            return json.load(f)
    except IOError:
        return None


def get_integration_id(platform_id, integration_id):
    if integration_id == "_self":
        return platform_id
    return u"{}-{}".format(platform_id, integration_id)


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
        echo("  syncing documentation for %s.%s integration" % (platform_id, integration_id))

    data = json.load(urlopen_with_retries(BASE_URL.format(path)))

    key = get_integration_id(platform_id, integration_id)

    dump_doc(key, {"id": key, "name": data["name"], "html": data["body"], "link": data["doc_link"]})


def integration_doc_exists(integration_id):
    # We use listdir() here as integration_id comes from user data
    # and using os.path.join() would allow directory traversal vulnerabilities
    # which we don't want.
    docs = os.listdir(DOC_FOLDER)
    filename = u"{}.json".format(integration_id)
    return filename in docs
