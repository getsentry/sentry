# Import the stdlib json instead of sentry.utils.json, since this command is
# run in setup.py
import json  # NOQA
import logging
import os
import os.path

from sentry.build._static_assets import _build_static_assets

from .base import BaseBuildCommand

log = logging.getLogger(__name__)


class BuildAssetsCommand(BaseBuildCommand):
    description = "build static media assets"

    def get_dist_paths(self):
        return ["src/sentry/static/sentry/dist"]

    def _build(self):
        _build_static_assets()

    @property
    def sentry_static_dist_path(self):
        return os.path.abspath(os.path.join(self.build_lib, "sentry/static/sentry/dist"))

    def get_asset_json_path(self):
        return os.path.abspath(os.path.join(self.build_lib, self.asset_json_path))
