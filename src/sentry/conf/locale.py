from __future__ import absolute_import

import os
import sentry

from sentry.utils import json


# change locale file dir name to locale code
def dirname_to_local(dir_name):
    if "_" in dir_name:
        pre, post = dir_name.split("_", 1)
        dir_name = u"{}-{}".format(pre, post.lower())
    return dir_name


with open(os.path.join(os.path.dirname(sentry.__file__), "locale", "catalogs.json"), "r") as f:
    CATALOGS = json.load(f)["supported_locales"]
    CATALOGS = [dirname_to_local(dirname) for dirname in CATALOGS]
