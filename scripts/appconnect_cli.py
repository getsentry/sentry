#!/usr/bin/env sentry exec
"""Dumb CLI to experiment with our App Store Connect functionality.

It contains several useful tools to manipulate the database during development.  Exactly
what it does can be easily changed based on new needs though, nothing is set in stone.
"""
import sys
from pprint import pprint

from sentry.lang.native.appconnect import SYMBOL_SOURCES_PROP_NAME
from sentry.models import AppConnectBuild, Project
from sentry.tasks import app_store_connect
from sentry.utils import json

PROJECT_ID = 2


def main(argv):
    if argv[0] == "dump-cfg":
        project = Project.objects.get(pk=PROJECT_ID)
        raw_config = project.get_option(SYMBOL_SOURCES_PROP_NAME, default="[]")
        config = json.loads(raw_config)
        pprint(config)

    elif argv[0] == "dsyms":
        config = appconnect_config()
        app_store_connect.dsym_download(PROJECT_ID, config["id"])

    elif argv[0] == "zip":
        project = Project.objects.get(pk=PROJECT_ID)
        app_store_connect.create_difs_from_dsyms_zip(argv[1], project)

    elif argv[0] == "dump-db":
        for build in AppConnectBuild.objects.all():
            print(
                f"{build!r} app_id={build.app_id} bundle_id={build.bundle_id} platform={build.platform} version={build.bundle_short_version} build={build.bundle_version} fetched={build.fetched}"
            )

    elif argv[0] == "reset-fetched":
        for build in AppConnectBuild.objects.all():
            build.fetched = False
            build.save()

    elif argv[0] == "task":
        config = appconnect_config()
        app_store_connect.dsym_download.apply_async(
            kwargs={"project_id": PROJECT_ID, "config_id": config["id"]}
        )

    else:
        raise ValueError("Unknown command")


def appconnect_config():
    project = Project.objects.get(pk=PROJECT_ID)
    raw_config = project.get_option(SYMBOL_SOURCES_PROP_NAME, default="[]")
    symbol_sources = json.loads(raw_config)
    for config in symbol_sources:
        if config["type"] == "appStoreConnect":
            return config
    else:
        raise KeyError("appStoreConnect config not found")


if __name__ == "__main__":
    main(sys.argv[2:])
