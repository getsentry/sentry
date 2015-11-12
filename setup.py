#!/usr/bin/env python
"""
Sentry
======

Sentry is a realtime event logging and aggregation platform. It specializes
in monitoring errors and extracting all the information needed to do a proper
post-mortem without any of the hassle of the standard user feedback loop.

Sentry is a Server
------------------

The Sentry package, at its core, is just a simple server and web UI. It will
handle authentication clients (such as `Raven <https://github.com/getsentry/raven-python>`_)
and all of the logic behind storage and aggregation.

That said, Sentry is not limited to Python. The primary implementation is in
Python, but it contains a full API for sending events from any language, in
any application.

:copyright: (c) 2011-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import datetime
import json
import os
import os.path
import sys
import traceback

from distutils import log
from distutils.command.build import build as BuildCommand
from setuptools.command.sdist import sdist as SDistCommand
from setuptools.command.build_ext import build_ext as BuildExtCommand
from setuptools import setup, find_packages
from setuptools.dist import Distribution
from subprocess import check_output


# Hack to prevent stupid "TypeError: 'NoneType' object is not callable" error
# in multiprocessing/util.py _exit_function when running `python
# setup.py test` (see
# http://www.eby-sarna.com/pipermail/peak/2010-May/003357.html)
for m in ('multiprocessing', 'billiard'):
    try:
        __import__(m)
    except ImportError:
        pass

ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__)))
IS_LIGHT_BUILD = os.environ.get('SENTRY_LIGHT_BUILD') == '1'

dev_requires = [
    'flake8>=2.0,<2.1',
    'click',
]

tests_require = [
    'blist',  # used by cassandra
    'casscache',
    'cqlsh',
    'datadog',
    'httpretty',
    'pytest-cov>=1.4',
    'pytest-timeout',
    'python-coveralls',
    'responses',
]


install_requires = [
    'BeautifulSoup>=3.2.1,<3.3.0',
    'celery>=3.1.8,<3.1.19',
    'cssutils>=0.9.9,<0.10.0',
    'Django>=1.6.0,<1.7',
    'django-bitfield>=1.7.0,<1.8.0',
    'django-crispy-forms>=1.4.0,<1.5.0',
    'django-debug-toolbar>=1.3.2,<1.4.0',
    'django-paging>=0.2.5,<0.3.0',
    'django-jsonfield>=0.9.13,<0.9.14',
    'django-picklefield>=0.3.0,<0.4.0',
    'django-recaptcha>=1.0.4,<1.1.0',
    'django-social-auth>=0.7.28,<0.8.0',
    'django-sudo>=1.2.0,<1.3.0',
    'django-templatetag-sugar>=0.1.0',
    'djangorestframework>=2.3.8,<2.4.0',
    'email-reply-parser>=0.2.0,<0.3.0',
    'enum34>=0.9.18,<0.10.0',
    'exam>=0.5.1',
    'gunicorn>=19.2.1,<20.0.0',
    'hiredis>=0.1.0,<0.2.0',
    'ipaddr>=2.1.11,<2.2.0',
    'kombu<3.0.27',  # 3.0.27 breaks Django 1.6.x compatibility
    'logan>=0.7.1,<0.8.0',
    'lxml>=3.4.1',
    'mock>=0.8.0,<1.1',
    'petname>=1.7,<1.8',
    'progressbar>=2.2,<2.4',
    'psycopg2>=2.5.0,<2.6.0',
    'pytest>=2.6.4,<2.7.0',
    'pytest-django>=2.6.0,<2.7.0',
    'python-dateutil>=2.0.0,<3.0.0',
    'python-memcached>=1.53,<2.0.0',
    'PyYAML>=3.11,<4.0',
    'raven>=5.3.0',
    'redis>=2.10.3,<2.11.0',
    'requests%s>=2.7.0,<2.8.0' % (not IS_LIGHT_BUILD and '[security]' or ''),
    'simplejson>=3.2.0,<3.9.0',
    'six>=1.6.0,<2.0.0',
    'setproctitle>=1.1.7,<1.2.0',
    'statsd>=3.1.0,<3.2.0',
    'South==1.0.1',
    'toronado>=0.0.4,<0.1.0',
    'urllib3>=1.11,<1.12',
    'rb>=1.3.0,<2.0.0',
]

postgres_requires = [
]

postgres_pypy_requires = [
    'psycopg2cffi',
]


class BuildJavascriptCommand(BuildCommand):
    description = 'build javascript support files'

    user_options = [
        ('work-path=', 'w',
         "The working directory for source files. Defaults to ."),
        ('build-lib=', 'b',
         "directory for script runtime modules"),
        ('inplace', 'i',
         "ignore build-lib and put compiled extensions into the source " +
         "directory alongside your pure Python modules"),
        ('force', 'f',
         "Force rebuilding of static content. Defaults to rebuilding on version "
         "change detection."),
    ]

    boolean_options = ['force']

    def initialize_options(self):
        self.build_lib = None
        self.force = None
        self.work_path = None
        self.inplace = None

    def finalize_options(self):
        # If we are invoked as part of a install command (cmd is finalized)
        # we want to build into the source folder (src).  Otherwise we
        # build into the build lib which means we copy our build_lib
        # argument from the current value of the build command's
        # build_lib argument with set_undefined_options
        install = self.distribution.get_command_obj('install')
        build_ext = self.get_finalized_command('build_ext')

        # In place builds or installs
        if build_ext.inplace or install.finalized or self.inplace:
            log.info('In-place building enabled. Building into source.')
            self.build_lib = 'src'
            self.inplace = 1
        else:
            self.inplace = 0
            self.set_undefined_options('build',
                                       ('build_lib', 'build_lib'))
            log.info('Regular build. Build path is %s' %
                     self.build_lib)

        if self.work_path is None:
            self.work_path = ROOT

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
            log.info("pulled version information from 'sentry' module".format(
                     sentry.__file__))
            version = sentry.__version__
            build = sentry.__build__
        finally:
            sys.path.pop(0)

        if not (version and build):
            try:
                with open(self.work_path, 'sentry-package.json') as fp:
                    data = json.loads(fp.read())
            except Exception:
                pass
            else:
                log.info("pulled version information from 'sentry-package.json'")
                version, build = data['version'], data['build']

        return {
            'version': version,
            'build': build,
        }

    def _needs_static(self, version_info):
        json_path = os.path.join(self.work_path, 'sentry-package.json')
        if not os.path.exists(json_path):
            return True

        with open(json_path) as fp:
            data = json.load(fp)
        if data.get('version') != version_info.get('version'):
            return True
        if data.get('build') != version_info.get('build'):
            return True
        return False

    def run(self):
        version_info = self._get_package_version()
        if not (self.force or self._needs_static(version_info)):
            log.info("skipped asset build (version already built)")
            return

        log.info("building assets for Sentry v{} (build {})".format(
            version_info['version'] or 'UNKNOWN',
            version_info['build'] or 'UNKNOWN',
        ))
        try:
            self._build_static()
        except Exception:
            traceback.print_exc()
            log.fatal("unable to build Sentry's static assets!\n"
                      "Hint: You might be running an invalid version of NPM.")
            sys.exit(1)

        if version_info['version'] and version_info['build']:
            log.info("writing version manifest")
            manifest = self._write_version_file(version_info)
            log.info("recorded manifest\n{}".format(
                json.dumps(manifest, indent=2),
            ))

    def _build_static(self):
        work_path = self.work_path

        if os.path.exists(os.path.join(work_path, '.git')):
            log.info("initializing git submodules")
            check_output(['git', 'submodule', 'init'], cwd=work_path)
            check_output(['git', 'submodule', 'update'], cwd=work_path)

        log.info("running [npm install --quiet]")
        check_output(['npm', 'install', '--quiet'], cwd=work_path)

        # By setting NODE_ENV=production, a few things happen
        #   * React optimizes out certain code paths
        #   * Webpack will add version strings to built/referenced assets
        os.environ['NODE_ENV'] = 'production'

        log.info("running [webpack]")
        env = dict(os.environ)
        env['SENTRY_STATIC_DIST_PATH'] = self.sentry_static_dist_path
        check_output(['node_modules/.bin/webpack', '-p', '--bail'],
                     cwd=work_path, env=env)

        # if we were invoked from sdist, we need to remember which files
        # we just generated.
        sdist = self.distribution.get_command_obj('sdist')
        if sdist.finalized:
            files = sdist.filelist
            root = self.sentry_static_dist_path
            for dirname, dirnames, filenames in os.walk(root):
                for filename in filenames:
                    filename = os.path.join(root, filename)
                    files.append(filename[len(root):].lstrip(os.path.sep))

    def _write_version_file(self, version_info):
        manifest = {
            'createdAt': datetime.datetime.utcnow().isoformat() + 'Z',
            'version': version_info['version'],
            'build': version_info['build'],
        }
        with open(os.path.join(self.build_lib, 'sentry-package.json'), 'w') as fp:
            json.dump(manifest, fp)
        return manifest

    @property
    def sentry_static_dist_path(self):
        return os.path.abspath(os.path.join(
            self.build_lib, 'sentry/static/sentry/dist'))


class SentrySDistCommand(SDistCommand):
    sub_commands = SDistCommand.sub_commands + \
        [('build_js', None)]


class SentryBuildExtCommand(BuildExtCommand):

    def run(self):
        BuildExtCommand.run(self)
        self.run_command('build_js')


class ExtendedDistribution(Distribution):

    def has_ext_modules(self):
        # We need to always run build_ext so that we invoke the build_js
        # command which is attached to our own build_ext.
        return True


setup(
    name='sentry',
    version='8.0.0.dev0',
    author='David Cramer',
    author_email='dcramer@gmail.com',
    url='https://getsentry.com',
    description='A realtime logging and aggregation server.',
    long_description=open(os.path.join(ROOT, 'README.rst')).read(),
    package_dir={'': 'src'},
    packages=find_packages('src'),
    zip_safe=False,
    install_requires=install_requires,
    extras_require={
        'tests': tests_require,
        'dev': dev_requires,
        'postgres': install_requires + postgres_requires,
        'postgres_pypy': install_requires + postgres_pypy_requires,
    },
    cmdclass={
        'sdist': SentrySDistCommand,
        'build_ext': SentryBuildExtCommand,
        'build_js': BuildJavascriptCommand,
    },
    license='BSD',
    include_package_data=True,
    entry_points={
        'console_scripts': [
            'sentry = sentry.utils.runner:main',
        ],
        'flake8.extension': [
        ],
    },
    classifiers=[
        'Framework :: Django',
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Operating System :: POSIX :: Linux',
        'Topic :: Software Development'
    ],
    distclass=ExtendedDistribution,
)
