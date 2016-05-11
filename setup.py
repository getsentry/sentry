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
handle authentication clients (such as `Raven
<https://github.com/getsentry/raven-python>`_)
and all of the logic behind storage and aggregation.

That said, Sentry is not limited to Python. The primary implementation is in
Python, but it contains a full API for sending events from any language, in
any application.

:copyright: (c) 2011-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import sys

if sys.version_info[:2] != (2, 7):
    print 'Error: Sentry requires Python 2.7'
    sys.exit(1)

import os
import json
import shutil
import os.path
import datetime
import traceback
from distutils import log
from subprocess import check_output
from distutils.core import Command
from distutils.command.build import build as BuildCommand

from setuptools import setup, find_packages
from setuptools.command.sdist import sdist as SDistCommand
from setuptools.command.develop import develop as DevelopCommand

# The version of sentry
VERSION = '8.4.1'

# Also see sentry.utils.integrationdocs.DOC_FOLDER
INTEGRATION_DOC_FOLDER = os.path.join(os.path.abspath(
    os.path.dirname(__file__)), 'src', 'sentry', 'integration-docs')


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
    'Babel',
    'flake8>=2.0,<2.1',
    'isort>=4.2.2,<4.3.0',
]

tests_require = [
    'blist',  # used by cassandra
    'casscache',
    'cqlsh',
    'datadog',
    'pytest-cov>=1.8.0,<1.9.0',
    'pytest-timeout>=0.5.0,<0.6.0',
    'pytest-xdist>=1.11.0,<1.12.0',
    'python-coveralls',
    'responses',
]


install_requires = [
    'BeautifulSoup>=3.2.1,<3.3.0',
    'celery>=3.1.8,<3.1.19',
    'click>=5.0,<7.0',
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
    'enum34>=0.9.18,<1.2.0',
    'exam>=0.5.1',
    'hiredis>=0.1.0,<0.2.0',
    'honcho>=0.7.0,<0.8.0',
    'ipaddr>=2.1.11,<2.2.0',
    'kombu==3.0.30',
    'lxml>=3.4.1',
    'mock>=0.8.0,<1.1',
    'petname>=1.7,<1.8',
    'progressbar>=2.2,<2.4',
    'psycopg2>=2.6.0,<2.7.0',
    'pytest>=2.6.4,<2.7.0',
    'pytest-django>=2.9.1,<2.10.0',
    'python-dateutil>=2.0.0,<3.0.0',
    'python-memcached>=1.53,<2.0.0',
    'PyYAML>=3.11,<4.0',
    'raven>=5.3.0',
    'redis>=2.10.3,<2.11.0',
    'requests%s>=2.9.1,<2.10.0' % (not IS_LIGHT_BUILD and '[security]' or ''),
    'simplejson>=3.2.0,<3.9.0',
    'six>=1.6.0,<2.0.0',
    'setproctitle>=1.1.7,<1.2.0',
    'statsd>=3.1.0,<3.2.0',
    'South==1.0.1',
    'toronado>=0.0.4,<0.1.0',
    'ua-parser>=0.6.1,<0.8.0',
    'urllib3>=1.14,<1.15',
    'uwsgi>2.0.0,<2.1.0',
    'rb>=1.4.0,<2.0.0',
]

dsym_requires = [
    'symsynd>=0.6.1,<1.0.0',
]


