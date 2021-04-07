# NOTE: This is run external to sentry as well as part of the setup
# process.  Thus we do not want to import non stdlib things here.

# Import the stdlib json instead of sentry.utils.json, since this command is
# run in setup.py
import json  # NOQA
import os
from distutils import log
from urllib.request import urlopen

import sentry

JS_SDK_REGISTRY_URL = (
    "https://release-registry.services.sentry.io/sdks/sentry.javascript.browser/versions"
)
LOADER_FOLDER = os.path.abspath(os.path.join(os.path.dirname(sentry.__file__), "loader"))


def dump_registry(path, data):
    fn = os.path.join(LOADER_FOLDER, path + ".json")
    directory = os.path.dirname(fn)
    try:
        os.makedirs(directory)
    except OSError:
        pass
    with open(fn, "wt", encoding="utf-8") as f:
        f.write(json.dumps(data, indent=2))
        f.write("\n")


def sync_registry():
    body = urlopen(JS_SDK_REGISTRY_URL).read().decode("utf-8")
    data = json.loads(body)
    dump_registry("_registry", data)


from .base import BaseBuildCommand


class BuildJsSdkRegistryCommand(BaseBuildCommand):
    description = "build js sdk registry"

    def run(self):
        log.info("downloading js sdk information from the release registry")
        try:
            sync_registry()
        except BaseException:
            log.error("error occurred while trying to fetch js sdk information from the registry")
