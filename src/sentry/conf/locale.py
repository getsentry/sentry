import os

import orjson

import sentry


# change locale file dir name to locale code
def dirname_to_local(dir_name):
    if "_" in dir_name:
        pre, post = dir_name.split("_", 1)
        dir_name = f"{pre}-{post.lower()}"
    return dir_name


with open(os.path.join(os.path.dirname(sentry.__file__), "locale", "catalogs.json"), "rb") as f:
    CATALOGS = orjson.loads(f.read())["supported_locales"]
    CATALOGS = [dirname_to_local(dirname) for dirname in CATALOGS]
