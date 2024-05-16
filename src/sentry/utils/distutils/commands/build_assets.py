# Import the stdlib json instead of sentry.utils.json, since this command is
# run in setup.py
import json  # NOQA
import logging
import os
import os.path

from .base import BaseBuildCommand

log = logging.getLogger(__name__)


class BuildAssetsCommand(BaseBuildCommand):
    description = "build static media assets"

    def get_dist_paths(self):
        return ["src/sentry/static/sentry/dist"]

    def _build(self):
        # By setting NODE_ENV=production, a few things happen
        #   * React optimizes out certain code paths
        #   * Webpack will add version strings to built/referenced assets
        env = dict(os.environ)
        env["SENTRY_STATIC_DIST_PATH"] = self.sentry_static_dist_path
        env["NODE_ENV"] = "production"
        # TODO: Our JS builds should not require 4GB heap space
        env["NODE_OPTIONS"] = (env.get("NODE_OPTIONS", "") + " --max-old-space-size=4096").lstrip()
        self._run_command(["yarn", "tsc", "-p", "config/tsconfig.build.json"], env=env)
        self._run_command(["yarn", "build-production", "--bail"], env=env)
        self._run_command(["yarn", "build-chartcuterie-config", "--bail"], env=env)

    @property
    def sentry_static_dist_path(self):
        return os.path.abspath(os.path.join(self.build_lib, "sentry/static/sentry/dist"))

    def get_asset_json_path(self):
        return os.path.abspath(os.path.join(self.build_lib, self.asset_json_path))
