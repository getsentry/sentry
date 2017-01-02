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

# if sys.version_info[:2] != (2, 7):
#     print 'Error: Sentry requires Python 2.7'
#     sys.exit(1)

import os
import os.path
import sys

from distutils.command.build import build as BuildCommand
from setuptools import setup, find_packages
from setuptools.command.sdist import sdist as SDistCommand
from setuptools.command.develop import develop as DevelopCommand

ROOT = os.path.realpath(os.path.join(os.path.dirname(
    sys.modules['__main__'].__file__)))

# Add Sentry to path so we can import distutils
sys.path.insert(0, os.path.join(ROOT, 'src'))

from sentry.utils.distutils import (
    BuildAssetsCommand, BuildIntegrationDocsCommand
)

# The version of sentry
VERSION = '8.12.0'

# Hack to prevent stupid "TypeError: 'NoneType' object is not callable" error
# in multiprocessing/util.py _exit_function when running `python
# setup.py test` (see
# http://www.eby-sarna.com/pipermail/peak/2010-May/003357.html)
for m in ('multiprocessing', 'billiard'):
    try:
        __import__(m)
    except ImportError:
        pass

IS_LIGHT_BUILD = os.environ.get('SENTRY_LIGHT_BUILD') == '1'

dev_requires = [
    'Babel',
    'flake8>=2.6,<2.7',
    'pycodestyle>=2.0,<2.1',
    'isort>=4.2.2,<4.3.0',
]

tests_require = [
    # cassandra
    'blist',
    # TODO(dcramer): figure out why Travis needs this
    'cassandra-driver<=3.5.0',
    'casscache',
    'cqlsh',
    # /cassandra
    'datadog',
    'pytest-cov>=1.8.0,<1.9.0',
    'pytest-timeout>=0.5.0,<0.6.0',
    'pytest-xdist>=1.11.0,<1.12.0',
    'python-coveralls',
    'responses',
]


install_requires = [
    'boto3>=1.4.1,<1.5',
    'celery>=3.1.8,<3.1.19',
    'click>=5.0,<7.0',
    # 'cryptography>=1.3,<1.4',
    'cssutils>=0.9.9,<0.10.0',
    'Django>=1.6.0,<1.7',
    'django-bitfield>=1.7.0,<1.8.0',
    'django-crispy-forms>=1.4.0,<1.5.0',
    'django-debug-toolbar>=1.3.2,<1.4.0',
    'django-jsonfield>=0.9.13,<0.9.14',
    'django-picklefield>=0.3.0,<0.4.0',
    'django-sudo>=2.1.0,<3.0.0',
    'django-templatetag-sugar>=0.1.0',
    'djangorestframework>=2.3.8,<2.4.0',
    'email-reply-parser>=0.2.0,<0.3.0',
    'enum34>=0.9.18,<1.2.0',
    'exam>=0.5.1',
    # broken on python3
    'hiredis>=0.1.0,<0.2.0',
    'honcho>=0.7.0,<0.8.0',
    'kombu==3.0.35',
    'lxml>=3.4.1',

    'ipaddress>=1.0.16,<1.1.0',
    'libsourcemap>=0.5.0,<0.6.0',
    'mock>=0.8.0,<1.1',
    'oauth2>=1.5.167',
    'percy>=0.2.5',
    'petname>=1.7,<1.8',
    'Pillow>=3.2.0,<3.3.0',
    'progressbar2>=3.10,<3.11',
    'psycopg2>=2.6.0,<2.7.0',
    'pytest>=2.6.4,<2.7.0',
    'pytest-django>=2.9.1,<2.10.0',
    'pytest-html>=1.9.0,<1.10.0',
    'python-dateutil>=2.0.0,<3.0.0',
    'python-memcached>=1.53,<2.0.0',
    'python-openid>=2.2',
    'PyYAML>=3.11,<3.12',
    'raven>=5.29.0,<6.0.0',
    'redis>=2.10.3,<2.11.0',
    'requests[security]>=2.9.1,<2.13.0',
    'selenium==3.0.0b3',
    'simplejson>=3.2.0,<3.9.0',
    'six>=1.10.0,<1.11.0',
    'setproctitle>=1.1.7,<1.2.0',
    'statsd>=3.1.0,<3.2.0',
    'structlog==16.1.0',
    'South==1.0.1',
    'symsynd>=1.3.0,<2.0.0',
    'toronado>=0.0.11,<0.1.0',
    'ua-parser>=0.6.1,<0.8.0',
    'urllib3>=1.14,<1.17',
    'uwsgi>2.0.0,<2.1.0',
    'rb>=1.6.0,<2.0.0',
    'qrcode>=5.2.2,<6.0.0',
    'python-u2flib-server>=4.0.1,<4.1.0',
]


class SentrySDistCommand(SDistCommand):
    # If we are not a light build we want to also execute build_assets as
    # part of our source build pipeline.
    if not IS_LIGHT_BUILD:
        sub_commands = SDistCommand.sub_commands + \
            [('build_assets', None), ('build_integration_docs', None)]


class SentryBuildCommand(BuildCommand):

    def run(self):
        BuildCommand.run(self)
        if not IS_LIGHT_BUILD:
            self.run_command('build_assets')
            self.run_command('build_integration_docs')


class SentryDevelopCommand(DevelopCommand):

    def run(self):
        DevelopCommand.run(self)
        if not IS_LIGHT_BUILD:
            self.run_command('build_assets')
            self.run_command('build_integration_docs')

cmdclass = {
    'sdist': SentrySDistCommand,
    'develop': SentryDevelopCommand,
    'build': SentryBuildCommand,
    'build_assets': BuildAssetsCommand,
    'build_integration_docs': BuildIntegrationDocsCommand,
}


setup(
    name='sentry',
    version=VERSION,
    author='Sentry',
    author_email='hello@sentry.io',
    url='https://sentry.io',
    description='A realtime logging and aggregation server.',
    long_description=open(os.path.join(ROOT, 'README.rst')).read(),
    package_dir={'': 'src'},
    packages=find_packages('src'),
    zip_safe=False,
    install_requires=install_requires,
    extras_require={
        'dev': dev_requires,
        'postgres': install_requires,
        'tests': tests_require,
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
