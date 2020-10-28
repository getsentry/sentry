# NOTE: This is run external to sentry as well as part of the setup
# process.  Thus we do not want to import non stdlib things here.
from __future__ import absolute_import

# Import the stdlib json instead of sentry.utils.json, since this command is
# run in setup.py
import json  # NOQA

import io
import os
import sys
from distutils import log

import sentry

JS_SDK_REGISTRY_URL = (
    "https://release-registry.services.sentry.io/sdks/sentry.javascript.browser/versions"
)
LOADER_FOLDER = os.path.abspath(os.path.join(os.path.dirname(sentry.__file__), "loader"))

# We cannot leverage six here, so we need to vendor
# bits that we need.
if sys.version_info[0] == 3:
    unicode = str  # NOQA
    from urllib.request import urlopen
else:
    from urllib2 import urlopen


def dump_registry(path, data):
    fn = os.path.join(LOADER_FOLDER, path + ".json")
    directory = os.path.dirname(fn)
    try:
        os.makedirs(directory)
    except OSError:
        pass
    with io.open(fn, "wt", encoding="utf-8") as f:
        # XXX: ideally, we use six.text_type here, but we can't use six.
        f.write(unicode(json.dumps(data, indent=2)))  # NOQA
        f.write(u"\n")


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
