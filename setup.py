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
import os.path

from distutils import log
from distutils.core import Command
from setuptools.command.install import install
from setuptools.command.develop import develop
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

dev_requires = [
    'flake8>=2.0,<2.1',
]

tests_require = [
    'blist',  # used by cassandra
    'casscache',
    'cqlsh',
    'elasticsearch',
    'httpretty',
    'pytest-cov>=1.4',
    'pytest-timeout',
    'python-coveralls',
    'responses',
    'riak',
]


install_requires = [
    'BeautifulSoup>=3.2.1,<3.3.0',
    'celery>=3.1.8,<3.2.0',
    'cssutils>=0.9.9,<0.10.0',
    'Django>=1.6.0,<1.7',
    'django-bitfield>=1.7.0,<1.8.0',
    'django-crispy-forms>=1.4.0,<1.5.0',
    'django-paging>=0.2.5,<0.3.0',
    'django-jsonfield>=0.9.13,<0.10.0',
    'django-picklefield>=0.3.0,<0.4.0',
    'django-recaptcha>=1.0.0,<1.1.0',
    'django-social-auth>=0.7.28,<0.8.0',
    'django-statsd-mozilla>=0.3.14.0,<0.3.15.0',
    'django-sudo>=1.1.3,<1.2.0',
    'django-templatetag-sugar>=0.1.0',
    'djangorestframework>=2.3.8,<2.4.0',
    'email-reply-parser>=0.2.0,<0.3.0',
    'enum34>=0.9.18,<0.10.0',
    'exam>=0.5.1',
    'gunicorn>=19.2.1,<20.0.0',
    'ipaddr>=2.1.11,<2.2.0',
    'logan>=0.7.1,<0.8.0',
    'lxml>=3.4.1',
    'mock>=0.8.0',
    'nydus>=0.11.0,<0.12.0',
    'markdown>=2.4.1,<2.5.0',
    'petname>=1.7,<1.8',
    'progressbar>=2.2,<2.4',
    'pytest',
    'pytest-django',
    'python-dateutil>=2.0.0,<3.0.0',
    'python-memcached>=1.53,<2.0.0',
    'raven>=5.3.0',
    'redis>=2.7.0,<2.11.0',
    'requests[security]>=2.5.1,<2.6.0',
    'simplejson>=3.1.0,<3.4.0',
    'six>=1.6.0,<2.0.0',
    'setproctitle>=1.1.7,<1.2.0',
    'statsd>=3.1.0,<3.2.0',
    'South==1.0.1',
    'toronado>=0.0.4,<0.1.0',
    'ua-parser>=0.3.5',
    'urllib3>=1.7.1,<1.8.0',
]

postgres_requires = [
    'psycopg2>=2.5.0,<2.6.0',
]

postgres_pypy_requires = [
    'psycopg2cffi',
]

mysql_requires = [
    'MySQL-python>=1.2.0,<1.3.0',
]


class DevelopWithBuildStatic(develop):
    def install_for_development(self):
        self.run_command('build_static')
        return develop.install_for_development(self)


class SdistWithBuildStatic(sdist):
    def make_release_tree(self, *a, **kw):
        dist_path = self.distribution.get_fullname()

        sdist.make_release_tree(self, *a, **kw)

        self.reinitialize_command('build_static', work_path=dist_path)
        self.run_command('build_static')

        with open(os.path.join(dist_path, 'sentry-package.json'), 'w') as fp:
            json.dump({
                'createdAt': datetime.datetime.utcnow().isoformat() + 'Z',
            }, fp)


class BuildStatic(Command):
    user_options = [
        ('work-path=', 'w',
         "The working directory for source files. Defaults to ."),
    ]

    def initialize_options(self):
        self.work_path = None

    def finalize_options(self):
        if self.work_path is None:
            self.work_path = ROOT

    def run(self):
        work_path = self.work_path

        log.info("initializing git submodules")
        check_output(['git', 'submodule', 'init'], cwd=work_path)
        check_output(['git', 'submodule', 'update'], cwd=work_path)

        log.info("running [npm install --quiet]")
        check_output(['npm', 'install', '--quiet'], cwd=work_path)

        log.info("running [gulp dist]")
        check_output([os.path.join('node_modules', '.bin', 'gulp'), 'dist'],
                     cwd=work_path)


class SmartInstall(install):
    """
    Installs Sentry into the Python environment.

    If the package indicator is missing, this will also force a run of
    `build_static` which is required for JavaScript assets and other things.
    """
    def _needs_static(self):
        return not os.path.exists(os.path.join(ROOT, 'sentry-package.json'))

    def run(self):
        if self._needs_static():
            self.run_command('build_static')
        install.run(self)


setup(
    name='sentry',
    version='7.7.0.dev0',
    author='David Cramer',
    author_email='dcramer@gmail.com',
    url='https://www.getsentry.com',
    description='A realtime logging and aggregation server.',
    long_description=open('README.rst').read(),
    package_dir={'': 'src'},
    packages=find_packages('src'),
    zip_safe=False,
    install_requires=install_requires,
    extras_require={
        'tests': tests_require,
        'dev': dev_requires,
        'postgres': install_requires + postgres_requires,
        'postgres_pypy': install_requires + postgres_pypy_requires,
        'mysql': install_requires + mysql_requires,
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
    },
    classifiers=[
        'Framework :: Django',
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Operating System :: OS Independent',
        'Topic :: Software Development'
    ],
)