class BuildJavascriptCommand(Command):
    description = 'build javascript support files'

    user_options = [
        ('work-path=', 'w',
         "The working directory for source files. Defaults to ."),
        ('build-lib=', 'b',
         "directory for script runtime modules"),
        ('inplace', 'i',
         "ignore build-lib and put compiled javascript files into the source " +
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
        # This requires some explanation.  Basically what we want to do
        # here is to control if we want to build in-place or into the
        # build-lib folder.  Traditionally this is set by the `inplace`
        # command line flag for build_ext.  However as we are a subcommand
        # we need to grab this information from elsewhere.
        #
        # An in-place build puts the files generated into the source
        # folder, a regular build puts the files into the build-lib
        # folder.
        #
        # The following situations we need to cover:
        #
        #   command                         default in-place
        #   setup.py build_js               0
        #   setup.py build_ext              value of in-place for build_ext
        #   setup.py build_ext --inplace    1
        #   pip install --editable .        1
        #   setup.py install                0
        #   setup.py sdist                  0
        #   setup.py bdist_wheel            0
        #
        # The way this is achieved is that build_js is invoked by two
        # subcommands: bdist_ext (which is in our case always executed
        # due to a custom distribution) or sdist.
        #
        # Note: at one point install was an in-place build but it's not
        # quite sure why.  In case a version of install breaks again:
        # installations via pip from git URLs definitely require the
        # in-place flag to be disabled.  So we might need to detect
        # that separately.
        #
        # To find the default value of the inplace flag we inspect the
        # sdist and build_ext commands.
        sdist = self.distribution.get_command_obj('sdist')
        build_ext = self.get_finalized_command('build_ext')

        # If we are not decided on in-place we are inplace if either
        # build_ext is inplace or we are invoked through the install
        # command (easiest check is to see if it's finalized).
        if self.inplace is None:
            self.inplace = (build_ext.inplace or sdist.finalized) and 1 or 0

        log.info('building JavaScript support.')

        # If we're coming from sdist, clear the hell out of the dist
        # folder first.
        if sdist.finalized:
            log.info('cleaning out dist folder')
            try:
                os.unlink('src/sentry/sentry-package.json')
            except OSError:
                pass
            try:
                shutil.rmtree('src/sentry/static/sentry/dist')
            except (OSError, IOError):
                pass

            log.info('cleaning out integration docs folder')
            try:
                shutil.rmtree(INTEGRATION_DOC_FOLDER)
            except (OSError, IOError):
                pass

        # In place means build_lib is src.  We also log this.
        if self.inplace:
            log.info('In-place js building enabled')
            self.build_lib = 'src'
        # Otherwise we fetch build_lib from the build command.
        else:
            self.set_undefined_options('build',
                                       ('build_lib', 'build_lib'))
            log.info('regular js build: build path is %s' %
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
            version = VERSION
            build = sentry.__build__
        finally:
            sys.path.pop(0)

        if not (version and build):
            try:
                with open(self.sentry_package_json_path) as fp:
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
        json_path = self.sentry_package_json_path
        if not os.path.exists(json_path):
            return True

        with open(json_path) as fp:
            data = json.load(fp)
        if data.get('version') != version_info.get('version'):
            return True
        if data.get('build') != version_info.get('build'):
            return True
        return False

    def _needs_integration_docs(self):
        return not os.path.isdir(INTEGRATION_DOC_FOLDER)

    def run(self):
        need_integration_docs = not os.path.isdir(INTEGRATION_DOC_FOLDER)
        version_info = self._get_package_version()

        if not (self.force or self._needs_static(version_info)):
            log.info("skipped asset build (version already built)")
        else:
            log.info("building assets for Sentry v{} (build {})".format(
                version_info['version'] or 'UNKNOWN',
                version_info['build'] or 'UNKNOWN',
            ))
            if not version_info['version'] or not version_info['build']:
                log.fatal('Could not determine sentry version or build')
                sys.exit(1)

            node_version = []
            for app in 'node', 'npm':
                try:
                    node_version.append(check_output([app, '--version']).rstrip())
                except OSError:
                    log.fatal('Cannot find `{0}` executable. Please install {0}`'
                              ' and try again.'.format(app))
                    sys.exit(1)

            log.info('using node ({}) and npm ({})'.format(*node_version))

            try:
                self._build_static()
            except Exception:
                traceback.print_exc()
                log.fatal("unable to build Sentry's static assets!\n"
                          "Hint: You might be running an invalid version of NPM.")
                sys.exit(1)

            log.info("writing version manifest")
            manifest = self._write_version_file(version_info)
            log.info("recorded manifest\n{}".format(
                json.dumps(manifest, indent=2),
            ))
            need_integration_docs = True

        if not need_integration_docs:
            log.info('skipped integration docs (already downloaded)')
        else:
            log.info('downloading integration docs')
            from sentry.utils.integrationdocs import sync_docs
            sync_docs()

        self.update_manifests()

    def update_manifests(self):
        # if we were invoked from sdist, we need to inform sdist about
        # which files we just generated.  Otherwise they will be missing
        # in the manifest.  This adds the files for what webpack generates
        # plus our own sentry-package.json file.
        sdist = self.distribution.get_command_obj('sdist')
        if not sdist.finalized:
            return

        # The path down from here only works for sdist:

        # Use the underlying file list so that we skip the file-exists
        # check which we do not want here.
        files = sdist.filelist.files
        base = os.path.abspath('.')

        # We need to split off the local parts of the files relative to
        # the current folder.  This will chop off the right path for the
        # manifest.
        for root in self.sentry_static_dist_path, INTEGRATION_DOC_FOLDER:
            for dirname, _, filenames in os.walk(root):
                for filename in filenames:
                    filename = os.path.join(dirname, filename)
                    files.append(filename[len(base):].lstrip(os.path.sep))

        files.append('src/sentry/sentry-package.json')
        files.append('src/sentry/static/version')

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

        log.info("running [webpack]")
        env = dict(os.environ)
        env['SENTRY_STATIC_DIST_PATH'] = self.sentry_static_dist_path
        env['NODE_ENV'] = 'production'
        check_output(['node_modules/.bin/webpack', '-p', '--bail'],
                     cwd=work_path, env=env)

    def _write_version_file(self, version_info):
        manifest = {
            'createdAt': datetime.datetime.utcnow().isoformat() + 'Z',
            'version': version_info['version'],
            'build': version_info['build'],
        }
        with open(self.sentry_package_json_path, 'w') as fp:
            json.dump(manifest, fp)
        with open(self.sentry_static_version_path, 'w') as fp:
            fp.write(version_info['build'])
        return manifest

    @property
    def sentry_static_dist_path(self):
        return os.path.abspath(os.path.join(
            self.build_lib, 'sentry/static/sentry/dist'))

    @property
    def sentry_package_json_path(self):
        return os.path.abspath(os.path.join(
            self.build_lib, 'sentry/sentry-package.json'))

    @property
    def sentry_static_version_path(self):
        return os.path.abspath(os.path.join(
            self.build_lib, 'sentry/static/version'))


class SentrySDistCommand(SDistCommand):
    # If we are not a light build we want to also execute build_js as
    # part of our source build pipeline.
    if not IS_LIGHT_BUILD:
        sub_commands = SDistCommand.sub_commands + \
            [('build_js', None)]


class SentryBuildCommand(BuildCommand):

    def run(self):
        BuildCommand.run(self)
        if not IS_LIGHT_BUILD:
            self.run_command('build_js')


class SentryDevelopCommand(DevelopCommand):

    def run(self):
        DevelopCommand.run(self)
        if not IS_LIGHT_BUILD:
            self.run_command('build_js')


cmdclass = {
    'sdist': SentrySDistCommand,
    'develop': SentryDevelopCommand,
    'build': SentryBuildCommand,
    'build_js': BuildJavascriptCommand,
}


setup(
    name='sentry',
    version=VERSION,
    author='Sentry',
    author_email='hello@getsentry.com',
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
        'postgres': install_requires,
        'dsym': dsym_requires,
    },
    cmdclass=cmdclass,
    license='BSD',
    include_package_data=True,
    entry_points={
        'console_scripts': [
            'sentry = sentry.runner:main',
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
)
