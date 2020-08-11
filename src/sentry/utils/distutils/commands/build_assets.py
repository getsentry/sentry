from __future__ import absolute_import

import datetime
import os
import os.path
import sys
import traceback

# Import the stdlib json instead of sentry.utils.json, since this command is
# run in setup.py
import json  # NOQA

from distutils import log

from .base import BaseBuildCommand


class BuildAssetsCommand(BaseBuildCommand):
    user_options = BaseBuildCommand.user_options + [
        (
            "asset-json-path=",
            None,
            "Relative path for JSON manifest. Defaults to {dist_name}/assets.json",
        ),
        (
            "inplace",
            "i",
            "ignore build-lib and put compiled javascript files into the source "
            + "directory alongside your pure Python modules",
        ),
        (
            "force",
            "f",
            "Force rebuilding of static content. Defaults to rebuilding on version "
            "change detection.",
        ),
    ]

    description = "build static media assets"

    def initialize_options(self):
        self.asset_json_path = u"{}/assets.json".format(self.distribution.get_name())
        BaseBuildCommand.initialize_options(self)

    def get_dist_paths(self):
        return ["src/sentry/static/sentry/dist"]

    def get_manifest_additions(self):
        return ("src/" + self.asset_json_path,)

    def _get_package_version(self):
        """
        Attempt to get the most correct current version of Sentry.
        """
        pkg_path = os.path.join(self.work_path, "src")

        sys.path.insert(0, pkg_path)
        try:
            import sentry
        except Exception:
            version = None
            build = None
        else:
            log.info(u"pulled version information from 'sentry' module".format(sentry.__file__))
            version = self.distribution.get_version()
            build = sentry.__build__
        finally:
            sys.path.pop(0)

        if not (version and build):
            json_path = self.get_asset_json_path()
            try:
                with open(json_path) as fp:
                    data = json.loads(fp.read())
            except Exception:
                pass
            else:
                log.info(u"pulled version information from '{}'".format(json_path))
                version, build = data["version"], data["build"]

        return {"version": version, "build": build}

    def _needs_static(self, version_info):
        json_path = self.get_asset_json_path()
        if not os.path.exists(json_path):
            return True

        with open(json_path) as fp:
            data = json.load(fp)
        if data.get("version") != version_info.get("version"):
            return True
        if data.get("build") != version_info.get("build"):
            return True
        return False

    def _needs_built(self):
        if BaseBuildCommand._needs_built(self):
            return True
        version_info = self._get_package_version()
        return self._needs_static(version_info)

    def _build(self):
        version_info = self._get_package_version()
        log.info(
            u"building assets for {} v{} (build {})".format(
                self.distribution.get_name(),
                version_info["version"] or "UNKNOWN",
                version_info["build"] or "UNKNOWN",
            )
        )
        if not version_info["version"] or not version_info["build"]:
            log.fatal("Could not determine sentry version or build")
            sys.exit(1)

        try:
            self._build_static()
        except Exception:
            traceback.print_exc()
            log.fatal("unable to build Sentry's static assets!")
            sys.exit(1)

        log.info("writing version manifest")
        manifest = self._write_version_file(version_info)
        log.info(u"recorded manifest\n{}".format(json.dumps(manifest, indent=2)))

    def _build_static(self):
        # By setting NODE_ENV=production, a few things happen
        #   * React optimizes out certain code paths
        #   * Webpack will add version strings to built/referenced assets
        env = dict(os.environ)
        env["SENTRY_STATIC_DIST_PATH"] = self.sentry_static_dist_path
        env["NODE_ENV"] = "production"
        # TODO: Our JS builds should not require 4GB heap space
        env["NODE_OPTIONS"] = (
            (env.get("NODE_OPTIONS", "") + " --max-old-space-size=4096")
        ).lstrip()
        self._run_command(["yarn", "tsc", "-p", "config/tsconfig.build.json"], env=env)
        self._run_command(["yarn", "webpack", "--bail"], env=env)

    def _write_version_file(self, version_info):
        manifest = {
            "createdAt": datetime.datetime.utcnow().isoformat() + "Z",
            "version": version_info["version"],
            "build": version_info["build"],
        }
        with open(self.get_asset_json_path(), "w") as fp:
            json.dump(manifest, fp)
        return manifest

    @property
    def sentry_static_dist_path(self):
        return os.path.abspath(os.path.join(self.build_lib, "sentry/static/sentry/dist"))

    def get_asset_json_path(self):
        return os.path.abspath(os.path.join(self.build_lib, self.asset_json_path))
