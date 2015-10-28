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

from distutils import log
from distutils.core import Command
from setuptools.command.develop import develop
from setuptools.command.install import install
from setuptools.command.sdist import sdist
from setuptools import setup, find_packages
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
    'markdown>=2.4.1,<2.5.0',
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


class DevelopWithBuildStatic(develop):
    def install_for_development(self):
        if not IS_LIGHT_BUILD:
            self.run_command('build_static')
        return develop.install_for_development(self)


class SdistWithBuildStatic(sdist):
    def make_release_tree(self, *a, **kw):
        dist_path = self.distribution.get_fullname()

        sdist.make_release_tree(self, *a, **kw)

        self.reinitialize_command('build_static', work_path=dist_path,
                                  force=True)
        self.run_command('build_static')


class BuildStatic(Command):
    user_options = [
        ('work-path=', 'w',
         "The working directory for source files. Defaults to ."),
        ('force', 'f',
         "Force rebuilding of static content. Defaults to rebuilding on version "
         "change detection."),
    ]

    boolean_options = ['force']

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

    def initialize_options(self):
        self.work_path = None
        self.force = None

    def finalize_options(self):
        if self.work_path is None:
            self.work_path = ROOT

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
        check_output([os.path.join('node_modules', '.bin', 'webpack'), '-p'],
                     cwd=work_path)

    def _write_version_file(self, version_info):
        manifest = {
            'createdAt': datetime.datetime.utcnow().isoformat() + 'Z',
            'version': version_info['version'],
            'build': version_info['build'],
        }
        with open(os.path.join(self.work_path, 'sentry-package.json'), 'w') as fp:
            json.dump(manifest, fp)
        return manifest


class SmartInstall(install):
    """
    Installs Sentry into the Python environment.

    If the package indicator is missing, this will also force a run of
    `build_static` which is required for JavaScript assets and other things.
    """
    def run(self):
        if not IS_LIGHT_BUILD:
            self.reinitialize_command('build_static')
            self.run_command('build_static')
        install.run(self)


setup(
    name='sentry',
    version='8.0.0.dev0',
    author='David Cramer',
    author_email='dcramer@gmail.com',
    url='https://www.getsentry.com',
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
        'build_static': BuildStatic,
        'develop': DevelopWithBuildStatic,
        'sdist': SdistWithBuildStatic,
        'install': SmartInstall,
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
)
