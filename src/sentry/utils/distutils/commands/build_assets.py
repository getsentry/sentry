from __future__ import absolute_import

import json
import datetime
import os
import os.path
import sys
import traceback

from distutils import log

from .base import BaseBuildCommand


class BuildAssetsCommand(BaseBuildCommand):
    user_options = BaseBuildCommand.user_options + [
        (
            'inplace', 'i', "ignore build-lib and put compiled javascript files into the source " +
            "directory alongside your pure Python modules"
        ),
        (
            'force', 'f', "Force rebuilding of static content. Defaults to rebuilding on version "
            "change detection."
        ),
    ]

    description = 'build static media assets'

    def initialize_options(self):
        BaseBuildCommand.initialize_options(self)

    def get_dist_paths(self):
        return [
            'src/sentry/static/sentry/dist',
        ]

    def _get_package_version(self):
        """
        Attempt to get the most correct current version of Sentry.
        """
        pkg_path = os.path.join(self.work_path, 'src')

        sys.path.insert(0, pkg_path)
        try:
            import sentry
        except Exception:
            version = None
            build = None
        else:
            log.info(u'pulled version information from \'sentry\' module'.format(sentry.__file__))
            version = self.distribution.get_version()
            build = sentry.__build__
        finally:
            sys.path.pop(0)

        return {
            'version': version,
            'build': build,
        }

    def _needs_built(self):
        return BaseBuildCommand._needs_built(self)

    def _build(self):
        version_info = self._get_package_version()
        log.info(
            u'building assets for {} v{} (build {})'.format(
                self.distribution.get_name(),
                version_info['version'] or 'UNKNOWN',
                version_info['build'] or 'UNKNOWN',
            )
        )
        if not version_info['version'] or not version_info['build']:
            log.fatal('Could not determine sentry version or build')
            sys.exit(1)

        try:
            self._build_static()
        except Exception:
            traceback.print_exc()
            log.fatal(
                'unable to build Sentry\'s static assets!'
            )
            sys.exit(1)

    def _build_static(self):
        # By setting NODE_ENV=production, a few things happen
        #   * React optimizes out certain code paths
        #   * Webpack will add version strings to built/referenced assets
        env = dict(os.environ)
        env['SENTRY_STATIC_DIST_PATH'] = self.sentry_static_dist_path
        env['NODE_ENV'] = 'production'
        self._run_yarn_command(['webpack', '--bail'], env=env)

    @property
    def sentry_static_dist_path(self):
        return os.path.abspath(os.path.join(self.build_lib, 'sentry/static/sentry/dist'))
